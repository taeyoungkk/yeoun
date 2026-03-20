from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "yeoun-worker"
    app_env: str = Field(default="local", alias="APP_ENV")
    app_port: int = Field(default=8000, alias="WORKER_CONTAINER_PORT")

    kafka_enabled: bool = Field(default=False, alias="KAFKA_ENABLED")
    kafka_bootstrap_servers: str = Field(default="kafka:9092", alias="KAFKA_BOOTSTRAP_SERVERS")
    kafka_receipt_request_topic: str = Field(
        default="receipt-ocr-request",
        validation_alias=AliasChoices("KAFKA_RECEIPT_REQUEST_TOPIC", "KAFKA_RECEIPT_TOPIC"),
    )
    kafka_receipt_result_topic: str = Field(default="receipt-ocr-result", alias="KAFKA_RECEIPT_RESULT_TOPIC")
    kafka_receipt_retry_topic: str = Field(default="receipt-ocr-retry", alias="KAFKA_RECEIPT_RETRY_TOPIC")
    kafka_receipt_dlq_topic: str = Field(default="receipt-ocr-dlq", alias="KAFKA_RECEIPT_DLQ_TOPIC")
    kafka_consumer_group: str = Field(default="yeoun-worker-receipt", alias="KAFKA_CONSUMER_GROUP")

    kafka_photo_enabled: bool = Field(default=False, alias="KAFKA_PHOTO_ENABLED")
    kafka_photo_request_topic: str = Field(default="photo-processing-request", alias="KAFKA_PHOTO_REQUEST_TOPIC")
    kafka_photo_result_topic: str = Field(default="photo-processing-result", alias="KAFKA_PHOTO_RESULT_TOPIC")
    kafka_photo_retry_topic: str = Field(default="photo-processing-retry", alias="KAFKA_PHOTO_RETRY_TOPIC")
    kafka_photo_dlq_topic: str = Field(default="photo-processing-dlq", alias="KAFKA_PHOTO_DLQ_TOPIC")
    kafka_photo_consumer_group: str = Field(default="yeoun-worker-photo", alias="KAFKA_PHOTO_CONSUMER_GROUP")
    kafka_location_enabled: bool = Field(default=False, alias="KAFKA_LOCATION_ENABLED")
    kafka_location_request_topic: str = Field(default="trip-location-log-batch", alias="KAFKA_LOCATION_REQUEST_TOPIC")
    kafka_location_result_topic: str = Field(default="trip-location-log-result", alias="KAFKA_LOCATION_RESULT_TOPIC")
    kafka_location_retry_topic: str = Field(default="trip-location-log-retry", alias="KAFKA_LOCATION_RETRY_TOPIC")
    kafka_location_dlq_topic: str = Field(default="trip-location-log-dlq", alias="KAFKA_LOCATION_DLQ_TOPIC")
    kafka_location_consumer_group: str = Field(default="yeoun-worker-location", alias="KAFKA_LOCATION_CONSUMER_GROUP")
    kafka_auto_offset_reset: str = Field(default="earliest", alias="KAFKA_AUTO_OFFSET_RESET")
    kafka_max_retry_attempts: int = Field(default=3, alias="KAFKA_MAX_RETRY_ATTEMPTS")
    worker_database_url: str | None = Field(default=None, alias="WORKER_DATABASE_URL")
    gps_accuracy_threshold_m: float = Field(default=100.0, alias="GPS_ACCURACY_THRESHOLD_M")
    gps_jump_speed_threshold_mps: float = Field(default=60.0, alias="GPS_JUMP_SPEED_THRESHOLD_MPS")
    gps_stay_radius_m: float = Field(default=60.0, alias="GPS_STAY_RADIUS_M")
    gps_stay_min_duration_seconds: int = Field(default=300, alias="GPS_STAY_MIN_DURATION_SECONDS")
    gps_place_merge_radius_m: float = Field(default=120.0, alias="GPS_PLACE_MERGE_RADIUS_M")

    image_base_url: str = Field(default="http://localhost/images", alias="IMAGE_BASE_URL")
    photo_thumbnail_format: str = Field(default="JPEG", alias="PHOTO_THUMBNAIL_FORMAT")
    photo_thumbnail_max_size: int = Field(default=512, alias="PHOTO_THUMBNAIL_MAX_SIZE")
    photo_thumbnail_quality: int = Field(default=85, alias="PHOTO_THUMBNAIL_QUALITY")
    photo_gps_match_enabled: bool = Field(default=True, alias="PHOTO_GPS_MATCH_ENABLED")
    photo_gps_match_time_window_seconds: int = Field(default=1800, alias="PHOTO_GPS_MATCH_TIME_WINDOW_SECONDS")
    photo_gps_match_place_radius_m: float = Field(default=150.0, alias="PHOTO_GPS_MATCH_PLACE_RADIUS_M")
    photo_gps_match_log_radius_m: float = Field(default=120.0, alias="PHOTO_GPS_MATCH_LOG_RADIUS_M")
    aws_region: str = Field(default="ap-northeast-2", alias="AWS_REGION")
    aws_s3_bucket: str | None = Field(default=None, alias="AWS_S3_BUCKET")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, alias="AWS_SECRET_ACCESS_KEY")
    aws_s3_thumbnail_prefix: str = Field(default="thumbnails", alias="AWS_S3_THUMBNAIL_PREFIX")
    aws_s3_public_base_url: str | None = Field(default=None, alias="AWS_S3_PUBLIC_BASE_URL")
    gms_api_key: str | None = Field(default=None, alias="GMS_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    gemini_base_url: str = Field(
        default="https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta",
        alias="GEMINI_BASE_URL",
    )
    gemini_timeout_seconds: float = Field(default=60.0, alias="GEMINI_TIMEOUT_SECONDS")


@lru_cache
def get_settings() -> Settings:
    return Settings()
