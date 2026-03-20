import logging

from app.config import Settings
from app.schemas.location import LocationCleanLog, LocationLogBatchStoredEvent, LocationPreprocessSummary
from app.services.location_stay_detector import LocationStayDetector

logger = logging.getLogger(__name__)


class LocationFollowupPipeline:
    """Placeholder for downstream GPS processing stages.

    The next stages such as clean GPS persistence, stay detection, route
    generation, and place generation should be connected here.
    """

    def __init__(self, settings: Settings):
        self.stay_detector = LocationStayDetector(settings)

    async def run(
        self,
        payload: LocationLogBatchStoredEvent,
        clean_logs: list[LocationCleanLog],
        summary: LocationPreprocessSummary,
    ) -> LocationPreprocessSummary:
        stay_segments = self.stay_detector.detect(payload.trip_id, payload.user_id, clean_logs)
        updated_summary = summary.model_copy(update={"staySegmentCount": len(stay_segments)})
        logger.info(
            (
                "Location follow-up pipeline placeholder tripId=%s "
                "preprocessed=%s stored=%s staySegments=%s"
            ),
            payload.trip_id,
            updated_summary.preprocessed_count,
            updated_summary.stored_count,
            updated_summary.stay_segment_count,
        )
        return updated_summary
