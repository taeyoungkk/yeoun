from app.config import Settings
from app.schemas.location import LocationLogBatchStoredEvent, LocationPreprocessSummary
from app.services.location_followup_pipeline import LocationFollowupPipeline
from app.services.location_log_writer import LocationLogRawWriter
from app.services.location_preprocessor import LocationPreprocessor
from app.services.trip_processing_status import TripProcessingStatusWriter


class LocationPipelineService:
    """Minimal GPS pipeline entrypoint.

    This service currently validates the consumed batch and prepares the
    structure for the next steps: raw persistence, deduplication, and
    preprocessing.
    """

    def __init__(self, settings: Settings):
        self.writer = LocationLogRawWriter(settings)
        self.preprocessor = LocationPreprocessor(settings)
        self.status_writer = TripProcessingStatusWriter(settings)
        self.followup_pipeline = LocationFollowupPipeline()

    async def ingest_batch(self, payload: LocationLogBatchStoredEvent) -> LocationPreprocessSummary:
        self.status_writer.mark_processing(payload.trip_id, requested_at=payload.requested_at)

        try:
            persisted = self.writer.save_batch(payload)
            summary = self.preprocessor.preprocess(
                payload.logs,
                accepted_count=persisted["accepted_count"],
                duplicate_count=persisted["duplicate_count"],
                stored_count=persisted["stored_count"],
            )
            await self.followup_pipeline.run(payload, summary)
            self.status_writer.mark_ready(payload.trip_id, requested_at=payload.requested_at)
            return summary
        except Exception as exc:
            self.status_writer.mark_failed(payload.trip_id, str(exc), requested_at=payload.requested_at)
            raise
