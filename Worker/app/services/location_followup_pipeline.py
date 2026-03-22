import logging

from psycopg import Connection

from app.config import Settings
from app.schemas.location import LocationCleanLog, LocationLogBatchStoredEvent, LocationPreprocessSummary
from app.services.location_place_builder import LocationPlaceBuilder
from app.services.location_place_writer import LocationPlaceWriter
from app.services.location_route_builder import LocationRouteBuilder
from app.services.location_route_writer import LocationRouteDayWriter
from app.services.location_stay_detector import LocationStayDetector
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
        self.place_builder = LocationPlaceBuilder(settings)
        self.route_writer = LocationRouteDayWriter(settings)
        self.place_writer = LocationPlaceWriter(settings)
        self.timeline_linker = LocationTimelineLinker()

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
        updated_summary = summary.model_copy(
            update={
                "staySegmentCount": len(stay_segments),
                "moveSegmentCount": len(move_segments),
                "routeDayCount": len(route_days),
                "placeCount": len(places),
                "routePersistedCount": route_persisted_count,
                "placePersistedCount": place_persisted_count,
                "timelineCandidateCount": len(timeline_candidates),
            }
        )
        logger.info(
            (
                "Location follow-up pipeline placeholder tripId=%s "
                "preprocessed=%s stored=%s staySegments=%s moveSegments=%s routeDays=%s places=%s "
                "routePersisted=%s placePersisted=%s timelineCandidates=%s"
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
        )
        return updated_summary
