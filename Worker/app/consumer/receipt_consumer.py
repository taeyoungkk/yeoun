import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.config import Settings
from app.schemas.receipt import ReceiptOcrDlqMessage, ReceiptOcrRequest, ReceiptOcrResultMessage
from app.services.receipt_ocr import ReceiptOcrService
from app.services.receipt_processing_status import ReceiptProcessingStatusWriter
from app.services.receipt_result_writer import ReceiptResultWriter

logger = logging.getLogger(__name__)

try:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
except ImportError:  # pragma: no cover
    AIOKafkaConsumer = None
    AIOKafkaProducer = None


class ReceiptConsumer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.service = ReceiptOcrService(settings)
        self.status_writer = ReceiptProcessingStatusWriter(settings)
        self.result_writer = ReceiptResultWriter(settings)
        self._consumer: Any = None
        self._producer: Any = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if AIOKafkaConsumer is None or AIOKafkaProducer is None:
            logger.warning("aiokafka is not installed; Kafka consumer is disabled.")
            return

        self._consumer = AIOKafkaConsumer(
            *self._subscription_topics(),
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            group_id=self.settings.kafka_consumer_group,
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
        logger.info("Receipt consumer started for topics=%s", ", ".join(self._subscription_topics()))

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
                logger.exception("Fatal error while processing Kafka receipt OCR message. Consumer task will stop.")
                raise

    async def _process_message(self, message: Any) -> None:
        try:
            payload = ReceiptOcrRequest.model_validate(message.value)
        except ValidationError as exc:
            await self._handle_invalid_payload(message, exc)
            await self._consumer.commit()
            return

        self.status_writer.mark_processing(
            payload.receipt_id,
            payload.trip_id,
            requested_at=payload.requested_at,
            attempt=payload.attempt,
        )
        try:
            result = await self.service.extract(payload)
            result_message = ReceiptOcrResultMessage(
                receipt_id=payload.receipt_id,
                status="COMPLETED",
                merchant_name=result.merchant_name,
                paid_at=result.paid_at,
                currency_code=result.currency_code,
                total_amount=result.total_amount,
                tax_amount=result.tax_amount,
                line_items=result.line_items,
                raw_text=result.raw_text,
                processed_at=self._utcnow(),
                attempt=payload.attempt,
            )
            self.result_writer.persist_result(payload, result_message)
            self.status_writer.mark_ready(
                payload.receipt_id,
                payload.trip_id,
                requested_at=payload.requested_at,
                attempt=payload.attempt,
            )
            await self._publish(
                self.settings.kafka_receipt_result_topic,
                payload.receipt_id,
                result_message.model_dump(mode="json", by_alias=True),
            )
            await self._consumer.commit()
            logger.info(
                "Processed receipt OCR request receiptId=%s merchant=%s total=%s",
                payload.receipt_id,
                result.merchant_name,
                result.total_amount,
            )
        except Exception as exc:
            await self._handle_processing_failure(message, payload, exc)
            await self._consumer.commit()

    async def _handle_processing_failure(self, message: Any, payload: ReceiptOcrRequest, exc: Exception) -> None:
        next_attempt = payload.attempt + 1

        if next_attempt <= self.settings.kafka_max_retry_attempts:
            retry_payload = payload.model_copy(update={"attempt": next_attempt})
            self.status_writer.mark_retry_scheduled(
                payload.receipt_id,
                payload.trip_id,
                requested_at=payload.requested_at,
                attempt=next_attempt,
                error_code=type(exc).__name__,
                error_message=str(exc),
            )
            await self._publish(
                self.settings.kafka_receipt_retry_topic,
                retry_payload.receipt_id,
                retry_payload.model_dump(mode="json", by_alias=True),
            )
            logger.warning(
                "Queued receipt OCR retry receiptId=%s attempt=%s error=%s",
                payload.receipt_id,
                next_attempt,
                exc,
            )
            return

        failed_result = ReceiptOcrResultMessage(
            receipt_id=payload.receipt_id,
            status="FAILED",
            currency_code=payload.currency_code,
            error_code=type(exc).__name__,
            error_message=str(exc),
            processed_at=self._utcnow(),
            attempt=payload.attempt,
        )
        self.result_writer.persist_result(payload, failed_result)
        dlq_message = ReceiptOcrDlqMessage(
            receipt_id=payload.receipt_id,
            topic=message.topic,
            partition=message.partition,
            offset=message.offset,
            attempt=payload.attempt,
            payload=message.value,
            error_code=type(exc).__name__,
            error_message=str(exc),
            failed_at=self._utcnow(),
        )

        await self._publish(
            self.settings.kafka_receipt_result_topic,
            payload.receipt_id,
            failed_result.model_dump(mode="json", by_alias=True),
        )
        self.status_writer.mark_dlq(
            payload.receipt_id,
            payload.trip_id,
            requested_at=payload.requested_at,
            attempt=payload.attempt,
            error_code=type(exc).__name__,
            error_message=str(exc),
        )
        await self._publish(
            self.settings.kafka_receipt_dlq_topic,
            payload.receipt_id,
            dlq_message.model_dump(mode="json", by_alias=True),
        )
        logger.exception(
            "Moved receipt OCR message to DLQ receiptId=%s after %s attempts",
            payload.receipt_id,
            payload.attempt,
            exc_info=exc,
        )

    async def _handle_invalid_payload(self, message: Any, exc: ValidationError) -> None:
        payload_dict = message.value if isinstance(message.value, dict) else {"raw": message.value}
        receipt_id = payload_dict.get("receiptId") if isinstance(payload_dict, dict) else None
        trip_id = payload_dict.get("tripId") if isinstance(payload_dict, dict) else None
        attempt = int(payload_dict.get("attempt", 0)) if isinstance(payload_dict, dict) else 0
        dlq_message = ReceiptOcrDlqMessage(
            receipt_id=receipt_id,
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
            receipt_id,
            trip_id,
            attempt=attempt,
            error_code="ValidationError",
            error_message=str(exc),
        )
        await self._publish(
            self.settings.kafka_receipt_dlq_topic,
            receipt_id or "unknown-receipt",
            dlq_message.model_dump(mode="json", by_alias=True),
        )
        logger.warning(
            "Moved invalid receipt OCR payload to DLQ receiptId=%s tripId=%s offset=%s",
            receipt_id,
            trip_id,
            message.offset,
        )

    async def _publish(self, topic: str, key: str, value: dict[str, Any]) -> None:
        await self._producer.send_and_wait(topic, key=key, value=value)

    def _subscription_topics(self) -> list[str]:
        topics = [self.settings.kafka_receipt_request_topic]
        if self.settings.kafka_receipt_retry_topic not in topics:
            topics.append(self.settings.kafka_receipt_retry_topic)
        return topics

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
