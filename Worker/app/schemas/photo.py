from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class PhotoCoordinates(BaseModel):
    model_config = {"populate_by_name": True}

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PhotoProcessingRequest(BaseModel):
    model_config = {"populate_by_name": True}

    photo_id: str = Field(alias="photoId", description="Backend photo identifier")
    trip_id: str = Field(alias="tripId", description="Trip identifier")
    owner_user_id: str = Field(alias="ownerUserId", description="Photo owner user identifier")
    storage_key: str | None = Field(alias="storageKey", default=None, description="S3 object key for original photo")
    image_url: HttpUrl | None = Field(
        alias="imageUrl",
        default=None,
        description="Reachable image URL or presigned URL for processing",
    )
    thumbnail_key: str | None = Field(alias="thumbnailKey", default=None)
    file_name: str | None = Field(alias="fileName", default=None)
    content_type: str | None = Field(alias="contentType", default=None)
    taken_at: datetime | None = Field(alias="takenAt", default=None)
    taken_timezone: str | None = Field(alias="takenTimezone", default=None)
    coordinates: PhotoCoordinates | None = Field(default=None)
    requested_at: datetime | None = Field(alias="requestedAt", default=None)
    attempt: int = Field(default=0, ge=0)


class PhotoProcessingResultMessage(BaseModel):
    model_config = {"populate_by_name": True}

    photo_id: str = Field(alias="photoId")
    trip_id: str = Field(alias="tripId")
    owner_user_id: str = Field(alias="ownerUserId")
    status: str
    storage_key: str | None = Field(alias="storageKey", default=None)
    thumbnail_key: str | None = Field(alias="thumbnailKey", default=None)
    content_type: str | None = Field(alias="contentType", default=None)
    file_name: str | None = Field(alias="fileName", default=None)
    taken_at: datetime | None = Field(alias="takenAt", default=None)
    taken_timezone: str | None = Field(alias="takenTimezone", default=None)
    normalized_taken_at: datetime | None = Field(alias="normalizedTakenAt", default=None)
    coordinates: PhotoCoordinates | None = Field(default=None)
    normalized_coordinates: PhotoCoordinates | None = Field(alias="normalizedCoordinates", default=None)
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    metadata: dict = Field(default_factory=dict)
    processed_at: datetime = Field(alias="processedAt")
    attempt: int = Field(default=0, ge=0)
    error_code: str | None = Field(alias="errorCode", default=None)
    error_message: str | None = Field(alias="errorMessage", default=None)


class PhotoProcessingDlqMessage(BaseModel):
    model_config = {"populate_by_name": True}

    photo_id: str | None = Field(alias="photoId", default=None)
    trip_id: str | None = Field(alias="tripId", default=None)
    topic: str
    partition: int
    offset: int
    attempt: int
    payload: dict
    error_code: str = Field(alias="errorCode")
    error_message: str = Field(alias="errorMessage")
    failed_at: datetime = Field(alias="failedAt")
