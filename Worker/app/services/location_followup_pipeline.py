import logging

from app.schemas.location import LocationLogBatchStoredEvent, LocationPreprocessSummary

logger = logging.getLogger(__name__)


class LocationFollowupPipeline:
    """Placeholder for downstream GPS processing stages.

    The next stages such as clean GPS persistence, stay detection, route
    generation, and place generation should be connected here.
    """

    async def run(self, payload: LocationLogBatchStoredEvent, summary: LocationPreprocessSummary) -> None:
        logger.info(
            (
                "Location follow-up pipeline placeholder tripId=%s "
                "preprocessed=%s stored=%s"
            ),
            payload.trip_id,
            summary.preprocessed_count,
            summary.stored_count,
        )
