import json
from datetime import datetime, timezone
from uuid import uuid4

from psycopg import Connection

from app.schemas.photo import PhotoTimelineCandidate


class PhotoTimelineCandidateWriter:
    def save_batch(self, candidates: list[PhotoTimelineCandidate], *, connection: Connection) -> int:
        if not candidates:
            return 0

        persisted_count = 0
        now = datetime.now(timezone.utc)

        with connection.cursor() as cursor:
            for candidate in candidates:
                cursor.execute(
                    """
                    INSERT INTO photo_timeline_candidates (
                        photo_timeline_candidate_row_id,
                        candidate_id,
                        trip_id,
                        photo_id,
                        place_id,
                        candidate_type,
                        day_date,
                        title,
                        start_at,
                        end_at,
                        is_representative,
                        sort_order,
                        metadata_json,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %(row_id)s,
                        %(candidate_id)s,
                        %(trip_id)s,
                        %(photo_id)s,
                        %(place_id)s,
                        %(candidate_type)s,
                        %(day_date)s,
                        %(title)s,
                        %(start_at)s,
                        %(end_at)s,
                        %(is_representative)s,
                        %(sort_order)s,
                        %(metadata_json)s::jsonb,
                        %(created_at)s,
                        %(updated_at)s
                    )
                    ON CONFLICT (candidate_id) DO UPDATE
                    SET place_id = EXCLUDED.place_id,
                        candidate_type = EXCLUDED.candidate_type,
                        day_date = EXCLUDED.day_date,
                        title = EXCLUDED.title,
                        start_at = EXCLUDED.start_at,
                        end_at = EXCLUDED.end_at,
                        is_representative = EXCLUDED.is_representative,
                        sort_order = EXCLUDED.sort_order,
                        metadata_json = EXCLUDED.metadata_json,
                        updated_at = EXCLUDED.updated_at
                    """,
                    {
                        "row_id": str(uuid4()),
                        "candidate_id": candidate.candidate_id,
                        "trip_id": candidate.trip_id,
                        "photo_id": candidate.photo_id,
                        "place_id": candidate.place_id,
                        "candidate_type": candidate.candidate_type,
                        "day_date": candidate.day_date,
                        "title": candidate.title,
                        "start_at": candidate.start_at,
                        "end_at": candidate.end_at,
                        "is_representative": candidate.is_representative,
                        "sort_order": candidate.sort_order,
                        "metadata_json": json.dumps(candidate.metadata, ensure_ascii=False),
                        "created_at": now,
                        "updated_at": now,
                    },
                )
                persisted_count += 1

        return persisted_count
