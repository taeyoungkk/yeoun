from __future__ import annotations

from datetime import datetime, timezone

import psycopg

from app.config import Settings


class TripProcessingStatusWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def mark_processing(self, trip_id: str, *, requested_at: datetime | None = None) -> None:
        now = self._utcnow()
        self._upsert_status(
            trip_id=trip_id,
            status="PROCESSING",
            last_requested_at=requested_at or now,
            last_processed_at=None,
            last_error_message=None,
            created_at=now,
            updated_at=now,
        )

    def mark_ready(self, trip_id: str, *, requested_at: datetime | None = None) -> None:
        now = self._utcnow()
        self._upsert_status(
            trip_id=trip_id,
            status="READY",
            last_requested_at=requested_at,
            last_processed_at=now,
            last_error_message=None,
            created_at=now,
            updated_at=now,
        )

    def mark_failed(self, trip_id: str, error_message: str, *, requested_at: datetime | None = None) -> None:
        now = self._utcnow()
        self._upsert_status(
            trip_id=trip_id,
            status="FAILED",
            last_requested_at=requested_at,
            last_processed_at=None,
            last_error_message=error_message[:500],
            created_at=now,
            updated_at=now,
        )

    def _upsert_status(
        self,
        *,
        trip_id: str,
        status: str,
        last_requested_at: datetime | None,
        last_processed_at: datetime | None,
        last_error_message: str | None,
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for trip processing status updates.")

        with psycopg.connect(self.settings.worker_database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO trip_processing_statuses (
                        trip_id,
                        status,
                        last_requested_at,
                        last_processed_at,
                        last_error_message,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %(trip_id)s,
                        %(status)s,
                        %(last_requested_at)s,
                        %(last_processed_at)s,
                        %(last_error_message)s,
                        %(created_at)s,
                        %(updated_at)s
                    )
                    ON CONFLICT (trip_id) DO UPDATE
                    SET status = EXCLUDED.status,
                        last_requested_at = COALESCE(EXCLUDED.last_requested_at, trip_processing_statuses.last_requested_at),
                        last_processed_at = COALESCE(EXCLUDED.last_processed_at, trip_processing_statuses.last_processed_at),
                        last_error_message = EXCLUDED.last_error_message,
                        updated_at = EXCLUDED.updated_at
                    """,
                    {
                        "trip_id": trip_id,
                        "status": status,
                        "last_requested_at": last_requested_at,
                        "last_processed_at": last_processed_at,
                        "last_error_message": last_error_message,
                        "created_at": created_at,
                        "updated_at": updated_at,
                    },
                )
            connection.commit()

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)
