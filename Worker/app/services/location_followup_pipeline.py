import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from psycopg import Connection

from app.config import Settings
from app.schemas.location import (
    LocationCleanLog,
    LocationLogBatchStoredEvent,
    LocationPreprocessSummary,
    LocationRouteDay,
)
from app.services.location_place_builder import LocationPlaceBuilder
from app.services.location_place_writer import LocationPlaceWriter
from app.services.location_route_builder import LocationRouteBuilder
from app.services.location_route_writer import LocationRouteDayWriter
from app.services.location_stay_detector import LocationStayDetector
from app.services.location_timeline_candidate_writer import LocationTimelineCandidateWriter
from app.services.location_timeline_linker import LocationTimelineLinker

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")


class LocationFollowupPipeline:
    """Placeholder for downstream GPS processing stages.

    The next stages such as clean GPS persistence, stay detection, route
    generation, and place generation should be connected here.
    """

    def __init__(self, settings: Settings):
        self.stay_detector = LocationStayDetector(settings)
        self.route_builder = LocationRouteBuilder()
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
        map_matched_route_day_count = 0
        route_day_fallback_count = 0
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
