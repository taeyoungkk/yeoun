import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import Settings
from app.schemas.photo import PhotoProcessingDlqMessage, PhotoProcessingRequest, PhotoProcessingResultMessage
from app.services.photo_loader import PhotoLoaderService

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
        loaded_photo = await self.loader.download_and_load(payload)
        logger.info(
            (
                "Loaded photo processing source photoId=%s tripId=%s attempt=%s "
                "source=%s format=%s mimeType=%s size=%sx%s mode=%s"
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
        )
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
