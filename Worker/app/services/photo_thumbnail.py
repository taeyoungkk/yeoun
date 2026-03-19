from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

from app.config import Settings
from app.schemas.photo import PhotoProcessingRequest
from app.services.photo_loader import LoadedPhoto


@dataclass(slots=True)
class GeneratedThumbnail:
    thumbnail_key: str
    output_path: str
    width: int
    height: int
    format: str
    mime_type: str
    file_size_bytes: int


class PhotoThumbnailService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def generate_and_store(self, payload: PhotoProcessingRequest, loaded_photo: LoadedPhoto) -> GeneratedThumbnail:
        format_name = self.settings.photo_thumbnail_format.upper()
        extension = self._resolve_extension(format_name)
        thumbnail_key = f"thumbnails/{payload.owner_user_id}/{payload.trip_id}/{payload.photo_id}.{extension}"

        output_root = Path(self.settings.photo_thumbnail_output_dir)
        output_path = output_root / Path(thumbnail_key)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with Image.open(BytesIO(loaded_photo.image_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L" and format_name in {"JPEG", "WEBP"}:
                image = image.convert("RGB")

            thumbnail = image.copy()
            thumbnail.thumbnail((self.settings.photo_thumbnail_max_size, self.settings.photo_thumbnail_max_size))
            thumbnail.save(output_path, format=format_name, **self._build_save_kwargs(format_name))

            return GeneratedThumbnail(
                thumbnail_key=thumbnail_key,
                output_path=str(output_path),
                width=thumbnail.width,
                height=thumbnail.height,
                format=format_name,
                mime_type=self._resolve_mime_type(format_name),
                file_size_bytes=output_path.stat().st_size,
            )

    def _build_save_kwargs(self, format_name: str) -> dict:
        if format_name == "JPEG":
            return {"quality": self.settings.photo_thumbnail_quality, "optimize": True}
        if format_name == "WEBP":
            return {"quality": self.settings.photo_thumbnail_quality, "method": 6}
        return {}

    def _resolve_extension(self, format_name: str) -> str:
        return {
            "JPEG": "jpg",
            "PNG": "png",
            "WEBP": "webp",
        }.get(format_name, format_name.lower())

    def _resolve_mime_type(self, format_name: str) -> str:
        return {
            "JPEG": "image/jpeg",
            "PNG": "image/png",
            "WEBP": "image/webp",
        }.get(format_name, "application/octet-stream")
