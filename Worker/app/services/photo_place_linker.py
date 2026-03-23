from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from psycopg import Connection
from psycopg.errors import UndefinedTable

from app.schemas.photo import (
    PhotoPlaceLink,
    PhotoProcessingResultMessage,
    PhotoRepresentativeSelection,
)


@dataclass(slots=True)
class _MatchedPhotoRow:
    photo_id: str
    metadata: dict
    width: int | None
    height: int | None
    taken_at: datetime | None
    created_at: datetime


class PhotoPlaceLinker:
    def link_and_select(
        self,
        result: PhotoProcessingResultMessage,
        *,
        connection: Connection,
    ) -> PhotoProcessingResultMessage:
        if result.gps_match is None or not result.gps_match.matched_place_id:
            return result

        place_id = result.gps_match.matched_place_id
        selected_at = result.processed_at
        place_link = PhotoPlaceLink(
            placeId=place_id,
            linkedBy="GPS_MATCH",
            matchType=result.gps_match.match_type,
            score=result.gps_match.score,
            linkedAt=selected_at,
        )

        try:
            rows = self._load_place_photos(connection, result.trip_id, place_id)
        except UndefinedTable:
            return result

        if not rows:
            return result

        ranked_rows = self._rank_rows(rows)
        representative_by_photo_id: dict[str, PhotoRepresentativeSelection] = {}
        for index, row in enumerate(ranked_rows, start=1):
            representative_by_photo_id[row.photo_id] = PhotoRepresentativeSelection(
                scope="PLACE",
                scopeId=place_id,
                isRepresentative=index == 1,
                rank=index,
                selectedAt=selected_at,
                selectionReason="GPS_MATCH_SCORE_THEN_RESOLUTION",
            )

        with connection.cursor() as cursor:
            for row in ranked_rows:
                merged_metadata = dict(row.metadata)
                merged_metadata["placeLink"] = place_link.model_dump(mode="json", by_alias=True)
                merged_metadata["representativeSelection"] = representative_by_photo_id[row.photo_id].model_dump(
                    mode="json",
                    by_alias=True,
                )
                cursor.execute(
                    """
                    UPDATE photos
                    SET metadata_json = %(metadata_json)s::jsonb,
                        updated_at = %(updated_at)s
                    WHERE photo_id = %(photo_id)s
                    """,
                    {
                        "photo_id": row.photo_id,
                        "metadata_json": json.dumps(merged_metadata, ensure_ascii=False),
                        "updated_at": selected_at,
                    },
                )

        current_selection = representative_by_photo_id.get(result.photo_id)
        if current_selection is None:
            return result

        enriched_metadata = dict(result.metadata)
        enriched_metadata["placeLink"] = place_link.model_dump(mode="json", by_alias=True)
        enriched_metadata["representativeSelection"] = current_selection.model_dump(mode="json", by_alias=True)

        return result.model_copy(
            update={
                "placeLink": place_link,
                "representativeSelection": current_selection,
                "metadata": enriched_metadata,
            }
        )

    def _load_place_photos(self, connection: Connection, trip_id: str, place_id: str) -> list[_MatchedPhotoRow]:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT photo_id::text,
                       metadata_json,
                       width,
                       height,
                       taken_at,
                       created_at
                FROM photos
                WHERE trip_id = %(trip_id)s
                  AND is_excluded = FALSE
                  AND metadata_json IS NOT NULL
                  AND metadata_json -> 'gpsMatch' ->> 'matchedPlaceId' = %(place_id)s
                """,
                {
                    "trip_id": trip_id,
                    "place_id": place_id,
                },
            )
            records = cursor.fetchall()

        rows: list[_MatchedPhotoRow] = []
        for photo_id, metadata_json, width, height, taken_at, created_at in records:
            metadata = metadata_json if isinstance(metadata_json, dict) else json.loads(metadata_json)
            rows.append(
                _MatchedPhotoRow(
                    photo_id=photo_id,
                    metadata=metadata,
                    width=width,
                    height=height,
                    taken_at=self._ensure_utc(taken_at),
                    created_at=self._ensure_utc(created_at) or datetime.now(timezone.utc),
                )
            )
        return rows

    def _rank_rows(self, rows: list[_MatchedPhotoRow]) -> list[_MatchedPhotoRow]:
        def sort_key(row: _MatchedPhotoRow):
            gps_match = row.metadata.get("gpsMatch") or {}
            score = float(gps_match.get("score", 0))
            resolution = (row.width or 0) * (row.height or 0)
            taken_at = row.taken_at or row.created_at
            return (-score, -resolution, taken_at, row.photo_id)

        return sorted(rows, key=sort_key)

    def _ensure_utc(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
