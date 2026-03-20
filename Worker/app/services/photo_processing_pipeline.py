import psycopg

from app.config import Settings
from app.schemas.photo import PhotoProcessingResultMessage
from app.services.photo_manual_review_candidate_writer import PhotoManualReviewCandidateWriter
from app.services.photo_manual_review_linker import PhotoManualReviewLinker
from app.services.photo_place_linker import PhotoPlaceLinker
from app.services.photo_place_link_writer import PhotoPlaceLinkWriter
from app.services.photo_result_writer import PhotoResultWriter
from app.services.photo_event_link_writer import PhotoEventLinkWriter
from app.services.photo_timeline_candidate_writer import PhotoTimelineCandidateWriter
from app.services.photo_timeline_linker import PhotoTimelineLinker


class PhotoProcessingPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.result_writer = PhotoResultWriter(settings)
        self.manual_review_linker = PhotoManualReviewLinker(settings)
        self.manual_review_candidate_writer = PhotoManualReviewCandidateWriter()
        self.place_linker = PhotoPlaceLinker()
        self.place_link_writer = PhotoPlaceLinkWriter()
        self.timeline_linker = PhotoTimelineLinker()
        self.timeline_candidate_writer = PhotoTimelineCandidateWriter()
        self.event_link_writer = PhotoEventLinkWriter()

    def persist_and_link(self, result: PhotoProcessingResultMessage) -> PhotoProcessingResultMessage:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for photo processing persistence.")

        with psycopg.connect(self.settings.worker_database_url) as connection:
            try:
                self.result_writer.persist_result(result, connection=connection)
                enriched = self.place_linker.link_and_select(result, connection=connection)
                self.place_link_writer.save(enriched, connection=connection)
                manual_review_candidates = self.manual_review_linker.build_candidates(enriched)
                self.manual_review_candidate_writer.replace_for_photo(
                    enriched.photo_id,
                    manual_review_candidates,
                    connection=connection,
                )
                timeline_candidates = self.timeline_linker.build_candidates(enriched)
                self.timeline_candidate_writer.replace_for_photo(
                    enriched.photo_id,
                    timeline_candidates,
                    connection=connection,
                )
                self.event_link_writer.replace_for_photo(
                    enriched.photo_id,
                    timeline_candidates,
                    connection=connection,
                )
                enriched = enriched.model_copy(
                    update={
                        "manualReviewCandidates": manual_review_candidates,
                        "timelineCandidates": timeline_candidates,
                        "metadata": {
                            **enriched.metadata,
                            "manualReviewCandidates": [
                                candidate.model_dump(mode="json", by_alias=True)
                                for candidate in manual_review_candidates
                            ],
                            "timelineCandidates": [
                                candidate.model_dump(mode="json", by_alias=True)
                                for candidate in timeline_candidates
                            ],
                        },
                    }
                )
                self.result_writer.persist_result(enriched, connection=connection)
                connection.commit()
                return enriched
            except Exception:
                connection.rollback()
                raise
