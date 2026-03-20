from datetime import datetime, timezone
from uuid import uuid4

import psycopg

from app.config import Settings
from app.schemas.location import LocationRouteDay


class LocationRouteDayWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def save_batch(self, route_days: list[LocationRouteDay]) -> int:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for route persistence.")

        if not route_days:
            return 0

        persisted_count = 0
        now = datetime.now(timezone.utc)

        with psycopg.connect(self.settings.worker_database_url) as connection:
            with connection.cursor() as cursor:
                for route_day in route_days:
                    cursor.execute(
                        """
                        INSERT INTO location_route_days (
                            route_day_id,
                            trip_id,
                            user_id,
                            day,
                            point_count,
                            distance_m,
                            coordinates_json,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            %(route_day_id)s,
                            %(trip_id)s,
                            %(user_id)s,
                            %(day)s,
                            %(point_count)s,
                            %(distance_m)s,
                            %(coordinates_json)s::jsonb,
                            %(created_at)s,
                            %(updated_at)s
                        )
                        ON CONFLICT (trip_id, user_id, day) DO UPDATE
                        SET point_count = EXCLUDED.point_count,
                            distance_m = EXCLUDED.distance_m,
                            coordinates_json = EXCLUDED.coordinates_json,
                            updated_at = EXCLUDED.updated_at
                        """,
                        {
                            "route_day_id": str(uuid4()),
                            "trip_id": route_day.trip_id,
                            "user_id": route_day.user_id,
                            "day": route_day.day,
                            "point_count": route_day.point_count,
                            "distance_m": route_day.distance_m,
                            "coordinates_json": self._to_coordinates_json(route_day.coordinates),
                            "created_at": now,
                            "updated_at": now,
                        },
                    )
                    persisted_count += 1
            connection.commit()

        return persisted_count

    def _to_coordinates_json(self, coordinates) -> str:
        serialized = [[float(lng), float(lat)] for lng, lat in coordinates]
        import json

        return json.dumps(serialized)
