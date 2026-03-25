import logging

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
            move_segments,
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
