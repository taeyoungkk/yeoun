# Yeoun Worker

`Worker`는 `EC2-2`에서 실행되는 비동기 처리 애플리케이션입니다.
현재 Worker는 Kafka 기반으로 영수증 OCR, 여행 사진 처리, 여행 GPS batch 처리 기능을 담당합니다.

## 현재 지원 기능

- 영수증 OCR Kafka 처리
- 여행 사진 메타데이터/썸네일 Kafka 처리
- 여행 GPS batch Kafka consumer
- 여행 GPS raw 로그 Postgres 저장
- `(trip_id, user_id, client_log_uuid)` 기준 idempotency 처리
- GPS 처리 실패 시 retry / DLQ 발행
- GPS payload 검증 실패 시 즉시 DLQ 발행

## 디렉터리 구조

```text
Worker/
  app/
    main.py
    config.py
    routers/
      health.py
      receipt.py
    schemas/
      location.py
      photo.py
      receipt.py
    services/
      location_log_writer.py
      location_pipeline.py
      photo_loader.py
      photo_metadata.py
      photo_thumbnail.py
      receipt_ocr.py
    consumer/
      location_consumer.py
      photo_consumer.py
      receipt_consumer.py
  requirements.txt
  .env.example
  Dockerfile
```

## 주요 파일

- `app/main.py`
  - FastAPI 엔트리포인트
  - 설정값에 따라 receipt/photo/location consumer를 시작하고 종료

- `app/config.py`
  - Worker 환경변수 로더
  - Kafka, DB, Gemini, 이미지 URL, S3 관련 설정 관리

- `app/schemas/location.py`
  - 여행 GPS batch request/result/DLQ 메시지 스키마

- `app/services/location_log_writer.py`
  - Kafka로 수신한 GPS raw 로그를 `location_logs_raw`에 저장
  - `(trip_id, user_id, client_log_uuid)` 기준으로 중복 저장 방지

- `app/services/location_pipeline.py`
  - GPS batch 처리 진입점
  - 현재는 raw 저장 단계까지 연결

- `app/consumer/location_consumer.py`
  - `trip-location-log-batch` / retry 토픽 consume
  - 처리 성공 시 result topic 발행
  - 처리 실패 시 retry 또는 DLQ 발행
  - payload 검증 실패 시 즉시 DLQ 발행

## GPS 처리 흐름

1. Backend가 `trip-location-log-batch` 토픽으로 GPS batch 메시지 발행
2. Worker의 `location_consumer`가 메시지 consume
3. `location_pipeline`이 raw 저장 파이프라인 실행
4. `location_log_writer`가 `location_logs_raw` 테이블에 저장
5. 저장 결과를 result topic으로 발행
6. 실패 시 retry 또는 DLQ topic으로 발행

## Kafka 토픽

### 영수증 OCR

- Request: `receipt-ocr-request`
- Result: `receipt-ocr-result`
- Retry: `receipt-ocr-retry`
- DLQ: `receipt-ocr-dlq`

### 여행 사진 처리

- Request: `photo-processing-request`
- Result: `photo-processing-result`
- Retry: `photo-processing-retry`
- DLQ: `photo-processing-dlq`

### 여행 GPS batch 처리

- Request: `trip-location-log-batch`
- Result: `trip-location-log-result`
- Retry: `trip-location-log-retry`
- DLQ: `trip-location-log-dlq`

## 환경변수

주요 항목:

- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_MAX_RETRY_ATTEMPTS`
- `KAFKA_LOCATION_ENABLED`
- `KAFKA_LOCATION_REQUEST_TOPIC`
- `KAFKA_LOCATION_RESULT_TOPIC`
- `KAFKA_LOCATION_RETRY_TOPIC`
- `KAFKA_LOCATION_DLQ_TOPIC`
- `KAFKA_LOCATION_CONSUMER_GROUP`
- `WORKER_DATABASE_URL`
- `IMAGE_BASE_URL`
- `AWS_S3_BUCKET`
- `GEMINI_MODEL`

자세한 값은 `.env.example`을 참고합니다.

## 실행 방법

### HTTP 서버 실행

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Kafka consumer 활성화

`.env`에서 기능 플래그를 `true`로 설정합니다.

- `KAFKA_ENABLED=true`
- `KAFKA_PHOTO_ENABLED=true`
- `KAFKA_LOCATION_ENABLED=true`

## 다음 단계

여행 GPS 쪽 다음 단계는 아래 순서로 이어집니다.

1. processing status 갱신
2. GPS clean pipeline 연결
3. stay detection
4. route / place 생성
