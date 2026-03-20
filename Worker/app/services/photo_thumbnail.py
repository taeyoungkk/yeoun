from dataclasses import dataclass
from io import BytesIO

import boto3
from PIL import Image, ImageOps

from app.config import Settings
from app.schemas.photo import PhotoProcessingRequest
from app.services.photo_loader import LoadedPhoto


@dataclass(slots=True)
class GeneratedThumbnail:
    thumbnail_key: str
    thumbnail_url: str | None
    width: int
    height: int
    format: str
    mime_type: str
    file_size_bytes: int


class PhotoThumbnailService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._s3_client = boto3.client(
            "s3",
            region_name=self.settings.aws_region,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
        )

    def generate_and_store(self, payload: PhotoProcessingRequest, loaded_photo: LoadedPhoto) -> GeneratedThumbnail:
        if not self.settings.aws_s3_bucket:
            raise ValueError("AWS_S3_BUCKET is required for thumbnail upload.")

        format_name = self.settings.photo_thumbnail_format.upper()
        extension = self._resolve_extension(format_name)
        prefix = self.settings.aws_s3_thumbnail_prefix.strip("/")
        thumbnail_key = f"{prefix}/{payload.owner_user_id}/{payload.trip_id}/{payload.photo_id}.{extension}"

        with Image.open(BytesIO(loaded_photo.image_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            elif image.mode == "L" and format_name in {"JPEG", "WEBP"}:
                image = image.convert("RGB")

            thumbnail = image.copy()
            thumbnail.thumbnail((self.settings.photo_thumbnail_max_size, self.settings.photo_thumbnail_max_size))
            buffer = BytesIO()
            thumbnail.save(buffer, format=format_name, **self._build_save_kwargs(format_name))
            thumbnail_bytes = buffer.getvalue()

            self._s3_client.put_object(
                Bucket=self.settings.aws_s3_bucket,
                Key=thumbnail_key,
                Body=thumbnail_bytes,
                ContentType=self._resolve_mime_type(format_name),
            )

            return GeneratedThumbnail(
                thumbnail_key=thumbnail_key,
                thumbnail_url=self._build_thumbnail_url(thumbnail_key),
                width=thumbnail.width,
                height=thumbnail.height,
                format=format_name,
                mime_type=self._resolve_mime_type(format_name),
                file_size_bytes=len(thumbnail_bytes),
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

    def _build_thumbnail_url(self, thumbnail_key: str) -> str | None:
        if self.settings.aws_s3_public_base_url:
            return f"{self.settings.aws_s3_public_base_url.rstrip('/')}/{thumbnail_key}"
        return None
