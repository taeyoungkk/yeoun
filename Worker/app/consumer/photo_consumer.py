import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import Settings
from app.schemas.photo import PhotoProcessingDlqMessage, PhotoProcessingRequest, PhotoProcessingResultMessage
from app.services.photo_loader import PhotoLoaderService
from app.services.photo_metadata import PhotoMetadataService
from app.services.photo_thumbnail import PhotoThumbnailService

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
except ImportError:  # pragma: no cover
    AIOKafkaConsumer = None
    AIOKafkaProducer = None


class PhotoConsumer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.loader = PhotoLoaderService(settings)
        self.metadata_service = PhotoMetadataService()
        self.thumbnail_service = PhotoThumbnailService(settings)
        self._consumer: Any = None
        self._producer: Any = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if AIOKafkaConsumer is None or AIOKafkaProducer is None:
            logger.warning("aiokafka is not installed; photo Kafka consumer is disabled.")
            return

        self._consumer = AIOKafkaConsumer(
            *self._subscription_topics(),
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            group_id=self.settings.kafka_photo_consumer_group,
            enable_auto_commit=False,
            auto_offset_reset=self.settings.kafka_auto_offset_reset,
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            key_serializer=lambda value: value.encode("utf-8"),
        )
        await self._consumer.start()
        await self._producer.start()
        self._task = asyncio.create_task(self._consume_loop())
        logger.info("Photo consumer started for topics=%s", ", ".join(self._subscription_topics()))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            self._task = None

        if self._consumer:
            await self._consumer.stop()
            self._consumer = None

        if self._producer:
            await self._producer.stop()
            self._producer = None

    async def _consume_loop(self) -> None:
        async for message in self._consumer:
            try:
                await self._process_message(message)
            except Exception:
                logger.exception("Fatal error while processing Kafka photo message. Consumer task will stop.")
                raise

    async def _process_message(self, message: Any) -> None:
        payload = PhotoProcessingRequest.model_validate(message.value)
        try:
            loaded_photo = await self.loader.download_and_load(payload)
            extracted = self.metadata_service.extract_and_normalize(payload, loaded_photo)
            thumbnail = self.thumbnail_service.generate_and_store(payload, loaded_photo)
            result_message = self.build_completed_result(payload, loaded_photo, extracted, thumbnail)

            await self.publish_result(result_message)
            await self._consumer.commit()

            logger.info(
                (
                    "Processed photo request photoId=%s tripId=%s attempt=%s "
                    "source=%s format=%s mimeType=%s size=%sx%s mode=%s "
                    "normalizedTakenAt=%s normalizedCoordinates=%s "
                    "thumbnailKey=%s thumbnailSize=%sx%s thumbnailBytes=%s"
                ),
                payload.photo_id,
                payload.trip_id,
                payload.attempt,
                loaded_photo.source_url,
                loaded_photo.format,
                loaded_photo.mime_type,
                loaded_photo.width,
                loaded_photo.height,
                loaded_photo.mode,
                extracted.normalized_taken_at.isoformat() if extracted.normalized_taken_at else None,
                (
                    f"{extracted.normalized_coordinates.latitude},{extracted.normalized_coordinates.longitude}"
                    if extracted.normalized_coordinates
                    else None
                ),
                thumbnail.thumbnail_key,
                thumbnail.width,
                thumbnail.height,
                thumbnail.file_size_bytes,
            )
        except Exception as exc:
            await self._handle_processing_failure(message, payload, exc)
            await self._consumer.commit()

    async def publish_result(self, message: PhotoProcessingResultMessage) -> None:
        await self._publish(
            self.settings.kafka_photo_result_topic,
            message.photo_id,
            message.model_dump(mode="json", by_alias=True),
        )

    async def publish_retry(self, message: PhotoProcessingRequest) -> None:
        await self._publish(
            self.settings.kafka_photo_retry_topic,
            message.photo_id,
            message.model_dump(mode="json", by_alias=True),
        )

    async def publish_dlq(self, message: PhotoProcessingDlqMessage) -> None:
        await self._publish(
            self.settings.kafka_photo_dlq_topic,
            message.photo_id or "unknown-photo",
            message.model_dump(mode="json", by_alias=True),
        )

    def build_completed_result(
        self,
        payload: PhotoProcessingRequest,
        loaded_photo: Any,
        extracted: Any,
        thumbnail: Any,
    ) -> PhotoProcessingResultMessage:
        metadata = dict(extracted.metadata)
        metadata.update(
            {
                "thumbnailFormat": thumbnail.format,
                "thumbnailMimeType": thumbnail.mime_type,
                "thumbnailWidth": thumbnail.width,
                "thumbnailHeight": thumbnail.height,
                "thumbnailSizeBytes": thumbnail.file_size_bytes,
                "thumbnailUrl": thumbnail.thumbnail_url,
            }
        )

        return PhotoProcessingResultMessage(
            photo_id=payload.photo_id,
            trip_id=payload.trip_id,
            owner_user_id=payload.owner_user_id,
            status="COMPLETED",
            storage_key=payload.storage_key,
            thumbnail_key=thumbnail.thumbnail_key,
            content_type=payload.content_type or loaded_photo.mime_type,
            file_name=payload.file_name,
            taken_at=payload.taken_at or extracted.extracted_taken_at,
            taken_timezone=payload.taken_timezone,
            normalized_taken_at=extracted.normalized_taken_at,
            coordinates=payload.coordinates or extracted.extracted_coordinates,
            normalized_coordinates=extracted.normalized_coordinates,
            width=loaded_photo.width,
            height=loaded_photo.height,
            metadata=metadata,
            processed_at=self._utcnow(),
            attempt=payload.attempt,
        )

    def build_failed_result(
        self,
        payload: PhotoProcessingRequest,
        exc: Exception,
        *,
        status: str = "FAILED",
    ) -> PhotoProcessingResultMessage:
        return PhotoProcessingResultMessage(
            photo_id=payload.photo_id,
            trip_id=payload.trip_id,
            owner_user_id=payload.owner_user_id,
            status=status,
            storage_key=payload.storage_key,
            content_type=payload.content_type,
            file_name=payload.file_name,
            taken_at=payload.taken_at,
            taken_timezone=payload.taken_timezone,
            coordinates=payload.coordinates,
            processed_at=self._utcnow(),
            attempt=payload.attempt,
            error_code=type(exc).__name__,
            error_message=str(exc),
        )

    def build_dlq_message(self, message: Any, payload: PhotoProcessingRequest, exc: Exception) -> PhotoProcessingDlqMessage:
        return PhotoProcessingDlqMessage(
            photo_id=payload.photo_id,
            trip_id=payload.trip_id,
            topic=message.topic,
            partition=message.partition,
            offset=message.offset,
            attempt=payload.attempt,
            payload=message.value,
            error_code=type(exc).__name__,
            error_message=str(exc),
            failed_at=self._utcnow(),
        )

    async def _handle_processing_failure(self, message: Any, payload: PhotoProcessingRequest, exc: Exception) -> None:
        next_attempt = payload.attempt + 1

        if next_attempt <= self.settings.kafka_max_retry_attempts:
            retry_payload = payload.model_copy(update={"attempt": next_attempt})
            await self.publish_retry(retry_payload)
            logger.warning(
                "Queued photo processing retry photoId=%s attempt=%s error=%s",
                payload.photo_id,
                next_attempt,
                exc,
            )
            return

        failed_result = self.build_failed_result(payload, exc)
        dlq_message = self.build_dlq_message(message, payload, exc)

        await self.publish_result(failed_result)
        await self.publish_dlq(dlq_message)
        logger.exception(
            "Moved photo processing message to DLQ photoId=%s after %s attempts",
            payload.photo_id,
            payload.attempt,
            exc_info=exc,
        )

    async def _publish(self, topic: str, key: str, value: dict[str, Any]) -> None:
        if self._producer is None:
            raise RuntimeError("Photo Kafka producer is not started.")
        await self._producer.send_and_wait(topic, key=key, value=value)

    def _subscription_topics(self) -> list[str]:
        topics = [self.settings.kafka_photo_request_topic]
        if self.settings.kafka_photo_retry_topic not in topics:
            topics.append(self.settings.kafka_photo_retry_topic)
        return topics

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
