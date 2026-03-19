# Yeoun Worker

`Worker`는 `EC2-2`에서 실행되는 비동기 처리 애플리케이션입니다.
현재 Worker는 Kafka 기반으로 영수증 OCR, 여행 사진 처리, 여행 GPS batch 처리를 담당하도록 구성되어 있습니다.

핵심 역할:

- 영수증 OCR 비동기 처리
- 여행 사진 메타데이터/썸네일 비동기 처리
- 여행 GPS batch 메시지 수신 및 후속 raw 저장/전처리 파이프라인 연결

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
  - 설정값에 따라 receipt/photo/location Kafka consumer를 시작하고 종료

- `app/config.py`
  - Worker 환경변수 로더
  - Kafka, Gemini, 이미지 URL, S3, GPS topic 설정 관리

- `app/routers/health.py`
  - 헬스체크 엔드포인트

- `app/routers/receipt.py`
  - 영수증 OCR HTTP 테스트 엔드포인트

- `app/schemas/receipt.py`
  - 영수증 OCR request/result/DLQ 메시지 스키마

- `app/schemas/photo.py`
  - 여행 사진 처리 request/result/DLQ 메시지 스키마

- `app/schemas/location.py`
  - 여행 GPS batch request/result/DLQ 메시지 스키마
  - `tripId`, `userId`, `requestedAt`, `clientLogUuid`, `recordedAt`, `latitude`, `longitude`, `accuracyM` 등의 필드를 표준화

- `app/services/receipt_ocr.py`
  - 영수증 이미지 OCR 처리

- `app/services/photo_loader.py`
  - 사진 원본 다운로드 및 이미지 로딩

- `app/services/photo_metadata.py`
  - EXIF 추출 및 메타데이터 정규화

- `app/services/photo_thumbnail.py`
  - 썸네일 생성 및 저장

- `app/services/location_pipeline.py`
  - 여행 GPS batch 처리 진입점
  - 현재는 Kafka 메시지 검증과 후속 raw 저장/전처리 파이프라인 연결을 위한 최소 뼈대

- `app/consumer/receipt_consumer.py`
  - 영수증 OCR Kafka consumer
  - 처리 성공 시 result 발행, 실패 시 retry 또는 DLQ 발행

- `app/consumer/photo_consumer.py`
  - 여행 사진 Kafka consumer
  - 이미지 다운로드, EXIF 정규화, 썸네일 생성 후 result 발행

- `app/consumer/location_consumer.py`
  - 여행 GPS batch Kafka consumer
  - `trip-location-log-batch` / retry 토픽 consume
  - 처리 성공 시 result 발행, 실패 시 retry 또는 DLQ 발행
  - 현재는 raw 저장/전처리 파이프라인의 첫 진입점 역할

## 실행 방법

### 1. HTTP 서버 실행

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Kafka consumer를 끄고 싶으면 `.env`에서 해당 기능 플래그를 `false`로 설정합니다.

### 2. Kafka consumer 실행

Worker는 FastAPI 앱 라이프사이클에서 consumer를 같이 시작합니다.

기능별 플래그:

- `KAFKA_ENABLED=true` : 영수증 OCR consumer 활성화
- `KAFKA_PHOTO_ENABLED=true` : 여행 사진 consumer 활성화
- `KAFKA_LOCATION_ENABLED=true` : 여행 GPS batch consumer 활성화

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
- `KAFKA_RECEIPT_REQUEST_TOPIC`
- `KAFKA_PHOTO_REQUEST_TOPIC`
- `KAFKA_LOCATION_REQUEST_TOPIC`
- `KAFKA_LOCATION_RESULT_TOPIC`
- `KAFKA_LOCATION_RETRY_TOPIC`
- `KAFKA_LOCATION_DLQ_TOPIC`
- `KAFKA_LOCATION_CONSUMER_GROUP`
- `IMAGE_BASE_URL`
- `AWS_S3_BUCKET`
- `GEMINI_MODEL`

자세한 예시는 `.env.example`을 참고합니다.

## 현재 상태

현재 Worker는 아래 기능이 준비되어 있습니다.

- 영수증 OCR Kafka 처리
- 여행 사진 Kafka 처리
- 여행 GPS batch Kafka consumer 및 이벤트 스키마 뼈대

여행 GPS 쪽 다음 단계는 아래 순서로 이어집니다.

1. GPS batch 메시지를 Worker에서 consume
2. raw GPS를 Postgres에 저장
3. idempotency 처리
4. GPS clean/stay/route 전처리 파이프라인 연결
