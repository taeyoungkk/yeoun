from __future__ import annotations

import json

from psycopg import Connection

from app.schemas.photo import PhotoManualReviewCandidate


class PhotoManualReviewCandidateWriter:
    def replace_for_photo(
        self,
        photo_id: str,
        candidates: list[PhotoManualReviewCandidate],
        *,
        connection: Connection,
    ) -> int:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM photo_manual_review_candidates
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
                    INSERT INTO photo_manual_review_candidates (
                        candidate_id,
                        trip_id,
                        photo_id,
                        review_status,
                        review_reason,
                        confidence_score,
                        suggested_place_id,
                        suggested_client_log_uuid,
                        suggested_recorded_at,
                        metadata_json,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %(candidate_id)s,
                        %(trip_id)s,
                        %(photo_id)s,
                        %(review_status)s,
                        %(review_reason)s,
                        %(confidence_score)s,
                        %(suggested_place_id)s,
                        %(suggested_client_log_uuid)s,
                        %(suggested_recorded_at)s,
                        %(metadata_json)s::jsonb,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (candidate_id) DO UPDATE
                    SET review_status = EXCLUDED.review_status,
                        review_reason = EXCLUDED.review_reason,
                        confidence_score = EXCLUDED.confidence_score,
                        suggested_place_id = EXCLUDED.suggested_place_id,
                        suggested_client_log_uuid = EXCLUDED.suggested_client_log_uuid,
                        suggested_recorded_at = EXCLUDED.suggested_recorded_at,
                        metadata_json = EXCLUDED.metadata_json,
                        updated_at = NOW()
                    """,
                    {
                        "candidate_id": candidate.candidate_id,
                        "trip_id": candidate.trip_id,
                        "photo_id": candidate.photo_id,
                        "review_status": candidate.review_status,
                        "review_reason": candidate.review_reason,
                        "confidence_score": candidate.confidence_score,
                        "suggested_place_id": candidate.suggested_place_id,
                        "suggested_client_log_uuid": candidate.suggested_client_log_uuid,
                        "suggested_recorded_at": candidate.suggested_recorded_at,
                        "metadata_json": json.dumps(candidate.metadata, ensure_ascii=False),
                    },
                )
                persisted_count += 1

        return persisted_count
