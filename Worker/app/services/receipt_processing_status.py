from __future__ import annotations

from datetime import datetime, timezone

import psycopg
from psycopg import Connection

from app.config import Settings


class ReceiptProcessingStatusWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def mark_processing(
        self,
        receipt_id: str,
        trip_id: str | None,
        *,
        requested_at: datetime | None = None,
        attempt: int = 0,
        connection: Connection | None = None,
    ) -> None:
        now = self._utcnow()
        self._upsert_status(
            receipt_id=receipt_id,
            trip_id=trip_id,
            status="PROCESSING",
            attempt=attempt,
            last_requested_at=requested_at or now,
            last_processed_at=None,
            last_error_code=None,
            last_error_message=None,
            created_at=now,
            updated_at=now,
            connection=connection,
        )

    def mark_ready(
        self,
        receipt_id: str,
        trip_id: str | None,
        *,
        requested_at: datetime | None = None,
        attempt: int = 0,
        connection: Connection | None = None,
    ) -> None:
        now = self._utcnow()
        self._upsert_status(
            receipt_id=receipt_id,
            trip_id=trip_id,
            status="READY",
            attempt=attempt,
            last_requested_at=requested_at,
            last_processed_at=now,
            last_error_code=None,
            last_error_message=None,
            created_at=now,
            updated_at=now,
            connection=connection,
        )

    def mark_retry_scheduled(
        self,
        receipt_id: str,
        trip_id: str | None,
        *,
        requested_at: datetime | None = None,
        attempt: int,
        error_code: str,
        error_message: str,
        connection: Connection | None = None,
    ) -> None:
        now = self._utcnow()
        self._upsert_status(
            receipt_id=receipt_id,
            trip_id=trip_id,
            status="RETRY_SCHEDULED",
            attempt=attempt,
            last_requested_at=requested_at,
            last_processed_at=now,
            last_error_code=error_code[:100],
            last_error_message=error_message[:500],
            created_at=now,
            updated_at=now,
            connection=connection,
        )

    def mark_dlq(
        self,
        receipt_id: str | None,
        trip_id: str | None,
        *,
        requested_at: datetime | None = None,
        attempt: int,
        error_code: str,
        error_message: str,
        connection: Connection | None = None,
    ) -> None:
        if not receipt_id:
            return
        now = self._utcnow()
        self._upsert_status(
            receipt_id=receipt_id,
            trip_id=trip_id,
            status="DLQ",
            attempt=attempt,
            last_requested_at=requested_at,
            last_processed_at=now,
            last_error_code=error_code[:100],
            last_error_message=error_message[:500],
            created_at=now,
            updated_at=now,
            connection=connection,
        )

    def _upsert_status(
        self,
        *,
        receipt_id: str,
        trip_id: str | None,
        status: str,
        attempt: int,
        last_requested_at: datetime | None,
        last_processed_at: datetime | None,
        last_error_code: str | None,
        last_error_message: str | None,
        created_at: datetime,
        updated_at: datetime,
        connection: Connection | None,
    ) -> None:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for receipt processing status updates.")

        owns_connection = connection is None
        if owns_connection:
            connection = psycopg.connect(self.settings.worker_database_url)

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO receipt_processing_statuses (
                        receipt_id,
                        trip_id,
                        status,
                        attempt,
                        last_requested_at,
                        last_processed_at,
                        last_error_code,
                        last_error_message,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %(receipt_id)s,
                        %(trip_id)s,
                        %(status)s,
                        %(attempt)s,
                        %(last_requested_at)s,
                        %(last_processed_at)s,
                        %(last_error_code)s,
                        %(last_error_message)s,
                        %(created_at)s,
                        %(updated_at)s
                    )
                    ON CONFLICT (receipt_id) DO UPDATE
                    SET trip_id = COALESCE(EXCLUDED.trip_id, receipt_processing_statuses.trip_id),
                        status = EXCLUDED.status,
                        attempt = EXCLUDED.attempt,
                        last_requested_at = COALESCE(EXCLUDED.last_requested_at, receipt_processing_statuses.last_requested_at),
                        last_processed_at = COALESCE(EXCLUDED.last_processed_at, receipt_processing_statuses.last_processed_at),
                        last_error_code = EXCLUDED.last_error_code,
                        last_error_message = EXCLUDED.last_error_message,
                        updated_at = EXCLUDED.updated_at
                    """,
                    {
                        "receipt_id": receipt_id,
                        "trip_id": trip_id,
                        "status": status,
                        "attempt": attempt,
                        "last_requested_at": last_requested_at,
                        "last_processed_at": last_processed_at,
                        "last_error_code": last_error_code,
                        "last_error_message": last_error_message,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    },
                )

            if owns_connection:
                connection.commit()
        except Exception:
            if owns_connection:
                connection.rollback()
            raise
        finally:
            if owns_connection:
                connection.close()

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
