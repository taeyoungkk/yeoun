from dataclasses import dataclass
from io import BytesIO
from urllib.parse import quote

import httpx
from PIL import Image, UnidentifiedImageError

from app.config import Settings
from app.schemas.photo import PhotoProcessingRequest


@dataclass(slots=True)
class LoadedPhoto:
    source_url: str
    image_bytes: bytes
    mime_type: str
    format: str | None
    mode: str
    width: int
    height: int


class PhotoLoaderService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def download_and_load(self, payload: PhotoProcessingRequest) -> LoadedPhoto:
        source_url = self._resolve_source_url(payload)

        async with httpx.AsyncClient(timeout=self.settings.gemini_timeout_seconds) as client:
            response = await client.get(source_url)
            response.raise_for_status()

        image_bytes = response.content
        mime_type = response.headers.get("content-type", "").split(";")[0].strip() or "application/octet-stream"

        try:
            with Image.open(BytesIO(image_bytes)) as image:
                image.load()
                return LoadedPhoto(
                    source_url=source_url,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    format=image.format,
                    mode=image.mode,
                    width=image.width,
                    height=image.height,
                )
        except UnidentifiedImageError as exc:
            raise ValueError("Downloaded file is not a supported image.") from exc

    def _resolve_source_url(self, payload: PhotoProcessingRequest) -> str:
        if payload.image_url is not None:
            return str(payload.image_url)

        if payload.storage_key:
            base_url = self.settings.image_base_url.rstrip("/")
            encoded_key = quote(payload.storage_key.lstrip("/"), safe="/")
            return f"{base_url}/{encoded_key}"

        raise ValueError("Either imageUrl or storageKey is required for photo processing.")
