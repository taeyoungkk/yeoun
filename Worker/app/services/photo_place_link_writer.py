from __future__ import annotations

from psycopg import Connection

from app.schemas.photo import PhotoProcessingResultMessage


class PhotoPlaceLinkWriter:
    def save(
        self,
        result: PhotoProcessingResultMessage,
        *,
        connection: Connection,
    ) -> int:
        with connection.cursor() as cursor:
            if result.place_link is None or result.representative_selection is None:
                cursor.execute(
                    """
                    DELETE FROM photo_place_links
                    WHERE photo_id = %(photo_id)s
                    """,
                    {
                        "photo_id": result.photo_id,
                    },
                )
                return cursor.rowcount

            cursor.execute(
                """
                INSERT INTO photo_place_links (
                    photo_id,
                    trip_id,
                    place_id,
                    linked_by,
                    match_type,
                    score,
                    linked_at,
                    representative_scope,
                    representative_scope_id,
                    is_representative,
                    representative_rank,
                    selection_reason,
                    selected_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    %(photo_id)s,
                    %(trip_id)s,
                    %(place_id)s,
                    %(linked_by)s,
                    %(match_type)s,
                    %(score)s,
                    %(linked_at)s,
                    %(representative_scope)s,
                    %(representative_scope_id)s,
                    %(is_representative)s,
                    %(representative_rank)s,
                    %(selection_reason)s,
                    %(selected_at)s,
                    %(created_at)s,
                    %(updated_at)s
                )
                ON CONFLICT (photo_id) DO UPDATE
                SET trip_id = EXCLUDED.trip_id,
                    place_id = EXCLUDED.place_id,
                    linked_by = EXCLUDED.linked_by,
                    match_type = EXCLUDED.match_type,
                    score = EXCLUDED.score,
                    linked_at = EXCLUDED.linked_at,
                    representative_scope = EXCLUDED.representative_scope,
                    representative_scope_id = EXCLUDED.representative_scope_id,
                    is_representative = EXCLUDED.is_representative,
                    representative_rank = EXCLUDED.representative_rank,
                    selection_reason = EXCLUDED.selection_reason,
                    selected_at = EXCLUDED.selected_at,
                    updated_at = EXCLUDED.updated_at
                """,
                {
                    "photo_id": result.photo_id,
                    "trip_id": result.trip_id,
                    "place_id": result.place_link.place_id,
                    "linked_by": result.place_link.linked_by,
                    "match_type": result.place_link.match_type,
                    "score": result.place_link.score,
                    "linked_at": result.place_link.linked_at,
                    "representative_scope": result.representative_selection.scope,
                    "representative_scope_id": result.representative_selection.scope_id,
                    "is_representative": result.representative_selection.is_representative,
                    "representative_rank": result.representative_selection.rank,
                    "selection_reason": result.representative_selection.selection_reason,
                    "selected_at": result.representative_selection.selected_at,
                    "created_at": result.processed_at,
                    "updated_at": result.processed_at,
                },
            )
            return 1
