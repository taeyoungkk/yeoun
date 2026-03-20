import psycopg

from app.config import Settings
from app.schemas.photo import PhotoProcessingResultMessage
from app.services.photo_place_linker import PhotoPlaceLinker
from app.services.photo_result_writer import PhotoResultWriter


class PhotoProcessingPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.result_writer = PhotoResultWriter(settings)
        self.place_linker = PhotoPlaceLinker()

    def persist_and_link(self, result: PhotoProcessingResultMessage) -> PhotoProcessingResultMessage:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for photo processing persistence.")

        with psycopg.connect(self.settings.worker_database_url) as connection:
            try:
                self.result_writer.persist_result(result, connection=connection)
                enriched = self.place_linker.link_and_select(result, connection=connection)
                connection.commit()
                return enriched
            except Exception:
                connection.rollback()
                raise
