from datetime import datetime, timezone
from uuid import uuid4

import psycopg
from psycopg import Connection

from app.config import Settings
from app.schemas.location import LocationLogBatchStoredEvent


class LocationLogRawWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def save_batch(
        self,
        payload: LocationLogBatchStoredEvent,
        *,
        connection: Connection | None = None,
    ) -> dict[str, int]:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for GPS raw persistence.")

        stored_count = 0
        duplicate_count = 0
        created_at = datetime.now(timezone.utc)

        owns_connection = connection is None
        if owns_connection:
            connection = psycopg.connect(self.settings.worker_database_url)

        try:
            with connection.cursor() as cursor:
                for log in payload.logs:
                    cursor.execute(
                        """
                        INSERT INTO location_logs_raw (
                            location_log_id,
                            trip_id,
                            user_id,
                            recorded_at,
                            latitude,
                            longitude,
                            accuracy_m,
                            speed_mps,
                            heading,
                            source,
                            client_log_uuid,
                            created_at
                        )
                        VALUES (
                            %(location_log_id)s,
                            %(trip_id)s,
                            %(user_id)s,
                            %(recorded_at)s,
                            %(latitude)s,
                            %(longitude)s,
                            %(accuracy_m)s,
                            %(speed_mps)s,
                            %(heading)s,
                            %(source)s,
                            %(client_log_uuid)s,
                            %(created_at)s
                        )
                        ON CONFLICT (trip_id, user_id, client_log_uuid) DO NOTHING
                        """,
                        {
                            "location_log_id": str(uuid4()),
                            "trip_id": payload.trip_id,
                            "user_id": payload.user_id,
                            "recorded_at": log.recorded_at,
                            "latitude": log.latitude,
                            "longitude": log.longitude,
                            "accuracy_m": log.accuracy_m,
                            "speed_mps": log.speed_mps,
                            "heading": log.heading,
                            "source": log.source,
                            "client_log_uuid": log.client_log_uuid,
                            "created_at": created_at,
                        },
                    )
                    if cursor.rowcount == 1:
                        stored_count += 1
                    else:
                        duplicate_count += 1
            if owns_connection:
                connection.commit()
        except Exception:
            if owns_connection:
                connection.rollback()
            raise
        finally:
            if owns_connection:
                connection.close()

        return {
            "accepted_count": len(payload.logs),
            "duplicate_count": duplicate_count,
            "stored_count": stored_count,
        }
