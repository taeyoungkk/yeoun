import json
from decimal import Decimal

import psycopg

from app.config import Settings
from app.schemas.photo import PhotoCoordinates, PhotoProcessingResultMessage


class PhotoResultWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def persist_result(self, result: PhotoProcessingResultMessage) -> None:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for photo result persistence.")

        with psycopg.connect(self.settings.worker_database_url) as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE photos
                        SET thumbnail_key = %(thumbnail_key)s,
                            width = %(width)s,
                            height = %(height)s,
                            taken_at = %(taken_at)s,
                            exif_latitude = %(exif_latitude)s,
                            exif_longitude = %(exif_longitude)s,
                            metadata_json = %(metadata_json)s::jsonb,
                            updated_at = %(updated_at)s
                        WHERE photo_id = %(photo_id)s
                        """,
                        {
                            "photo_id": result.photo_id,
                            "thumbnail_key": result.thumbnail_key,
                            "width": result.width,
                            "height": result.height,
                            "taken_at": result.normalized_taken_at or result.taken_at,
                            "exif_latitude": self._to_decimal(
                                result.normalized_coordinates or result.coordinates,
                                field="latitude",
                            ),
                            "exif_longitude": self._to_decimal(
                                result.normalized_coordinates or result.coordinates,
                                field="longitude",
                            ),
                            "metadata_json": json.dumps(result.metadata, ensure_ascii=False),
                            "updated_at": result.processed_at,
                        },
                    )

                    if cursor.rowcount != 1:
                        raise RuntimeError(f"Photo row not found for processing result. photoId={result.photo_id}")

                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def _to_decimal(self, coordinates: PhotoCoordinates | None, *, field: str) -> Decimal | None:
        if coordinates is None:
            return None
        return Decimal(str(getattr(coordinates, field)))
