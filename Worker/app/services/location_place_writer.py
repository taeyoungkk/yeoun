from datetime import datetime, timezone
from uuid import uuid4

import psycopg
from psycopg import Connection

from app.config import Settings
from app.schemas.location import LocationPlaceCandidate


class LocationPlaceWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def save_batch(
        self,
        places: list[LocationPlaceCandidate],
        *,
        connection: Connection | None = None,
    ) -> int:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for place persistence.")

        if not places:
            return 0

        persisted_count = 0
        now = datetime.now(timezone.utc)

        owns_connection = connection is None
        if owns_connection:
            connection = psycopg.connect(self.settings.worker_database_url)

        try:
            with connection.cursor() as cursor:
                for place in places:
                    cursor.execute(
                        """
                        INSERT INTO location_places (
                            place_row_id,
                            place_id,
                            trip_id,
                            user_id,
                            started_at,
                            ended_at,
                            duration_seconds,
                            center_latitude,
                            center_longitude,
                            stay_segment_count,
                            source,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            %(place_row_id)s,
                            %(place_id)s,
                            %(trip_id)s,
                            %(user_id)s,
                            %(started_at)s,
                            %(ended_at)s,
                            %(duration_seconds)s,
                            %(center_latitude)s,
                            %(center_longitude)s,
                            %(stay_segment_count)s,
                            %(source)s,
                            %(created_at)s,
                            %(updated_at)s
                        )
                        ON CONFLICT (place_id) DO UPDATE
                        SET started_at = EXCLUDED.started_at,
                            ended_at = EXCLUDED.ended_at,
                            duration_seconds = EXCLUDED.duration_seconds,
                            center_latitude = EXCLUDED.center_latitude,
                            center_longitude = EXCLUDED.center_longitude,
                            stay_segment_count = EXCLUDED.stay_segment_count,
                            source = EXCLUDED.source,
                            updated_at = EXCLUDED.updated_at
                        """,
                        {
                            "place_row_id": str(uuid4()),
                            "place_id": place.place_id,
                            "trip_id": place.trip_id,
                            "user_id": place.user_id,
                            "started_at": place.started_at,
                            "ended_at": place.ended_at,
                            "duration_seconds": place.duration_seconds,
                            "center_latitude": place.center_latitude,
                            "center_longitude": place.center_longitude,
                            "stay_segment_count": place.stay_segment_count,
                            "source": place.source,
                            "created_at": now,
                            "updated_at": now,
                        },
                    )
                    persisted_count += 1
            if owns_connection:
                connection.commit()
        except Exception:
            if owns_connection:
                connection.rollback()
            raise
        finally:
            if owns_connection:
                connection.close()

        return persisted_count
