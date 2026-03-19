# Yeoun Worker

`Worker`는 `EC2-2`에서 실행되는 AI/비동기 처리용 애플리케이션입니다.
현재 구조에서는 node2 nginx 뒤에서 실행되며, Kafka 기반 비동기 처리와 HTTP 직접 호출 두 방식을 모두 지원할 수 있게 설계되어 있습니다.
현재 이 폴더에 우선 구현된 기능은 영수증 OCR/멀티모달 처리 파이프라인입니다.

## 역할

- 백엔드가 전달한 비동기 작업을 처리
- 현재는 영수증 이미지 분석 및 OCR/멀티모달 추출 기능 제공
- Kafka request topic을 소비하고 result topic으로 결과를 발행
- 실패 시 retry / DLQ 흐름 처리
- 백엔드가 저장할 수 있는 형태의 JSON 결과 반환

## 현재 폴더 구조

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
      receipt_ocr.py
    consumer/
      photo_consumer.py
      receipt_consumer.py
  requirements.txt
  .env.example
  Dockerfile
```

### 파일/폴더 설명

- `app/main.py`
  - FastAPI 애플리케이션 진입점
  - 서버 시작 시 Kafka consumer를 함께 올릴지 결정

- `app/config.py`
  - Worker에서 사용하는 환경변수를 읽고 설정 객체로 관리
  - Kafka, Gemini, 포트 관련 설정을 여기서 정의

- `app/routers/health.py`
  - 헬스체크용 엔드포인트 제공
  - 배포 후 컨테이너 상태 확인에 사용

- `app/routers/receipt.py`
  - 영수증 OCR HTTP 요청을 받는 라우터
  - Kafka 없이 직접 OCR 테스트할 때 사용 가능

- `app/schemas/receipt.py`
  - 영수증 OCR 요청/응답 모델 정의
  - Kafka request/result/dlq 메시지 스키마도 함께 정의

- `app/schemas/photo.py`
  - 여행 사진 처리 request/result/dlq 메시지 스키마 정의
  - 타임라인 생성에 필요한 촬영 시각/좌표/썸네일/메타데이터 필드 초안 포함

- `app/services/receipt_ocr.py`
  - 실제 영수증 분석 로직 담당
  - 이미지 다운로드 후 Gemini API를 호출하고 결과를 구조화

- `app/services/photo_loader.py`
  - 여행 사진 원본 다운로드 및 이미지 로더
  - `imageUrl` 우선, 없으면 `IMAGE_BASE_URL + storageKey` 조합으로 원본을 읽고 Pillow로 이미지 열기

- `app/services/photo_metadata.py`
  - 여행 사진 EXIF 메타데이터 추출 및 정규화 로직
  - 촬영 시각, GPS 좌표, orientation, camera make/model 을 읽고 타임라인 생성용 시간/위치 값으로 정리

- `app/consumer/photo_consumer.py`
  - 여행 사진 처리용 Kafka consumer/producer 뼈대
  - 현재는 메시지 검증 후 원본 다운로드, 이미지 로딩, EXIF 시간/위치 추출 및 정규화까지 수행하며 실제 썸네일 처리 로직은 후속 작업 범위

- `app/consumer/receipt_consumer.py`
  - Kafka에서 영수증 OCR 요청 메시지를 소비
  - OCR 처리 후 result topic 발행, 실패 시 retry/DLQ 처리

## 실행 방식

### 1. HTTP 직접 실행

Kafka 없이 Worker OCR 동작만 확인할 때 사용합니다.

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

이 경우 `.env`에서 `KAFKA_ENABLED=false`로 두고 테스트할 수 있습니다.

### 2. Kafka 비동기 실행

실제 목표 구조입니다.

- 백엔드가 `receipt-ocr-request` 토픽에 메시지 발행
- Worker가 메시지를 consume
- OCR 처리 후 `receipt-ocr-result` 토픽에 결과 발행
- 실패 시 retry 또는 `receipt-ocr-dlq`로 이동

이 경우 `.env`에서 `KAFKA_ENABLED=true`로 두고 Kafka 연결 정보를 맞춰야 합니다.

## 주요 엔드포인트

- `GET /`
- `GET /health`
- `POST /api/v1/ocr/receipts/extract`

## HTTP 요청 예시

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
- `imageUrl`은 Worker가 직접 다운로드할 수 있는 주소여야 합니다.
- `localhost` 기반 URL은 Worker가 다른 머신에서 실행될 경우 사용할 수 없습니다.
- 운영 기준으로는 S3 또는 외부 저장소 URL을 사용하는 방식이 적합합니다.

## Kafka 메시지 기준

### request topic

- 토픽명: `receipt-ocr-request`
- 주요 필드:
  - `receiptId`
  - `tripId`
  - `imageUrl`
  - `currencyCode`
  - `locale`
  - `requestedAt`
  - `attempt`

### result topic

- 토픽명: `receipt-ocr-result`
- 성공 시:
  - `status=COMPLETED`
  - `merchantName`
  - `paidAt`
  - `totalAmount`
  - `taxAmount`
  - `lineItems`
  - `rawText`
- 실패 시:
  - `status=FAILED`
  - `errorCode`
  - `errorMessage`

### dlq topic

- 토픽명: `receipt-ocr-dlq`
- 최대 재시도 초과 메시지를 저장

### travel photo processing topics

- request topic: `photo-processing-request`
- result topic: `photo-processing-result`
- retry topic: `photo-processing-retry`
- dlq topic: `photo-processing-dlq`
- 현재 단계에서는 request/result/dlq 스키마와 consumer/producer 뼈대만 추가된 상태
- 실제 이미지 다운로드, EXIF 추출, 정규화, 썸네일 생성은 후속 작업에서 구현 예정
  - 현재 단계에서는 원본 다운로드와 Pillow 기반 이미지 로딩, EXIF 시간/위치 추출 및 정규화까지 구현됨

## 환경변수

실제 Docker compose 실행 시에는 `Infra/docker/node2/.env`가 더 중요합니다.
`Worker/.env.example`는 Worker 단독 실행 시 참고용 예시 파일로 보면 됩니다.

여행 사진 처리 관련 주요 예시 값:

- `KAFKA_PHOTO_ENABLED=false`
- `KAFKA_PHOTO_REQUEST_TOPIC=photo-processing-request`
- `KAFKA_PHOTO_RESULT_TOPIC=photo-processing-result`
- `KAFKA_PHOTO_RETRY_TOPIC=photo-processing-retry`
- `KAFKA_PHOTO_DLQ_TOPIC=photo-processing-dlq`
- `KAFKA_PHOTO_CONSUMER_GROUP=yeoun-worker-photo`

## 현재 구현 상태

- Gemini 2.5 Flash 기반 영수증 추출 코드 구현됨
- Kafka request/result/retry/dlq 구조 반영됨
- manual commit 기반 consumer 처리 반영됨
- 여행 사진 처리용 Kafka 스키마와 consumer/producer 뼈대 추가됨
- 여행 사진 원본 다운로드 및 이미지 로더 구현됨
- 여행 사진 EXIF 메타데이터 추출 및 시간/위치 정규화 구현됨
- `KAFKA_PHOTO_ENABLED=false` 기본값으로 안전하게 비활성화되어 있음

아직 필요한 것:

- 백엔드의 request producer
- 백엔드의 result consumer
- 이미지 저장소 연동
- 여행 사진 썸네일 생성 및 저장
- 프론트의 OCR 상태 조회 및 수정 UI 연동
