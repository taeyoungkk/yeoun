from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import asin, cos, radians, sin, sqrt

from app.config import Settings
from app.schemas.location import LocationLogRequestItem, LocationPreprocessSummary


@dataclass(frozen=True)
class _Point:
    log: LocationLogRequestItem
    latitude: float
    longitude: float
    accuracy_m: float
    speed_mps: float | None
    recorded_at: datetime


class LocationPreprocessor:
    """First-stage GPS preprocessing.

    Rules:
    - sort by recordedAt
    - drop exact/near duplicates
    - filter low-quality points by accuracy threshold
    - filter abnormal jumps by inferred speed threshold
    """

    def __init__(self, settings: Settings):
        self.accuracy_threshold_m = settings.gps_accuracy_threshold_m
        self.jump_speed_threshold_mps = settings.gps_jump_speed_threshold_mps

    def preprocess(
        self,
        logs: list[LocationLogRequestItem],
        *,
        accepted_count: int,
        duplicate_count: int,
        stored_count: int,
    ) -> LocationPreprocessSummary:
        sorted_points = [self._to_point(log) for log in sorted(logs, key=self._sort_key)]

        filtered_accuracy_count = 0
        filtered_duplicate_count = 0
        filtered_jump_count = 0
        clean_points: list[_Point] = []
        seen_client_log_uuid: set[str] = set()

        for point in sorted_points:
            if point.log.client_log_uuid in seen_client_log_uuid:
                filtered_duplicate_count += 1
                continue

            seen_client_log_uuid.add(point.log.client_log_uuid)

            if point.accuracy_m > self.accuracy_threshold_m:
                filtered_accuracy_count += 1
                continue

            if clean_points and self._is_duplicate_point(clean_points[-1], point):
                filtered_duplicate_count += 1
                continue

            if clean_points and self._is_jump_outlier(clean_points[-1], point):
                filtered_jump_count += 1
                continue

            clean_points.append(point)

        return LocationPreprocessSummary(
            acceptedCount=accepted_count,
            duplicateCount=duplicate_count,
            storedCount=stored_count,
            preprocessedCount=len(clean_points),
            filteredAccuracyCount=filtered_accuracy_count,
            filteredDuplicateCount=filtered_duplicate_count,
            filteredJumpCount=filtered_jump_count,
        )

    def _sort_key(self, log: LocationLogRequestItem) -> tuple[datetime, str]:
        return (log.recorded_at, log.client_log_uuid)

    def _to_point(self, log: LocationLogRequestItem) -> _Point:
        return _Point(
            log=log,
            latitude=float(log.latitude),
            longitude=float(log.longitude),
            accuracy_m=float(log.accuracy_m),
            speed_mps=float(log.speed_mps) if log.speed_mps is not None else None,
            recorded_at=log.recorded_at,
        )

    def _is_duplicate_point(self, previous: _Point, current: _Point) -> bool:
        same_time = previous.recorded_at == current.recorded_at
        same_lat = abs(previous.latitude - current.latitude) < 0.000001
        same_lng = abs(previous.longitude - current.longitude) < 0.000001
        return same_time and same_lat and same_lng

    def _is_jump_outlier(self, previous: _Point, current: _Point) -> bool:
        time_delta_seconds = (current.recorded_at - previous.recorded_at).total_seconds()
        if time_delta_seconds <= 0:
            return False

        if current.speed_mps is not None and current.speed_mps > self.jump_speed_threshold_mps:
            return True

        distance_m = self._haversine_distance_m(
            previous.latitude,
            previous.longitude,
            current.latitude,
            current.longitude,
        )
        inferred_speed_mps = distance_m / time_delta_seconds
        return inferred_speed_mps > self.jump_speed_threshold_mps

    def _haversine_distance_m(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        earth_radius_m = 6_371_000
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lng = radians(lng2 - lng1)

        a = (
            sin(delta_lat / 2) ** 2
            + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
        )
        c = 2 * asin(sqrt(a))
        return earth_radius_m * c
