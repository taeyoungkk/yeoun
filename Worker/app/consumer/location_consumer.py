import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.config import Settings
from app.schemas.location import (
    LocationLogBatchDlqMessage,
    LocationLogBatchResultMessage,
    LocationLogBatchStoredEvent,
)
from app.services.location_pipeline import LocationPipelineService

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
except ImportError:  # pragma: no cover
    AIOKafkaConsumer = None
    AIOKafkaProducer = None


class LocationConsumer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.pipeline = LocationPipelineService(settings)
        self._consumer: Any = None
        self._producer: Any = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if AIOKafkaConsumer is None or AIOKafkaProducer is None:
            logger.warning("aiokafka is not installed; GPS Kafka consumer is disabled.")
            return

        self._consumer = AIOKafkaConsumer(
            *self._subscription_topics(),
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            group_id=self.settings.kafka_location_consumer_group,
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
        logger.info("Location consumer started for topics=%s", ", ".join(self._subscription_topics()))

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
                logger.exception("Fatal error while processing Kafka GPS batch message. Consumer task will stop.")
                raise

    async def _process_message(self, message: Any) -> None:
        try:
            payload = LocationLogBatchStoredEvent.model_validate(message.value)
        except ValidationError as exc:
            await self._handle_invalid_payload(message, exc)
            await self._consumer.commit()
            return

        try:
            result = await self.pipeline.ingest_batch(payload)
            result_message = self.build_completed_result(payload, result)
            await self.publish_result(result_message)
            await self._consumer.commit()
            logger.info(
                "Processed GPS batch tripId=%s userId=%s accepted=%s stored=%s",
                payload.trip_id,
                payload.user_id,
                result["accepted_count"],
                result["stored_count"],
            )
        except Exception as exc:
            await self._handle_processing_failure(message, payload, exc)
            await self._consumer.commit()

    async def publish_result(self, message: LocationLogBatchResultMessage) -> None:
        await self._publish(
            self.settings.kafka_location_result_topic,
            message.trip_id,
            message.model_dump(mode="json", by_alias=True),
        )

    async def publish_retry(self, message: LocationLogBatchStoredEvent) -> None:
        await self._publish(
            self.settings.kafka_location_retry_topic,
            message.trip_id,
            message.model_dump(mode="json", by_alias=True),
        )

    async def publish_dlq(self, message: LocationLogBatchDlqMessage) -> None:
        await self._publish(
            self.settings.kafka_location_dlq_topic,
            message.trip_id or "unknown-trip",
            message.model_dump(mode="json", by_alias=True),
        )

    def build_completed_result(
        self,
        payload: LocationLogBatchStoredEvent,
        result: dict[str, int],
    ) -> LocationLogBatchResultMessage:
        return LocationLogBatchResultMessage(
            trip_id=payload.trip_id,
            user_id=payload.user_id,
            status="COMPLETED",
            requested_at=payload.requested_at,
            processed_at=self._utcnow(),
            accepted_count=result["accepted_count"],
            duplicate_count=result["duplicate_count"],
            stored_count=result["stored_count"],
            attempt=payload.attempt,
        )

    def build_failed_result(self, payload: LocationLogBatchStoredEvent, exc: Exception) -> LocationLogBatchResultMessage:
        return LocationLogBatchResultMessage(
            trip_id=payload.trip_id,
            user_id=payload.user_id,
            status="FAILED",
            requested_at=payload.requested_at,
            processed_at=self._utcnow(),
            accepted_count=len(payload.logs),
            duplicate_count=0,
            stored_count=0,
            attempt=payload.attempt,
            error_code=type(exc).__name__,
            error_message=str(exc),
        )

    def build_dlq_message(
        self,
        message: Any,
        payload: dict[str, Any],
        *,
        trip_id: str | None,
        user_id: str | None,
        attempt: int,
        exc: Exception,
    ) -> LocationLogBatchDlqMessage:
        return LocationLogBatchDlqMessage(
            trip_id=trip_id,
            user_id=user_id,
            topic=message.topic,
            partition=message.partition,
            offset=message.offset,
            attempt=attempt,
            payload=payload,
            error_code=type(exc).__name__,
            error_message=str(exc),
            failed_at=self._utcnow(),
        )

    async def _handle_invalid_payload(self, message: Any, exc: ValidationError) -> None:
        raw_payload = message.value if isinstance(message.value, dict) else {"raw": message.value}
        dlq_message = self.build_dlq_message(
            message,
            raw_payload,
            trip_id=raw_payload.get("tripId"),
            user_id=raw_payload.get("userId"),
            attempt=self._resolve_attempt(raw_payload),
            exc=exc,
        )
        await self.publish_dlq(dlq_message)
        logger.warning(
            "Moved invalid GPS batch message to DLQ topic=%s partition=%s offset=%s error=%s",
            message.topic,
            message.partition,
            message.offset,
            exc,
        )

    async def _handle_processing_failure(self, message: Any, payload: LocationLogBatchStoredEvent, exc: Exception) -> None:
        next_attempt = payload.attempt + 1

        if next_attempt <= self.settings.kafka_max_retry_attempts:
            retry_payload = payload.model_copy(update={"attempt": next_attempt})
            await self.publish_retry(retry_payload)
            logger.warning(
                "Queued GPS batch retry tripId=%s attempt=%s error=%s",
                payload.trip_id,
                next_attempt,
                exc,
            )
            return

        failed_result = self.build_failed_result(payload, exc)
        dlq_message = self.build_dlq_message(
            message,
            message.value,
            trip_id=payload.trip_id,
            user_id=payload.user_id,
            attempt=payload.attempt,
            exc=exc,
        )

        await self.publish_result(failed_result)
        await self.publish_dlq(dlq_message)
        logger.exception(
            "Moved GPS batch message to DLQ tripId=%s after %s attempts",
            payload.trip_id,
            payload.attempt,
            exc_info=exc,
        )

    async def _publish(self, topic: str, key: str, value: dict[str, Any]) -> None:
        if self._producer is None:
            raise RuntimeError("GPS Kafka producer is not started.")
        await self._producer.send_and_wait(topic, key=key, value=value)

    def _subscription_topics(self) -> list[str]:
        topics = [self.settings.kafka_location_request_topic]
        if self.settings.kafka_location_retry_topic not in topics:
            topics.append(self.settings.kafka_location_retry_topic)
        return topics

    def _resolve_attempt(self, payload: dict[str, Any]) -> int:
        attempt = payload.get("attempt", 0)
        return attempt if isinstance(attempt, int) and attempt >= 0 else 0

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
