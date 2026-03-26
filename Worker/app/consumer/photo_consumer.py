import asyncio
import json
import logging
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.config import Settings
from app.schemas.photo import PhotoProcessingDlqMessage, PhotoProcessingRequest, PhotoProcessingResultMessage
from app.services.photo_gps_matcher import PhotoGpsMatcherService
from app.services.photo_loader import PhotoLoaderService
from app.services.photo_metadata import PhotoMetadataService
from app.services.photo_processing_pipeline import PhotoProcessingPipeline
from app.services.photo_processing_status import PhotoProcessingStatusWriter
from app.services.photo_thumbnail import PhotoThumbnailService

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
    from aiokafka.structs import TopicPartition
except ImportError:  # pragma: no cover
    AIOKafkaConsumer = None
    AIOKafkaProducer = None
    TopicPartition = None


PartitionKey = tuple[str, int]


class PhotoConsumer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.loader = PhotoLoaderService(settings)
        self.gps_matcher = PhotoGpsMatcherService(settings)
        self.metadata_service = PhotoMetadataService()
        self.thumbnail_service = PhotoThumbnailService(settings)
        self.processing_pipeline = PhotoProcessingPipeline(settings)
        self.status_writer = PhotoProcessingStatusWriter(settings)
        self._consumer: Any = None
        self._producer: Any = None
        self._task: asyncio.Task | None = None
        self._inflight_tasks: set[asyncio.Task] = set()
        self._next_commit_offsets: dict[PartitionKey, int] = {}
        self._processed_offsets: dict[PartitionKey, set[int]] = {}
        self._max_inflight = max(1, settings.kafka_photo_max_inflight)

    async def start(self) -> None:
        if AIOKafkaConsumer is None or AIOKafkaProducer is None or TopicPartition is None:
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
        logger.info(
            "Photo consumer started for topics=%s maxInflight=%s",
            ", ".join(self._subscription_topics()),
            self._max_inflight,
        )

    async def stop(self) -> None:
        if self._task:
            task = self._task
            self._task = None
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

        if self._consumer:
            await self._consumer.stop()
            self._consumer = None

        if self._producer:
            await self._producer.stop()
            self._producer = None

    async def _consume_loop(self) -> None:
        try:
            while True:
                await self._drain_completed_tasks(wait=False)
                if len(self._inflight_tasks) >= self._max_inflight:
                    await self._drain_completed_tasks(wait=True)
                    continue

                message = await self._consumer.getone()
                self._register_message(message)
                task = asyncio.create_task(self._process_message_with_tracking(message))
                self._inflight_tasks.add(task)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Fatal error while processing Kafka photo message. Consumer task will stop.")
            raise
        finally:
            await self._await_inflight_tasks(cancel_pending=True)

    async def _process_message_with_tracking(self, message: Any) -> None:
        await self._process_message(message)
        await self._mark_offset_processed(message)

    async def _process_message(self, message: Any) -> None:
        try:
            payload = PhotoProcessingRequest.model_validate(message.value)
        except ValidationError as exc:
            await self._handle_invalid_payload(message, exc)
            return

        self.status_writer.mark_processing(
            payload.photo_id,
            payload.trip_id,
            requested_at=payload.requested_at,
            attempt=payload.attempt,
        )
        try:
            loaded_photo = await self.loader.download_and_load(payload)
            extracted = self.metadata_service.extract_and_normalize(payload, loaded_photo)
            thumbnail = self.thumbnail_service.generate_and_store(payload, loaded_photo)
            base_result = self.build_completed_result(payload, loaded_photo, extracted, thumbnail)
            gps_match = self.gps_matcher.match(base_result)
            result_message = self.build_completed_result(payload, loaded_photo, extracted, thumbnail, gps_match)

            result_message = self.processing_pipeline.persist_and_link(result_message)
            self.status_writer.mark_ready(
                payload.photo_id,
                payload.trip_id,
                requested_at=payload.requested_at,
                attempt=payload.attempt,
            )
            await self.publish_result(result_message)

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
        gps_match: Any = None,
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
        if gps_match is not None:
            metadata["gpsMatch"] = gps_match.model_dump(mode="json", by_alias=True)

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
            gps_match=gps_match,
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
        attempt: int | None = None,
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
            attempt=payload.attempt if attempt is None else attempt,
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
            retry_result = self.build_failed_result(
                payload,
                exc,
                status="RETRY_SCHEDULED",
                attempt=next_attempt,
            )
            self.status_writer.mark_retry_scheduled(
                payload.photo_id,
                payload.trip_id,
                requested_at=payload.requested_at,
                attempt=next_attempt,
                error_code=type(exc).__name__,
                error_message=str(exc),
            )
            await self.publish_result(retry_result)
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

        self.status_writer.mark_dlq(
            payload.photo_id,
            payload.trip_id,
            requested_at=payload.requested_at,
            attempt=payload.attempt,
            error_code=type(exc).__name__,
            error_message=str(exc),
        )
        await self.publish_result(failed_result)
        await self.publish_dlq(dlq_message)
        logger.exception(
            "Moved photo processing message to DLQ photoId=%s after %s attempts",
            payload.photo_id,
            payload.attempt,
            exc_info=exc,
        )

    async def _handle_invalid_payload(self, message: Any, exc: ValidationError) -> None:
        payload_dict = message.value if isinstance(message.value, dict) else {"raw": message.value}
        photo_id = payload_dict.get("photoId") if isinstance(payload_dict, dict) else None
        trip_id = payload_dict.get("tripId") if isinstance(payload_dict, dict) else None
        attempt = int(payload_dict.get("attempt", 0)) if isinstance(payload_dict, dict) else 0
        dlq_message = PhotoProcessingDlqMessage(
            photo_id=photo_id,
            trip_id=trip_id,
            topic=message.topic,
            partition=message.partition,
            offset=message.offset,
            attempt=attempt,
            payload=payload_dict,
            error_code="ValidationError",
            error_message=str(exc),
            failed_at=self._utcnow(),
        )
        self.status_writer.mark_dlq(
            photo_id,
            trip_id,
            attempt=attempt,
            error_code="ValidationError",
            error_message=str(exc),
        )
        await self.publish_dlq(dlq_message)
        logger.warning(
            "Moved invalid photo payload to DLQ photoId=%s tripId=%s offset=%s",
            photo_id,
            trip_id,
            message.offset,
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

    def _register_message(self, message: Any) -> None:
        partition_key = self._partition_key(message)
        self._processed_offsets.setdefault(partition_key, set())
        self._next_commit_offsets.setdefault(partition_key, message.offset)

    async def _mark_offset_processed(self, message: Any) -> None:
        partition_key = self._partition_key(message)
        processed_offsets = self._processed_offsets.setdefault(partition_key, set())
        next_commit_offset = self._next_commit_offsets.setdefault(partition_key, message.offset)
        processed_offsets.add(message.offset)

        advanced_offset = next_commit_offset
        while advanced_offset in processed_offsets:
            processed_offsets.remove(advanced_offset)
            advanced_offset += 1

        if advanced_offset == next_commit_offset:
            return

        self._next_commit_offsets[partition_key] = advanced_offset
        await self._consumer.commit(
            {
                TopicPartition(message.topic, message.partition): advanced_offset,
            }
        )

    async def _drain_completed_tasks(self, *, wait: bool) -> None:
        if not self._inflight_tasks:
            return

        done_tasks = {task for task in self._inflight_tasks if task.done()}
        if wait and not done_tasks:
            done_tasks, _ = await asyncio.wait(self._inflight_tasks, return_when=asyncio.FIRST_COMPLETED)

        for task in done_tasks:
            self._inflight_tasks.remove(task)
            task.result()

    async def _await_inflight_tasks(self, *, cancel_pending: bool) -> None:
        if not self._inflight_tasks:
            return

        tasks = list(self._inflight_tasks)
        self._inflight_tasks.clear()

        if cancel_pending:
            for task in tasks:
                task.cancel()

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, asyncio.CancelledError):
                continue
            if isinstance(result, Exception):
                raise result

    def _partition_key(self, message: Any) -> PartitionKey:
        return message.topic, message.partition

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
