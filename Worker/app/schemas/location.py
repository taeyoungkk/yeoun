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


class LocationCleanLog(BaseModel):
    model_config = {"populate_by_name": True}

    client_log_uuid: str = Field(alias="clientLogUuid", min_length=1, max_length=100)
    recorded_at: datetime = Field(alias="recordedAt")
    latitude: Decimal
    longitude: Decimal
    accuracy_m: Decimal = Field(alias="accuracyM")
    speed_mps: Decimal | None = Field(alias="speedMps", default=None)
    heading: Decimal | None = Field(default=None)
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
    preprocessed_count: int = Field(alias="preprocessedCount", default=0, ge=0)
    stay_segment_count: int = Field(alias="staySegmentCount", default=0, ge=0)
    move_segment_count: int = Field(alias="moveSegmentCount", default=0, ge=0)
    route_day_count: int = Field(alias="routeDayCount", default=0, ge=0)
    place_count: int = Field(alias="placeCount", default=0, ge=0)
    route_persisted_count: int = Field(alias="routePersistedCount", default=0, ge=0)
    place_persisted_count: int = Field(alias="placePersistedCount", default=0, ge=0)
    timeline_candidate_count: int = Field(alias="timelineCandidateCount", default=0, ge=0)
    timeline_candidate_persisted_count: int = Field(alias="timelineCandidatePersistedCount", default=0, ge=0)
    map_matched_route_day_count: int = Field(alias="mapMatchedRouteDayCount", default=0, ge=0)
    route_day_fallback_count: int = Field(alias="routeDayFallbackCount", default=0, ge=0)
    filtered_accuracy_count: int = Field(alias="filteredAccuracyCount", default=0, ge=0)
    filtered_duplicate_count: int = Field(alias="filteredDuplicateCount", default=0, ge=0)
    filtered_jump_count: int = Field(alias="filteredJumpCount", default=0, ge=0)
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


class LocationPreprocessSummary(BaseModel):
    model_config = {"populate_by_name": True}

    accepted_count: int = Field(alias="acceptedCount", ge=0)
    duplicate_count: int = Field(alias="duplicateCount", ge=0)
    stored_count: int = Field(alias="storedCount", ge=0)
    clean_persisted_count: int = Field(alias="cleanPersistedCount", default=0, ge=0)
    preprocessed_count: int = Field(alias="preprocessedCount", ge=0)
    stay_segment_count: int = Field(alias="staySegmentCount", default=0, ge=0)
    move_segment_count: int = Field(alias="moveSegmentCount", default=0, ge=0)
    route_day_count: int = Field(alias="routeDayCount", default=0, ge=0)
    place_count: int = Field(alias="placeCount", default=0, ge=0)
    route_persisted_count: int = Field(alias="routePersistedCount", default=0, ge=0)
    place_persisted_count: int = Field(alias="placePersistedCount", default=0, ge=0)
    timeline_candidate_count: int = Field(alias="timelineCandidateCount", default=0, ge=0)
    timeline_candidate_persisted_count: int = Field(alias="timelineCandidatePersistedCount", default=0, ge=0)
    map_matched_route_day_count: int = Field(alias="mapMatchedRouteDayCount", default=0, ge=0)
    route_day_fallback_count: int = Field(alias="routeDayFallbackCount", default=0, ge=0)
    filtered_accuracy_count: int = Field(alias="filteredAccuracyCount", ge=0)
    filtered_duplicate_count: int = Field(alias="filteredDuplicateCount", ge=0)
    filtered_jump_count: int = Field(alias="filteredJumpCount", ge=0)


class LocationPreprocessResult(BaseModel):
    clean_logs: list[LocationCleanLog] = Field(default_factory=list, alias="cleanLogs")
    summary: LocationPreprocessSummary


class LocationStaySegment(BaseModel):
    model_config = {"populate_by_name": True}

    segment_id: str = Field(alias="segmentId")
    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    started_at: datetime = Field(alias="startedAt")
    ended_at: datetime = Field(alias="endedAt")
    duration_seconds: int = Field(alias="durationSeconds", ge=0)
    center_latitude: Decimal = Field(alias="centerLatitude")
    center_longitude: Decimal = Field(alias="centerLongitude")
    point_count: int = Field(alias="pointCount", ge=1)
    source: str


class LocationMoveSegment(BaseModel):
    model_config = {"populate_by_name": True}

    segment_id: str = Field(alias="segmentId")
    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    started_at: datetime = Field(alias="startedAt")
    ended_at: datetime = Field(alias="endedAt")
    duration_seconds: int = Field(alias="durationSeconds", ge=0)
    point_count: int = Field(alias="pointCount", ge=2)
    distance_m: Decimal = Field(alias="distanceM", ge=Decimal("0"))
    coordinates: list[tuple[Decimal, Decimal]]
    source: str


class LocationRouteDay(BaseModel):
    model_config = {"populate_by_name": True}

    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    day: str
    started_at: datetime = Field(alias="startedAt")
    ended_at: datetime = Field(alias="endedAt")
    point_count: int = Field(alias="pointCount", ge=2)
    distance_m: Decimal = Field(alias="distanceM", ge=Decimal("0"))
    coordinates: list[tuple[Decimal, Decimal]]


class LocationPlaceCandidate(BaseModel):
    model_config = {"populate_by_name": True}

    place_id: str = Field(alias="placeId")
    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    started_at: datetime = Field(alias="startedAt")
    ended_at: datetime = Field(alias="endedAt")
    duration_seconds: int = Field(alias="durationSeconds", ge=0)
    center_latitude: Decimal = Field(alias="centerLatitude")
    center_longitude: Decimal = Field(alias="centerLongitude")
    stay_segment_count: int = Field(alias="staySegmentCount", ge=1)
    source: str


class LocationTimelineCandidate(BaseModel):
    model_config = {"populate_by_name": True}

    candidate_id: str = Field(alias="candidateId")
    trip_id: str = Field(alias="tripId")
    user_id: str = Field(alias="userId")
    candidate_type: str = Field(alias="candidateType")
    reference_id: str = Field(alias="referenceId")
    started_at: datetime = Field(alias="startedAt")
    ended_at: datetime = Field(alias="endedAt")
    title: str
