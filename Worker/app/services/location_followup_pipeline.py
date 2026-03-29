import logging
from datetime import date, datetime
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo

from psycopg import Connection

from app.config import Settings
from app.schemas.location import (
    LocationCleanLog,
    LocationLogBatchStoredEvent,
    LocationPreprocessSummary,
    LocationRouteDay,
)
from app.services.location_map_matcher import LocationMapMatcher
from app.services.location_place_builder import LocationPlaceBuilder
from app.services.location_place_writer import LocationPlaceWriter
from app.services.location_route_builder import LocationRouteBuilder
from app.services.location_route_writer import LocationRouteDayWriter
from app.services.location_stay_detector import LocationStayDetector
from app.services.location_timeline_candidate_writer import LocationTimelineCandidateWriter
from app.services.location_timeline_linker import LocationTimelineLinker

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")


def _route_distance_km(coordinates: list[tuple[Decimal, Decimal]]) -> float:
    if len(coordinates) < 2:
        return 0.0

    total_m = 0.0
    for (left_lng, left_lat), (right_lng, right_lat) in zip(coordinates, coordinates[1:]):
        total_m += _haversine_distance_m(
            float(left_lat),
            float(left_lng),
            float(right_lat),
            float(right_lng),
        )

    return total_m / 1000


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
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


def _should_keep_raw_route(
    raw_coordinates: list[tuple[Decimal, Decimal]],
    matched_coordinates: list[tuple[Decimal, Decimal]],
) -> bool:
    if len(raw_coordinates) < 2:
        return False

    if len(matched_coordinates) < 2:
        return True

    raw_distance_km = _route_distance_km(raw_coordinates)
    matched_distance_km = _route_distance_km(matched_coordinates)

    if len(raw_coordinates) >= 6 and len(matched_coordinates) <= 3:
        return True

    if len(raw_coordinates) >= 8 and len(matched_coordinates) / len(raw_coordinates) < 0.35:
        return True

    if raw_distance_km > 0.2 and matched_distance_km / raw_distance_km < 0.55:
        return True

    return False


class LocationFollowupPipeline:
    """Placeholder for downstream GPS processing stages.

    The next stages such as clean GPS persistence, stay detection, route
    generation, and place generation should be connected here.
    """

    def __init__(self, settings: Settings):
        self.stay_detector = LocationStayDetector(settings)
        self.route_builder = LocationRouteBuilder()
        self.map_matcher = LocationMapMatcher(settings)
        self.place_builder = LocationPlaceBuilder(settings)
        self.route_writer = LocationRouteDayWriter(settings)
        self.place_writer = LocationPlaceWriter(settings)
        self.timeline_linker = LocationTimelineLinker()
        self.timeline_writer = LocationTimelineCandidateWriter(settings)

    async def run(
        self,
        payload: LocationLogBatchStoredEvent,
        clean_logs: list[LocationCleanLog],
        summary: LocationPreprocessSummary,
        *,
        connection: Connection | None = None,
    ) -> LocationPreprocessSummary:
        stay_segments = self.stay_detector.detect(payload.trip_id, payload.user_id, clean_logs)
        move_segments = self.route_builder.build_move_segments(
            payload.trip_id,
            payload.user_id,
            clean_logs,
            stay_segments,
        )
        route_days = self.route_builder.build_route_days(
            payload.trip_id,
            payload.user_id,
            clean_logs,
        )
        route_days = self._clamp_route_days_to_trip_range(
            payload.trip_id,
            route_days,
            connection=connection,
        )
        route_days, map_matched_route_day_count, route_day_fallback_count = await self._apply_map_matching(route_days)
        places = self.place_builder.build(
            payload.trip_id,
            payload.user_id,
            stay_segments,
        )
        route_persisted_count = self.route_writer.save_batch(route_days, connection=connection)
        place_persisted_count = self.place_writer.save_batch(places, connection=connection)
        timeline_candidates = self.timeline_linker.build_candidates(
            payload.trip_id,
            payload.user_id,
            route_days,
            places,
        )
        timeline_candidate_persisted_count = self.timeline_writer.save_batch(
            timeline_candidates,
            connection=connection,
        )
        updated_summary = summary.model_copy(
            update={
                "stay_segment_count": len(stay_segments),
                "move_segment_count": len(move_segments),
                "route_day_count": len(route_days),
                "place_count": len(places),
                "route_persisted_count": route_persisted_count,
                "place_persisted_count": place_persisted_count,
                "timeline_candidate_count": len(timeline_candidates),
                "timeline_candidate_persisted_count": timeline_candidate_persisted_count,
                "map_matched_route_day_count": map_matched_route_day_count,
                "route_day_fallback_count": route_day_fallback_count,
            }
        )
        logger.info(
            (
                "Location follow-up pipeline placeholder tripId=%s "
                "preprocessed=%s stored=%s staySegments=%s moveSegments=%s routeDays=%s places=%s "
                "routePersisted=%s placePersisted=%s timelineCandidates=%s timelineCandidatesPersisted=%s "
                "mapMatchedRouteDays=%s routeDayFallbacks=%s"
            ),
            payload.trip_id,
            updated_summary.preprocessed_count,
            updated_summary.stored_count,
            updated_summary.stay_segment_count,
            updated_summary.move_segment_count,
            updated_summary.route_day_count,
            updated_summary.place_count,
            updated_summary.route_persisted_count,
            updated_summary.place_persisted_count,
            updated_summary.timeline_candidate_count,
            updated_summary.timeline_candidate_persisted_count,
            updated_summary.map_matched_route_day_count,
            updated_summary.route_day_fallback_count,
        )
        return updated_summary

    def _clamp_route_days_to_trip_range(
        self,
        trip_id: str,
        route_days: list[LocationRouteDay],
        *,
        connection: Connection | None = None,
    ) -> list[LocationRouteDay]:
        if not route_days or connection is None:
            return route_days

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT start_date, end_date, actual_ended_at
                FROM trips
                WHERE trip_id = %s
                """,
                (trip_id,),
            )
            row = cursor.fetchone()

        if row is None:
            return route_days

        start_date, end_date, actual_ended_at = row
        if start_date is None or end_date is None:
            return route_days

        max_allowed_day = end_date
        if actual_ended_at is None:
            max_allowed_day = min(end_date, datetime.now(KST).date())
        else:
            ended_day = actual_ended_at.astimezone(KST).date() if actual_ended_at.tzinfo else actual_ended_at.date()
            max_allowed_day = min(end_date, ended_day)

        clamped_route_days = [
            route_day
            for route_day in route_days
            if start_date <= date.fromisoformat(route_day.day) <= max_allowed_day
        ]

        if len(clamped_route_days) != len(route_days):
            logger.info(
                "Clamped route days to trip range for tripId=%s startDate=%s maxAllowedDay=%s removed=%s",
                trip_id,
                start_date,
                max_allowed_day,
                len(route_days) - len(clamped_route_days),
            )

        return clamped_route_days

    async def _apply_map_matching(
        self,
        route_days: list[LocationRouteDay],
    ) -> tuple[list[LocationRouteDay], int, int]:
        if not route_days:
            return route_days, 0, 0

        matched_route_days = []
        matched_count = 0
        fallback_count = 0

        for route_day in route_days:
            matched_coordinates = await self.map_matcher.match_coordinates(route_day.coordinates)
            if matched_coordinates is None:
                matched_route_days.append(route_day)
                fallback_count += 1
                continue

            if _should_keep_raw_route(route_day.coordinates, matched_coordinates):
                logger.info(
                    "Keeping raw route geometry for tripId=%s day=%s because matched route was too simplified.",
                    route_day.trip_id,
                    route_day.day,
                )
                matched_route_days.append(route_day)
                fallback_count += 1
                continue

            matched_route_days.append(
                route_day.model_copy(
                    update={
                        "point_count": len(matched_coordinates),
                        "coordinates": matched_coordinates,
                    }
                )
            )
            matched_count += 1

        return matched_route_days, matched_count, fallback_count
