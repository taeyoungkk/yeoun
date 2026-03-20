from __future__ import annotations

import json

from psycopg import Connection

from app.schemas.photo import PhotoTimelineCandidate


class PhotoEventLinkWriter:
    def replace_for_photo(
        self,
        photo_id: str,
        candidates: list[PhotoTimelineCandidate],
        *,
        connection: Connection,
    ) -> int:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM photo_event_links
                WHERE photo_id = %(photo_id)s
                """,
                {
                    "photo_id": photo_id,
                },
            )

            persisted_count = 0
            for candidate in candidates:
                cursor.execute(
                    """
                    INSERT INTO photo_event_links (
                        candidate_id,
                        trip_id,
                        photo_id,
                        place_id,
                        event_type,
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
                        %(candidate_id)s,
                        %(trip_id)s,
                        %(photo_id)s,
                        %(place_id)s,
                        %(event_type)s,
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
                    SET trip_id = EXCLUDED.trip_id,
                        photo_id = EXCLUDED.photo_id,
                        place_id = EXCLUDED.place_id,
                        event_type = EXCLUDED.event_type,
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
                        "candidate_id": candidate.candidate_id,
                        "trip_id": candidate.trip_id,
                        "photo_id": candidate.photo_id,
                        "place_id": candidate.place_id,
                        "event_type": candidate.candidate_type,
                        "day_date": candidate.day_date,
                        "title": candidate.title,
                        "start_at": candidate.start_at,
                        "end_at": candidate.end_at,
                        "is_representative": candidate.is_representative,
                        "sort_order": candidate.sort_order,
                        "metadata_json": json.dumps(candidate.metadata, ensure_ascii=False),
                        "created_at": candidate.start_at,
                        "updated_at": candidate.end_at,
                    },
                )
                persisted_count += 1

        return persisted_count
