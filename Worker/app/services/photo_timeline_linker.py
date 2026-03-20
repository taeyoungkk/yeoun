from __future__ import annotations

from datetime import timezone
from uuid import NAMESPACE_URL, uuid5

from app.schemas.photo import PhotoProcessingResultMessage, PhotoTimelineCandidate


class PhotoTimelineLinker:
    def build_candidates(self, result: PhotoProcessingResultMessage) -> list[PhotoTimelineCandidate]:
        effective_taken_at = result.normalized_taken_at or result.taken_at or result.processed_at
        day_date = effective_taken_at.astimezone(timezone.utc).date().isoformat()
        place_id = result.place_link.place_id if result.place_link else None
        representative = result.representative_selection.is_representative if result.representative_selection else False
        sort_order = result.representative_selection.rank if result.representative_selection else 1
        candidate_type = "PLACE_PHOTO" if place_id else "UNMATCHED_PHOTO"
        candidate_id = str(
            uuid5(
                NAMESPACE_URL,
                f"{result.trip_id}:{result.photo_id}:{candidate_type}:{place_id or 'none'}:{day_date}",
            )
        )

        metadata = {
            "thumbnailKey": result.thumbnail_key,
            "fileName": result.file_name,
            "gpsMatch": result.gps_match.model_dump(mode="json", by_alias=True) if result.gps_match else None,
            "placeLink": result.place_link.model_dump(mode="json", by_alias=True) if result.place_link else None,
            "representativeSelection": (
                result.representative_selection.model_dump(mode="json", by_alias=True)
                if result.representative_selection
                else None
            ),
        }

        return [
            PhotoTimelineCandidate(
                candidateId=candidate_id,
                tripId=result.trip_id,
                photoId=result.photo_id,
                placeId=place_id,
                candidateType=candidate_type,
                dayDate=day_date,
                title=result.file_name or "photo",
                startAt=effective_taken_at,
                endAt=effective_taken_at,
                isRepresentative=representative,
                sortOrder=sort_order,
                metadata=metadata,
            )
        ]
