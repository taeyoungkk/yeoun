from app.config import Settings
from app.schemas.location import LocationLogBatchStoredEvent, LocationPreprocessSummary
from app.services.location_log_writer import LocationLogRawWriter
from app.services.location_preprocessor import LocationPreprocessor


class LocationPipelineService:
    """Minimal GPS pipeline entrypoint.

    This service currently validates the consumed batch and prepares the
    structure for the next steps: raw persistence, deduplication, and
    preprocessing.
    """

    def __init__(self, settings: Settings):
        self.writer = LocationLogRawWriter(settings)
        self.preprocessor = LocationPreprocessor(settings)

    async def ingest_batch(self, payload: LocationLogBatchStoredEvent) -> LocationPreprocessSummary:
        persisted = self.writer.save_batch(payload)
        return self.preprocessor.preprocess(
            payload.logs,
            accepted_count=persisted["accepted_count"],
            duplicate_count=persisted["duplicate_count"],
            stored_count=persisted["stored_count"],
        )
