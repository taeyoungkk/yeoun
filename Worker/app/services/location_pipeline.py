from app.config import Settings
from app.schemas.location import LocationLogBatchStoredEvent
from app.services.location_log_writer import LocationLogRawWriter


class LocationPipelineService:
    """Minimal GPS pipeline entrypoint.

    This service currently validates the consumed batch and prepares the
    structure for the next steps: raw persistence, deduplication, and
    preprocessing.
    """

    def __init__(self, settings: Settings):
        self.writer = LocationLogRawWriter(settings)

    async def ingest_batch(self, payload: LocationLogBatchStoredEvent) -> dict[str, int]:
        return self.writer.save_batch(payload)
