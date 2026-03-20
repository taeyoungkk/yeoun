from datetime import datetime, timezone
from uuid import uuid4

import psycopg

from app.config import Settings
from app.schemas.location import LocationCleanLog


class LocationLogCleanWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def save_batch(self, trip_id: str, user_id: str, clean_logs: list[LocationCleanLog]) -> int:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for GPS clean persistence.")

        if not clean_logs:
            return 0

        persisted_count = 0
        now = datetime.now(timezone.utc)

        with psycopg.connect(self.settings.worker_database_url) as connection:
            with connection.cursor() as cursor:
                for log in clean_logs:
                    cursor.execute(
                        """
                        INSERT INTO location_logs_clean (
                            location_clean_log_id,
                            trip_id,
                            user_id,
                            client_log_uuid,
                            recorded_at,
                            latitude,
                            longitude,
                            accuracy_m,
                            speed_mps,
                            heading,
                            source,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            %(location_clean_log_id)s,
                            %(trip_id)s,
                            %(user_id)s,
                            %(client_log_uuid)s,
                            %(recorded_at)s,
                            %(latitude)s,
                            %(longitude)s,
                            %(accuracy_m)s,
                            %(speed_mps)s,
                            %(heading)s,
                            %(source)s,
                            %(created_at)s,
                            %(updated_at)s
                        )
                        ON CONFLICT (trip_id, user_id, client_log_uuid) DO NOTHING
                        """,
                        {
                            "location_clean_log_id": str(uuid4()),
                            "trip_id": trip_id,
                            "user_id": user_id,
                            "client_log_uuid": log.client_log_uuid,
                            "recorded_at": log.recorded_at,
                            "latitude": log.latitude,
                            "longitude": log.longitude,
                            "accuracy_m": log.accuracy_m,
                            "speed_mps": log.speed_mps,
                            "heading": log.heading,
                            "source": log.source,
                            "created_at": now,
                            "updated_at": now,
                        },
                    )
                    if cursor.rowcount == 1:
                        persisted_count += 1

            connection.commit()

        return persisted_count
