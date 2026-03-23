from datetime import datetime, timezone
from uuid import uuid4

import psycopg
from psycopg import Connection

from app.config import Settings
from app.schemas.location import LocationTimelineCandidate


class LocationTimelineCandidateWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def save_batch(
        self,
        candidates: list[LocationTimelineCandidate],
        *,
        connection: Connection | None = None,
    ) -> int:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for location timeline candidate persistence.")

        if not candidates:
            return 0

        persisted_count = 0
        now = datetime.now(timezone.utc)

        owns_connection = connection is None
        if owns_connection:
            connection = psycopg.connect(self.settings.worker_database_url)

        try:
            with connection.cursor() as cursor:
                for candidate in candidates:
                    cursor.execute(
                        """
                        INSERT INTO location_timeline_candidates (
                            location_timeline_candidate_row_id,
                            candidate_id,
                            trip_id,
                            user_id,
                            candidate_type,
                            reference_id,
                            started_at,
                            ended_at,
                            title,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            %(row_id)s,
                            %(candidate_id)s,
                            %(trip_id)s,
                            %(user_id)s,
                            %(candidate_type)s,
                            %(reference_id)s,
                            %(started_at)s,
                            %(ended_at)s,
                            %(title)s,
                            %(created_at)s,
                            %(updated_at)s
                        )
                        ON CONFLICT (candidate_id) DO UPDATE
                        SET trip_id = EXCLUDED.trip_id,
                            user_id = EXCLUDED.user_id,
                            candidate_type = EXCLUDED.candidate_type,
                            reference_id = EXCLUDED.reference_id,
                            started_at = EXCLUDED.started_at,
                            ended_at = EXCLUDED.ended_at,
                            title = EXCLUDED.title,
                            updated_at = EXCLUDED.updated_at
                        """,
                        {
                            "row_id": str(uuid4()),
                            "candidate_id": candidate.candidate_id,
                            "trip_id": candidate.trip_id,
                            "user_id": candidate.user_id,
                            "candidate_type": candidate.candidate_type,
                            "reference_id": candidate.reference_id,
                            "started_at": candidate.started_at,
                            "ended_at": candidate.ended_at,
                            "title": candidate.title,
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
