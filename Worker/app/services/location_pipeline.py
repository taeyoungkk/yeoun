from app.schemas.location import LocationLogBatchStoredEvent


class LocationPipelineService:
    """Minimal GPS pipeline entrypoint.

    This service currently validates the consumed batch and prepares the
    structure for the next steps: raw persistence, deduplication, and
    preprocessing.
    """

    async def ingest_batch(self, payload: LocationLogBatchStoredEvent) -> dict[str, int]:
        accepted_count = len(payload.logs)
        duplicate_count = 0
        stored_count = accepted_count

        return {
            "accepted_count": accepted_count,
            "duplicate_count": duplicate_count,
            "stored_count": stored_count,
        }
