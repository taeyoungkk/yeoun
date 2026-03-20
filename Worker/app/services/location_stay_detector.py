from __future__ import annotations

from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from uuid import uuid4

from app.config import Settings
from app.schemas.location import LocationCleanLog, LocationStaySegment


class LocationStayDetector:
    """Detects contiguous stay segments from clean GPS logs."""

    def __init__(self, settings: Settings):
        self.stay_radius_m = settings.gps_stay_radius_m
        self.stay_min_duration_seconds = settings.gps_stay_min_duration_seconds

    def detect(self, trip_id: str, user_id: str, clean_logs: list[LocationCleanLog]) -> list[LocationStaySegment]:
        if len(clean_logs) < 2:
            return []

        stay_segments: list[LocationStaySegment] = []
        index = 0

        while index < len(clean_logs) - 1:
            start_log = clean_logs[index]
            window_logs = [start_log]
            next_index = index + 1

            while next_index < len(clean_logs):
                candidate = clean_logs[next_index]
                if self._distance_m(start_log, candidate) > self.stay_radius_m:
                    break
                window_logs.append(candidate)
                next_index += 1

            duration_seconds = int((window_logs[-1].recorded_at - start_log.recorded_at).total_seconds())
            if len(window_logs) >= 2 and duration_seconds >= self.stay_min_duration_seconds:
                stay_segments.append(
                    self._build_segment(
                        trip_id=trip_id,
                        user_id=user_id,
                        logs=window_logs,
                        duration_seconds=duration_seconds,
                    )
                )
                index = next_index
                continue

            index += 1

        return stay_segments

    def _build_segment(
        self,
        *,
        trip_id: str,
        user_id: str,
        logs: list[LocationCleanLog],
        duration_seconds: int,
    ) -> LocationStaySegment:
        center_latitude = sum(float(log.latitude) for log in logs) / len(logs)
        center_longitude = sum(float(log.longitude) for log in logs) / len(logs)

        return LocationStaySegment(
            segmentId=str(uuid4()),
            tripId=trip_id,
            userId=user_id,
            startedAt=logs[0].recorded_at,
            endedAt=logs[-1].recorded_at,
            durationSeconds=duration_seconds,
            centerLatitude=Decimal(str(round(center_latitude, 7))),
            centerLongitude=Decimal(str(round(center_longitude, 7))),
            pointCount=len(logs),
            source=logs[0].source,
        )

    def _distance_m(self, left: LocationCleanLog, right: LocationCleanLog) -> float:
        earth_radius_m = 6_371_000
        lat1_rad = radians(float(left.latitude))
        lat2_rad = radians(float(right.latitude))
        delta_lat = radians(float(right.latitude) - float(left.latitude))
        delta_lng = radians(float(right.longitude) - float(left.longitude))

        a = (
            sin(delta_lat / 2) ** 2
            + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
        )
        c = 2 * asin(sqrt(a))
        return earth_radius_m * c
