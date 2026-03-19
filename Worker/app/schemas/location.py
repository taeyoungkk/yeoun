from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class LocationLogRequestItem(BaseModel):
    model_config = {"populate_by_name": True}

    client_log_uuid: str = Field(alias="clientLogUuid", min_length=1, max_length=100)
    recorded_at: datetime = Field(alias="recordedAt")
    latitude: Decimal = Field(ge=Decimal("-90"), le=Decimal("90"))
    longitude: Decimal = Field(ge=Decimal("-180"), le=Decimal("180"))
    accuracy_m: Decimal = Field(alias="accuracyM", gt=Decimal("0"))
    speed_mps: Decimal | None = Field(alias="speedMps", default=None, ge=Decimal("0"))
    heading: Decimal | None = Field(default=None, ge=Decimal("0"), lt=Decimal("360"))
    source: str


class LocationLogBatchStoredEvent(BaseModel):
    model_config = {"populate_by_name": True}

    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    requested_at: datetime = Field(alias="requestedAt")
    logs: list[LocationLogRequestItem]
    attempt: int = Field(default=0, ge=0)


class LocationLogBatchResultMessage(BaseModel):
    model_config = {"populate_by_name": True}

    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    status: str
    requested_at: datetime = Field(alias="requestedAt")
    processed_at: datetime = Field(alias="processedAt")
    accepted_count: int = Field(alias="acceptedCount", ge=0)
    duplicate_count: int = Field(alias="duplicateCount", default=0, ge=0)
    stored_count: int = Field(alias="storedCount", ge=0)
    attempt: int = Field(default=0, ge=0)
    error_code: str | None = Field(alias="errorCode", default=None)
    error_message: str | None = Field(alias="errorMessage", default=None)


class LocationLogBatchDlqMessage(BaseModel):
    model_config = {"populate_by_name": True}

    trip_id: str | None = Field(alias="tripId", default=None)
    user_id: str | None = Field(alias="userId", default=None)
    topic: str
    partition: int
    offset: int
    attempt: int
    payload: dict
    error_code: str = Field(alias="errorCode")
    error_message: str = Field(alias="errorMessage")
    failed_at: datetime = Field(alias="failedAt")
