from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

import psycopg

from app.config import Settings
from app.schemas.photo import PhotoCoordinates, PhotoProcessingResultMessage
from app.services.photo_gps_matcher import PhotoGpsMatcherService
from app.services.photo_processing_pipeline import PhotoProcessingPipeline
from app.services.photo_processing_status import PhotoProcessingStatusWriter


@dataclass(slots=True)
class PhotoRebuildSummary:
    trip_id: str
    requested_count: int
    rebuilt_count: int
    failed_count: int
    failed_photo_ids: list[str]


class PhotoRebuildPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.processing_pipeline = PhotoProcessingPipeline(settings)
        self.gps_matcher = PhotoGpsMatcherService(settings)
        self.status_writer = PhotoProcessingStatusWriter(settings)

    def rebuild_trip(self, trip_id: str) -> PhotoRebuildSummary:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for photo rebuild pipeline.")

        rows = self._load_trip_photos(trip_id)
        rebuilt_count = 0
        failed_photo_ids: list[str] = []

        for row in rows:
            self.status_writer.mark_processing(
                row.photo_id,
                row.trip_id,
                requested_at=row.updated_at,
                attempt=0,
            )
            try:
                result = self._build_result_from_row(row)
                gps_match = self.gps_matcher.match(result)
                enriched = result.model_copy(
                    update={
                        "gpsMatch": gps_match,
                        "metadata": {
                            **result.metadata,
                            "gpsMatch": gps_match.model_dump(mode="json", by_alias=True) if gps_match else None,
                            "rebuildTriggeredAt": self._utcnow().isoformat(),
                        },
                    }
                )
                self.processing_pipeline.persist_and_link(enriched)
                self.status_writer.mark_ready(
                    row.photo_id,
                    row.trip_id,
                    requested_at=row.updated_at,
                    attempt=0,
                )
                rebuilt_count += 1
            except Exception as exc:
                self.status_writer.mark_dlq(
                    row.photo_id,
                    row.trip_id,
                    requested_at=row.updated_at,
                    attempt=0,
                    error_code=type(exc).__name__,
                    error_message=str(exc),
                )
                failed_photo_ids.append(row.photo_id)

        return PhotoRebuildSummary(
            trip_id=trip_id,
            requested_count=len(rows),
            rebuilt_count=rebuilt_count,
            failed_count=len(failed_photo_ids),
            failed_photo_ids=failed_photo_ids,
        )

    def _load_trip_photos(self, trip_id: str) -> list["_PhotoRow"]:
        with psycopg.connect(self.settings.worker_database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT photo_id::text,
                           trip_id::text,
                           owner_user_id::text,
                           storage_key,
                           thumbnail_key,
                           content_type,
                           file_name,
                           taken_at,
                           exif_latitude,
                           exif_longitude,
                           width,
                           height,
                           metadata_json,
                           updated_at
                    FROM photos
                    WHERE trip_id = %(trip_id)s
                      AND is_excluded = FALSE
                    ORDER BY taken_at NULLS LAST, created_at ASC
                    """,
                    {
                        "trip_id": trip_id,
                    },
                )
                records = cursor.fetchall()

        rows: list[_PhotoRow] = []
        for record in records:
            metadata_json = record[12] or {}
            metadata = metadata_json if isinstance(metadata_json, dict) else json.loads(metadata_json)
            rows.append(
                _PhotoRow(
                    photo_id=record[0],
                    trip_id=record[1],
                    owner_user_id=record[2],
                    storage_key=record[3],
                    thumbnail_key=record[4],
                    content_type=record[5],
                    file_name=record[6],
                    taken_at=self._ensure_utc(record[7]),
                    exif_latitude=self._to_float(record[8]),
                    exif_longitude=self._to_float(record[9]),
                    width=record[10],
                    height=record[11],
                    metadata=metadata,
                    updated_at=self._ensure_utc(record[13]) or self._utcnow(),
                )
            )
        return rows

    def _build_result_from_row(self, row: "_PhotoRow") -> PhotoProcessingResultMessage:
        coordinates = None
        if row.exif_latitude is not None and row.exif_longitude is not None:
            coordinates = PhotoCoordinates(latitude=row.exif_latitude, longitude=row.exif_longitude)

        normalized_taken_at = self._parse_datetime(row.metadata.get("normalizedTakenAt")) or row.taken_at
        normalized_coordinates = self._parse_coordinates(row.metadata.get("normalizedCoordinates")) or coordinates

        return PhotoProcessingResultMessage(
            photoId=row.photo_id,
            tripId=row.trip_id,
            ownerUserId=row.owner_user_id,
            status="COMPLETED",
            storageKey=row.storage_key,
            thumbnailKey=row.thumbnail_key,
            contentType=row.content_type,
            fileName=row.file_name,
            takenAt=row.taken_at,
            normalizedTakenAt=normalized_taken_at,
            coordinates=coordinates,
            normalizedCoordinates=normalized_coordinates,
            width=row.width,
            height=row.height,
            metadata={k: v for k, v in row.metadata.items() if k not in {"gpsMatch", "placeLink", "representativeSelection", "timelineCandidates", "manualReviewCandidates"}},
            processedAt=self._utcnow(),
            attempt=0,
        )

    def _parse_datetime(self, value: str | None) -> datetime | None:
        if not value:
            return None
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return self._ensure_utc(parsed)

    def _parse_coordinates(self, value: dict | None) -> PhotoCoordinates | None:
        if not value:
            return None
        latitude = value.get("latitude")
        longitude = value.get("longitude")
        if latitude is None or longitude is None:
            return None
        return PhotoCoordinates(latitude=float(latitude), longitude=float(longitude))

    def _to_float(self, value: Decimal | float | None) -> float | None:
        if value is None:
            return None
        return float(value)

    def _ensure_utc(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)


@dataclass(slots=True)
class _PhotoRow:
    photo_id: str
    trip_id: str
    owner_user_id: str
    storage_key: str | None
    thumbnail_key: str | None
    content_type: str | None
    file_name: str | None
    taken_at: datetime | None
    exif_latitude: float | None
    exif_longitude: float | None
    width: int | None
    height: int | None
    metadata: dict
    updated_at: datetime
