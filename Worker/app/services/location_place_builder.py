from __future__ import annotations

from decimal import Decimal
from hashlib import sha1
from math import asin, cos, radians, sin, sqrt
from uuid import NAMESPACE_URL, uuid5

from app.config import Settings
from app.schemas.location import LocationPlaceCandidate, LocationStaySegment


class LocationPlaceBuilder:
    """Build and merge place candidates from stay segments."""

    def __init__(self, settings: Settings):
        self.place_merge_radius_m = settings.gps_place_merge_radius_m

    def build(
        self,
        trip_id: str,
        user_id: str,
        stay_segments: list[LocationStaySegment],
    ) -> list[LocationPlaceCandidate]:
        if not stay_segments:
            return []

        sorted_segments = sorted(stay_segments, key=lambda segment: (segment.started_at, segment.segment_id))
        merged_places: list[LocationPlaceCandidate] = []
        current_group: list[LocationStaySegment] = [sorted_segments[0]]

        for segment in sorted_segments[1:]:
            if self._can_merge(current_group[-1], segment):
                current_group.append(segment)
                continue

            merged_places.append(self._to_place_candidate(trip_id, user_id, current_group))
            current_group = [segment]

        merged_places.append(self._to_place_candidate(trip_id, user_id, current_group))
        return merged_places

    def _can_merge(self, left: LocationStaySegment, right: LocationStaySegment) -> bool:
        return self._distance_m(left, right) <= self.place_merge_radius_m

    def _to_place_candidate(
        self,
        trip_id: str,
        user_id: str,
        segments: list[LocationStaySegment],
    ) -> LocationPlaceCandidate:
        center_latitude = sum(float(segment.center_latitude) for segment in segments) / len(segments)
        center_longitude = sum(float(segment.center_longitude) for segment in segments) / len(segments)
        total_duration_seconds = sum(segment.duration_seconds for segment in segments)
        started_at = min(segment.started_at for segment in segments)
        ended_at = max(segment.ended_at for segment in segments)
        rounded_center_latitude = Decimal(str(round(center_latitude, 7)))
        rounded_center_longitude = Decimal(str(round(center_longitude, 7)))

        return LocationPlaceCandidate(
            placeId=self._build_place_id(
                trip_id=trip_id,
                user_id=user_id,
                segments=segments,
                center_latitude=rounded_center_latitude,
                center_longitude=rounded_center_longitude,
                started_at=started_at.isoformat(),
                ended_at=ended_at.isoformat(),
            ),
            tripId=trip_id,
            userId=user_id,
            startedAt=started_at,
            endedAt=ended_at,
            durationSeconds=total_duration_seconds,
            centerLatitude=rounded_center_latitude,
            centerLongitude=rounded_center_longitude,
            staySegmentCount=len(segments),
            source=segments[0].source,
        )

    def _build_place_id(
        self,
        *,
        trip_id: str,
        user_id: str,
        segments: list[LocationStaySegment],
        center_latitude: Decimal,
        center_longitude: Decimal,
        started_at: str,
        ended_at: str,
    ) -> str:
        segment_key = "|".join(segment.segment_id for segment in segments)
        segment_hash = sha1(segment_key.encode("utf-8")).hexdigest()
        fingerprint = (
            f"{trip_id}:{user_id}:{center_latitude}:{center_longitude}:"
            f"{started_at}:{ended_at}:{segment_hash}"
        )
        return str(uuid5(NAMESPACE_URL, fingerprint))

    def _distance_m(self, left: LocationStaySegment, right: LocationStaySegment) -> float:
        earth_radius_m = 6_371_000
        lat1_rad = radians(float(left.center_latitude))
        lat2_rad = radians(float(right.center_latitude))
        delta_lat = radians(float(right.center_latitude) - float(left.center_latitude))
        delta_lng = radians(float(right.center_longitude) - float(left.center_longitude))

        a = (
            sin(delta_lat / 2) ** 2
            + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
        )
        c = 2 * asin(sqrt(a))
        return earth_radius_m * c
