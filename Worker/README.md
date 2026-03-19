# Yeoun Worker

`Worker`는 `EC2-2`에서 실행되는 AI 및 비동기 처리 전용 애플리케이션입니다.
현재 구조에서는 node2 nginx 뒤에서 실행되며, Kafka 기반 백그라운드 작업과 직접 HTTP 호출을 모두 지원하도록 설계되어 있습니다.

현재 구현된 파이프라인:

- 영수증 OCR 파이프라인
- 여행 사진 처리 파이프라인 초안

## 역할

- 백엔드가 전달한 비동기 작업을 소비하고 처리
- 이미지 기반 작업을 Worker 노드에서 전담 수행
- 백엔드가 저장할 수 있는 구조화된 JSON 결과 생성
- 실패 시 retry 및 DLQ 흐름 처리

## 폴더 구조

```text
Worker/
  app/
    main.py
    config.py
    routers/
      health.py
      receipt.py
    schemas/
      photo.py
      receipt.py
    services/
      photo_loader.py
      photo_metadata.py
      photo_thumbnail.py
      receipt_ocr.py
    consumer/
      photo_consumer.py
      receipt_consumer.py
  requirements.txt
  .env.example
  Dockerfile
```

## 파일 설명

- `app/main.py`
  - FastAPI 진입점
  - 환경변수 설정에 따라 Kafka consumer를 조건부로 시작

- `app/config.py`
  - Worker 설정을 한 곳에서 관리
  - Kafka, Gemini, 이미지 원본 URL, 썸네일 생성 옵션 정의

- `app/routers/health.py`
  - 헬스체크 엔드포인트 제공

- `app/routers/receipt.py`
  - 영수증 OCR HTTP 테스트용 엔드포인트

- `app/schemas/receipt.py`
  - 영수증 OCR request/response 모델
  - 영수증 Kafka request/result/dlq 메시지 스키마

- `app/schemas/photo.py`
  - 여행 사진 처리 request/result/dlq 메시지 스키마
  - 타임라인 생성을 위한 촬영 시각, 좌표, 썸네일 key 관련 필드 포함

- `app/services/receipt_ocr.py`
  - 영수증 이미지를 다운로드하고 Gemini OCR 호출

- `app/services/photo_loader.py`
  - 여행 사진 원본 다운로드
  - `imageUrl`이 있으면 우선 사용하고, 없으면 `IMAGE_BASE_URL + storageKey` 로 원본 URL 구성
  - 다운로드한 파일이 실제 이미지인지 검증

- `app/services/photo_metadata.py`
  - 여행 사진 EXIF 메타데이터 추출
  - 촬영 시각과 GPS 좌표를 타임라인 생성에 맞게 정규화

- `app/services/photo_thumbnail.py`
  - 여행 사진 썸네일 생성 및 S3 업로드
  - EXIF orientation 반영 후 리사이즈 수행

- `app/consumer/receipt_consumer.py`
  - 영수증 OCR Kafka 메시지 소비
  - result, retry, dlq 메시지 발행

- `app/consumer/photo_consumer.py`
  - 여행 사진 처리 consumer/producer 뼈대
  - 현재는 request 검증, 원본 다운로드, EXIF 추출/정규화, 썸네일 생성/S3 업로드까지 수행

## 실행 방식

### 1. HTTP 직접 테스트

Kafka 없이 영수증 OCR HTTP 흐름만 확인할 때 사용합니다.

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

이 경우 `KAFKA_ENABLED=false` 로 설정하면 됩니다.

### 2. Kafka 비동기 Worker

운영 기준 흐름:

- 백엔드가 `receipt-ocr-request` 또는 `photo-processing-request` 발행
- Worker가 메시지 consume
- Worker가 작업 처리
- Worker가 result 또는 retry/DLQ 메시지 발행

이 방식에서는 Kafka 연결 정보와 각 consumer 활성화 여부를 맞춰야 합니다.

## 엔드포인트

- `GET /`
- `GET /health`
- `POST /api/v1/ocr/receipts/extract`

## 영수증 OCR 요청 예시

```json
{
  "receiptId": "7e0df1f0-25e8-4ae2-b3f4-a7c7d07e8b35",
  "tripId": "c0a1c6f2-a25b-4b1d-9312-3cb1e4f1ce0f",
  "imageUrl": "https://example.com/receipts/receipt-001.jpg",
  "currencyCode": "KRW",
  "locale": "ko-KR"
}
```

주의:

- `imageUrl`은 Worker 서버에서 접근 가능해야 합니다.
- `localhost` URL은 Worker가 다른 머신에서 실행되면 사용할 수 없습니다.
- 운영에서는 공개 URL 또는 presigned URL 사용이 적절합니다.

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

현재 구현 범위:

- request/result/dlq 메시지 스키마 정의
- consumer/producer 뼈대 추가
- 원본 이미지 다운로드 및 이미지 로딩 구현
- EXIF 촬영 시각 / GPS 추출 및 정규화 구현
- 썸네일 생성 및 S3 업로드 구현

## 주요 환경변수

- `KAFKA_PHOTO_ENABLED=false`
- `KAFKA_PHOTO_REQUEST_TOPIC=photo-processing-request`
- `KAFKA_PHOTO_RESULT_TOPIC=photo-processing-result`
- `KAFKA_PHOTO_RETRY_TOPIC=photo-processing-retry`
- `KAFKA_PHOTO_DLQ_TOPIC=photo-processing-dlq`
- `KAFKA_PHOTO_CONSUMER_GROUP=yeoun-worker-photo`
- `IMAGE_BASE_URL=http://localhost/images`
- `PHOTO_THUMBNAIL_FORMAT=JPEG`
- `PHOTO_THUMBNAIL_MAX_SIZE=512`
- `PHOTO_THUMBNAIL_QUALITY=85`
- `AWS_REGION=ap-northeast-2`
- `AWS_S3_BUCKET=your_bucket_name`
- `AWS_ACCESS_KEY_ID=your_access_key`
- `AWS_SECRET_ACCESS_KEY=your_secret_key`
- `AWS_S3_THUMBNAIL_PREFIX=thumbnails`
- `AWS_S3_PUBLIC_BASE_URL=https://your-bucket.s3.ap-northeast-2.amazonaws.com`

## 현재 구현 상태

구현됨:

- Gemini 2.5 Flash 기반 영수증 OCR 파이프라인
- 영수증 Kafka request/result/retry/dlq 흐름
- 여행 사진 Kafka 스키마 및 consumer/producer 뼈대
- 여행 사진 원본 다운로드 및 이미지 로더
- 여행 사진 EXIF 메타데이터 추출 및 시간/위치 정규화
- 여행 사진 썸네일 생성 및 S3 업로드

아직 필요한 것:

- 백엔드의 여행 사진 request producer
- 백엔드의 여행 사진 result consumer
- 여행 사진 처리 결과 메시지 발행
- 여행 사진 retry/DLQ 처리
