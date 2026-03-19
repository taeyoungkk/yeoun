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
    kafka_auto_offset_reset: str = Field(default="earliest", alias="KAFKA_AUTO_OFFSET_RESET")
    kafka_max_retry_attempts: int = Field(default=3, alias="KAFKA_MAX_RETRY_ATTEMPTS")

    image_base_url: str = Field(default="http://localhost/images", alias="IMAGE_BASE_URL")
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
