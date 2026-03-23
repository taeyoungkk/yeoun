from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

import psycopg
from psycopg.errors import UndefinedTable

from app.config import Settings
from app.schemas.photo import PhotoCoordinates, PhotoGpsMatch, PhotoProcessingResultMessage


@dataclass(slots=True)
class _PlaceRow:
    place_id: str
    started_at: datetime
    ended_at: datetime
    center_latitude: float
    center_longitude: float


@dataclass(slots=True)
class _CleanLogRow:
    client_log_uuid: str
    recorded_at: datetime
    latitude: float
    longitude: float


class PhotoGpsMatcherService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def match(self, result: PhotoProcessingResultMessage) -> PhotoGpsMatch | None:
        if not self.settings.photo_gps_match_enabled or not self.settings.worker_database_url:
            return None

        taken_at = result.normalized_taken_at or result.taken_at
        coordinates = result.normalized_coordinates or result.coordinates
        if taken_at is None and coordinates is None:
            return None

        try:
            with psycopg.connect(self.settings.worker_database_url) as connection:
                matched_place = self._match_place(connection, result.trip_id, result.owner_user_id, taken_at, coordinates)
                if matched_place is not None:
                    distance_m = (
                        self._distance_m(
                            coordinates.latitude,
                            coordinates.longitude,
                            matched_place.center_latitude,
                            matched_place.center_longitude,
                        )
                        if coordinates is not None
                        else None
                    )
                    return PhotoGpsMatch(
                        matchType="PLACE_TIME_AND_COORDINATE" if coordinates is not None else "PLACE_TIME",
                        matchedPlaceId=matched_place.place_id,
                        matchedCoordinates=PhotoCoordinates(
                            latitude=round(matched_place.center_latitude, 6),
                            longitude=round(matched_place.center_longitude, 6),
                        ),
                        timeDiffSeconds=0 if taken_at is not None else None,
                        distanceM=distance_m,
                        score=0.95 if coordinates is not None else 0.88,
                    )

                matched_log = self._match_clean_log(connection, result.trip_id, result.owner_user_id, taken_at)
                if matched_log is None:
                    return None

                inferred_place = self._match_place(
                    connection,
                    result.trip_id,
                    result.owner_user_id,
                    matched_log.recorded_at,
                    PhotoCoordinates(latitude=matched_log.latitude, longitude=matched_log.longitude),
                )
                time_diff_seconds = abs(int((matched_log.recorded_at - taken_at).total_seconds())) if taken_at else None
                distance_m = (
                    self._distance_m(
                        coordinates.latitude,
                        coordinates.longitude,
                        matched_log.latitude,
                        matched_log.longitude,
                    )
                    if coordinates is not None
                    else None
                )
                if distance_m is not None and distance_m > self.settings.photo_gps_match_log_radius_m:
                    return None
                return PhotoGpsMatch(
                    matchType="TIME_NEAREST_GPS_LOG",
                    matchedPlaceId=inferred_place.place_id if inferred_place else None,
                    matchedClientLogUuid=matched_log.client_log_uuid,
                    matchedRecordedAt=matched_log.recorded_at,
                    matchedCoordinates=PhotoCoordinates(
                        latitude=round(matched_log.latitude, 6),
                        longitude=round(matched_log.longitude, 6),
                    ),
                    timeDiffSeconds=time_diff_seconds,
                    distanceM=distance_m,
                    score=0.82 if inferred_place else 0.72,
                )
        except UndefinedTable:
            return None

    def _match_place(
        self,
        connection: psycopg.Connection,
        trip_id: str,
        user_id: str,
        taken_at: datetime | None,
        coordinates: PhotoCoordinates | None,
    ) -> _PlaceRow | None:
        if taken_at is None and coordinates is None:
            return None

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT place_id, started_at, ended_at, center_latitude::float8, center_longitude::float8
                FROM location_places
                WHERE trip_id = %(trip_id)s
                  AND user_id = %(user_id)s
                ORDER BY started_at ASC
                """,
                {
                    "trip_id": trip_id,
                    "user_id": user_id,
                },
            )
            rows = [
                _PlaceRow(
                    place_id=row[0],
                    started_at=self._ensure_utc(row[1]),
                    ended_at=self._ensure_utc(row[2]),
                    center_latitude=float(row[3]),
                    center_longitude=float(row[4]),
                )
                for row in cursor.fetchall()
            ]

        candidates: list[tuple[float, _PlaceRow]] = []
        for row in rows:
            if taken_at is not None and not (row.started_at <= taken_at <= row.ended_at):
                continue
            if coordinates is not None:
                distance_m = self._distance_m(
                    coordinates.latitude,
                    coordinates.longitude,
                    row.center_latitude,
                    row.center_longitude,
                )
                if distance_m > self.settings.photo_gps_match_place_radius_m:
                    continue
                candidates.append((distance_m, row))
            else:
                candidates.append((0.0, row))

        if not candidates:
            return None

        candidates.sort(key=lambda item: item[0])
        return candidates[0][1]

    def _match_clean_log(
        self,
        connection: psycopg.Connection,
        trip_id: str,
        user_id: str,
        taken_at: datetime | None,
    ) -> _CleanLogRow | None:
        if taken_at is None:
            return None

        start_at = taken_at - timedelta(seconds=self.settings.photo_gps_match_time_window_seconds)
        end_at = taken_at + timedelta(seconds=self.settings.photo_gps_match_time_window_seconds)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT client_log_uuid,
                       recorded_at,
                       latitude::float8,
                       longitude::float8
                FROM location_logs_clean
                WHERE trip_id = %(trip_id)s
                  AND user_id = %(user_id)s
                  AND recorded_at BETWEEN %(start_at)s AND %(end_at)s
                ORDER BY ABS(EXTRACT(EPOCH FROM (recorded_at - %(taken_at)s))) ASC,
                         recorded_at ASC
                LIMIT 1
                """,
                {
                    "trip_id": trip_id,
                    "user_id": user_id,
                    "start_at": self._ensure_utc(start_at),
                    "end_at": self._ensure_utc(end_at),
                    "taken_at": self._ensure_utc(taken_at),
                },
            )
            row = cursor.fetchone()

        if row is None:
            return None

        return _CleanLogRow(
            client_log_uuid=row[0],
            recorded_at=self._ensure_utc(row[1]),
            latitude=float(row[2]),
            longitude=float(row[3]),
        )

    def _distance_m(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        earth_radius_m = 6_371_000
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lng = radians(lng2 - lng1)

        a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
        c = 2 * asin(sqrt(a))
        return earth_radius_m * c

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
