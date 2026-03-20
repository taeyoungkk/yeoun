from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

from app.config import Settings
from app.schemas.photo import PhotoManualReviewCandidate, PhotoProcessingResultMessage


class PhotoManualReviewLinker:
    def __init__(self, settings: Settings):
        self.settings = settings

    def build_candidates(self, result: PhotoProcessingResultMessage) -> list[PhotoManualReviewCandidate]:
        gps_match = result.gps_match
        review_reason: str | None = None

        if gps_match is None:
            review_reason = "UNMATCHED"
        elif gps_match.score < self.settings.photo_manual_review_score_threshold:
            review_reason = "LOW_CONFIDENCE_MATCH"

        if review_reason is None:
            return []

        candidate_id = str(
            uuid5(
                NAMESPACE_URL,
                f"{result.trip_id}:{result.photo_id}:manual-review:{review_reason}",
            )
        )
        metadata = {
            "fileName": result.file_name,
            "thumbnailKey": result.thumbnail_key,
            "gpsMatch": gps_match.model_dump(mode="json", by_alias=True) if gps_match else None,
            "normalizedTakenAt": result.normalized_taken_at.isoformat() if result.normalized_taken_at else None,
        }

        return [
            PhotoManualReviewCandidate(
                candidateId=candidate_id,
                tripId=result.trip_id,
                photoId=result.photo_id,
                reviewStatus="PENDING",
                reviewReason=review_reason,
                confidenceScore=gps_match.score if gps_match else None,
                suggestedPlaceId=gps_match.matched_place_id if gps_match else None,
                suggestedClientLogUuid=gps_match.matched_client_log_uuid if gps_match else None,
                suggestedRecordedAt=gps_match.matched_recorded_at if gps_match else None,
                metadata=metadata,
            )
        ]
