from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from typing import Iterable
from uuid import uuid4

from app.schemas.location import (
    LocationCleanLog,
    LocationMoveSegment,
    LocationRouteDay,
    LocationStaySegment,
)


class LocationRouteBuilder:
    """Build move segments and per-day routes from clean GPS logs."""

    def build_move_segments(
        self,
        trip_id: str,
        user_id: str,
        clean_logs: list[LocationCleanLog],
        stay_segments: list[LocationStaySegment],
    ) -> list[LocationMoveSegment]:
        if len(clean_logs) < 2:
            return []

        move_segments: list[LocationMoveSegment] = []
        current_logs: list[LocationCleanLog] = []

        for log in clean_logs:
            if self._is_in_stay(log, stay_segments):
                if len(current_logs) >= 2:
                    move_segments.append(self._to_move_segment(trip_id, user_id, current_logs))
                current_logs = []
                continue

            current_logs.append(log)

        if len(current_logs) >= 2:
            move_segments.append(self._to_move_segment(trip_id, user_id, current_logs))

        return move_segments

    def build_route_days(
        self,
        trip_id: str,
        user_id: str,
        move_segments: list[LocationMoveSegment],
    ) -> list[LocationRouteDay]:
        grouped: dict[str, list[LocationMoveSegment]] = defaultdict(list)
        for segment in move_segments:
            grouped[segment.started_at.date().isoformat()].append(segment)

        route_days: list[LocationRouteDay] = []
        for day, segments in sorted(grouped.items()):
            coordinates = [
                coordinate
                for segment in segments
                for coordinate in segment.coordinates
            ]
            deduped_coordinates = self._dedupe_coordinates(coordinates)
            if len(deduped_coordinates) < 2:
                continue

            total_distance = sum(float(segment.distance_m) for segment in segments)
            route_days.append(
                LocationRouteDay(
                    tripId=trip_id,
                    userId=user_id,
                    day=day,
                    startedAt=segments[0].started_at,
                    endedAt=segments[-1].ended_at,
                    pointCount=len(deduped_coordinates),
                    distanceM=Decimal(str(round(total_distance, 2))),
                    coordinates=deduped_coordinates,
                )
            )

        return route_days

    def _to_move_segment(
        self,
        trip_id: str,
        user_id: str,
        logs: list[LocationCleanLog],
    ) -> LocationMoveSegment:
        coordinates = [(log.longitude, log.latitude) for log in logs]
        distance_m = self._calculate_distance(logs)
        duration_seconds = int((logs[-1].recorded_at - logs[0].recorded_at).total_seconds())

        return LocationMoveSegment(
            segmentId=str(uuid4()),
            tripId=trip_id,
            userId=user_id,
            startedAt=logs[0].recorded_at,
            endedAt=logs[-1].recorded_at,
            durationSeconds=max(duration_seconds, 0),
            pointCount=len(logs),
            distanceM=Decimal(str(round(distance_m, 2))),
            coordinates=coordinates,
            source=logs[0].source,
        )

    def _is_in_stay(self, log: LocationCleanLog, stay_segments: list[LocationStaySegment]) -> bool:
        for segment in stay_segments:
            if segment.started_at <= log.recorded_at <= segment.ended_at:
                return True
        return False

    def _calculate_distance(self, logs: list[LocationCleanLog]) -> float:
        distance = 0.0
        for previous, current in zip(logs, logs[1:]):
            distance += self._distance_m(previous, current)
        return distance

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

    def _dedupe_coordinates(
        self,
        coordinates: Iterable[tuple[Decimal, Decimal]],
    ) -> list[tuple[Decimal, Decimal]]:
        deduped: list[tuple[Decimal, Decimal]] = []
        for coordinate in coordinates:
            if deduped and deduped[-1] == coordinate:
                continue
            deduped.append(coordinate)
        return deduped
