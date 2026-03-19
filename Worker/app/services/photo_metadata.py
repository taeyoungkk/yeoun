from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from PIL import ExifTags, Image

from app.schemas.photo import PhotoCoordinates, PhotoProcessingRequest
from app.services.photo_loader import LoadedPhoto

EXIF_TAGS = ExifTags.TAGS
GPS_TAGS = ExifTags.GPSTAGS
GPS_INFO_TAG = next((tag for tag, name in EXIF_TAGS.items() if name == "GPSInfo"), 34853)


@dataclass(slots=True)
class ExtractedPhotoMetadata:
    extracted_taken_at: datetime | None
    normalized_taken_at: datetime | None
    extracted_coordinates: PhotoCoordinates | None
    normalized_coordinates: PhotoCoordinates | None
    orientation: int | None
    camera_make: str | None
    camera_model: str | None
    metadata: dict[str, object]


class PhotoMetadataService:
    def extract_and_normalize(
        self,
        payload: PhotoProcessingRequest,
        loaded_photo: LoadedPhoto,
    ) -> ExtractedPhotoMetadata:
        with Image.open(BytesIO(loaded_photo.image_bytes)) as image:
            exif = image.getexif()

        orientation = self._to_int(exif.get(self._tag_id("Orientation")))
        camera_make = self._to_str(exif.get(self._tag_id("Make")))
        camera_model = self._to_str(exif.get(self._tag_id("Model")))

        extracted_taken_at = self._extract_taken_at(exif)
        normalized_taken_at = self._normalize_taken_at(payload, extracted_taken_at)

        extracted_coordinates = self._extract_coordinates(exif)
        normalized_coordinates = payload.coordinates or extracted_coordinates

        metadata: dict[str, object] = {
            "sourceUrl": loaded_photo.source_url,
            "imageFormat": loaded_photo.format,
            "imageMode": loaded_photo.mode,
            "orientation": orientation,
            "cameraMake": camera_make,
            "cameraModel": camera_model,
            "extractedTakenAt": extracted_taken_at.isoformat() if extracted_taken_at else None,
            "normalizedTakenAt": normalized_taken_at.isoformat() if normalized_taken_at else None,
            "extractedLatitude": extracted_coordinates.latitude if extracted_coordinates else None,
            "extractedLongitude": extracted_coordinates.longitude if extracted_coordinates else None,
            "normalizedLatitude": normalized_coordinates.latitude if normalized_coordinates else None,
            "normalizedLongitude": normalized_coordinates.longitude if normalized_coordinates else None,
        }

        return ExtractedPhotoMetadata(
            extracted_taken_at=extracted_taken_at,
            normalized_taken_at=normalized_taken_at,
            extracted_coordinates=extracted_coordinates,
            normalized_coordinates=normalized_coordinates,
            orientation=orientation,
            camera_make=camera_make,
            camera_model=camera_model,
            metadata=metadata,
        )

    def _extract_taken_at(self, exif) -> datetime | None:
        for tag_name in ("DateTimeOriginal", "DateTimeDigitized", "DateTime"):
            value = exif.get(self._tag_id(tag_name))
            parsed = self._parse_exif_datetime(value)
            if parsed is not None:
                return parsed
        return None

    def _normalize_taken_at(
        self,
        payload: PhotoProcessingRequest,
        extracted_taken_at: datetime | None,
    ) -> datetime | None:
        candidate = payload.taken_at or extracted_taken_at
        if candidate is None:
            return None

        if candidate.tzinfo is not None:
            return candidate.astimezone(timezone.utc)

        if payload.taken_timezone:
            try:
                zoned = candidate.replace(tzinfo=ZoneInfo(payload.taken_timezone))
                return zoned.astimezone(timezone.utc)
            except ZoneInfoNotFoundError:
                pass

        return candidate

    def _extract_coordinates(self, exif) -> PhotoCoordinates | None:
        gps_info = exif.get(GPS_INFO_TAG)
        if gps_info is None and hasattr(exif, "get_ifd"):
            try:
                gps_info = exif.get_ifd(GPS_INFO_TAG)
            except KeyError:
                gps_info = None

        if not isinstance(gps_info, dict):
            return None

        latitude = self._parse_gps_coordinate(
            gps_info.get(self._gps_tag_id("GPSLatitude")),
            gps_info.get(self._gps_tag_id("GPSLatitudeRef")),
        )
        longitude = self._parse_gps_coordinate(
            gps_info.get(self._gps_tag_id("GPSLongitude")),
            gps_info.get(self._gps_tag_id("GPSLongitudeRef")),
        )

        if latitude is None or longitude is None:
            return None

        return PhotoCoordinates(latitude=round(latitude, 6), longitude=round(longitude, 6))

    def _parse_exif_datetime(self, value) -> datetime | None:
        if value is None:
            return None

        normalized = str(value).strip().replace("\x00", "")
        if not normalized:
            return None

        for pattern in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(normalized, pattern)
            except ValueError:
                continue
        return None

    def _parse_gps_coordinate(self, values, reference) -> float | None:
        if not values or len(values) != 3:
            return None

        try:
            degrees = self._to_float(values[0])
            minutes = self._to_float(values[1])
            seconds = self._to_float(values[2])
        except (TypeError, ValueError, ZeroDivisionError):
            return None

        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        ref = str(reference).upper()
        if ref in {"S", "W"}:
            decimal *= -1
        return decimal

    def _to_float(self, value) -> float:
        if hasattr(value, "numerator") and hasattr(value, "denominator"):
            denominator = value.denominator or 1
            return float(value.numerator) / float(denominator)
        return float(value)

    def _to_int(self, value) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _to_str(self, value) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    def _tag_id(self, tag_name: str) -> int:
        return next(tag for tag, name in EXIF_TAGS.items() if name == tag_name)

    def _gps_tag_id(self, tag_name: str) -> int:
        return next(tag for tag, name in GPS_TAGS.items() if name == tag_name)
