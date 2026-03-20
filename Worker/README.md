# Yeoun Worker

`Worker`는 `EC2-2`에서 실행되는 비동기 처리 애플리케이션입니다.
현재 Worker는 Kafka 기반으로 영수증 OCR, 여행 사진 처리, 여행 GPS batch 처리 기능을 담당합니다.

## 현재 지원 기능

- 영수증 OCR Kafka 처리
- 여행 사진 메타데이터/썸네일 Kafka 처리
- 여행 사진 처리 결과(정규화 메타데이터/썸네일) DB 반영
- 여행 사진-GPS 자동 매칭 후보 계산
- 여행 사진 place 연결 및 대표 사진 선정 구조 반영
- 여행 사진 타임라인 candidate 저장 및 후속 연결 구조 반영
- 여행 GPS batch Kafka consumer
- 여행 GPS raw 로그 Postgres 저장
- `(trip_id, user_id, client_log_uuid)` 기준 idempotency 처리
- GPS 처리 실패 시 retry / DLQ 발행
- GPS payload 검증 실패 시 즉시 DLQ 발행
- GPS 1차 전처리 파이프라인 실행
- 정렬, near-duplicate 제거, accuracy 필터, jump outlier 제거
- trip processing status 갱신
- 전처리 결과 clean GPS 로그 영속화
- clean GPS 기반 stay detection 수행
- move/stay segment 분리 및 일자별 route 생성
- stay segment 기반 place 후보 생성 및 병합
- place 재처리 시 동일 결과를 유지하는 결정적 place_id 생성
- route/place 후속 결과 저장
- raw/clean/route/place/READY status 단일 트랜잭션 처리
- 타임라인 연결용 candidate 생성
- 후속 GPS 파이프라인 진입점 분리

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
      location_followup_pipeline.py
      location_log_writer.py
      location_place_builder.py
      location_place_writer.py
      location_pipeline.py
      location_preprocessor.py
      location_route_builder.py
      location_route_writer.py
      location_stay_detector.py
      location_timeline_linker.py
      photo_gps_matcher.py
      photo_loader.py
      photo_metadata.py
      photo_place_linker.py
      photo_processing_pipeline.py
      photo_result_writer.py
      photo_timeline_candidate_writer.py
      photo_timeline_linker.py
      photo_thumbnail.py
      receipt_ocr.py
      trip_processing_status.py
    consumer/
      location_consumer.py
      photo_consumer.py
      receipt_consumer.py
  sql/
    create_location_logs_clean.sql
    create_location_places.sql
    create_location_route_days.sql
    create_photo_timeline_candidates.sql
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

- `app/schemas/photo.py`
  - 여행 사진 처리 request/result/DLQ 메시지 스키마
  - GPS 자동 매칭 결과 스키마

- `app/consumer/photo_consumer.py`
  - `photo-processing-request` / retry 토픽 consume
  - EXIF 추출, 정규화, 썸네일 생성 수행
  - GPS clean/place 데이터를 조회해 자동 매칭 후보 계산
  - 처리 성공 시 결과를 `photos` 테이블과 result topic에 반영
  - place 연결 및 대표 사진 선정 결과까지 함께 반영
  - 처리 실패 시 retry 또는 DLQ 발행

- `app/services/photo_gps_matcher.py`
  - 정규화된 사진 시각/좌표를 기준으로 GPS clean 로그 및 place 후보 자동 매칭
  - EXIF 좌표+시간 우선, 없으면 시간 기준 최근접 clean 로그로 fallback

- `app/services/photo_place_linker.py`
  - 같은 place로 매칭된 사진들을 조회해 대표 사진 순위를 계산
  - `placeLink`, `representativeSelection` 구조를 `photos.metadata_json`에 반영

- `app/services/photo_processing_pipeline.py`
  - 사진 처리 결과 반영과 place 연결/대표 사진 선정을 하나의 DB 트랜잭션으로 처리
  - 사진 타임라인 candidate 생성 및 저장까지 후속 파이프라인으로 연결

- `app/services/photo_timeline_linker.py`
  - 사진 처리 결과를 타임라인 생성용 candidate로 변환
  - place 연결 여부에 따라 `PLACE_PHOTO`, `UNMATCHED_PHOTO` 타입 분기

- `app/services/photo_timeline_candidate_writer.py`
  - 사진 타임라인 candidate를 `photo_timeline_candidates` 테이블에 upsert 저장

- `app/services/photo_result_writer.py`
  - Worker가 계산한 사진 처리 결과를 `photos` 테이블에 업데이트
  - 정규화된 촬영 시각/좌표, 썸네일 키, 메타데이터 JSON 반영

- `app/schemas/location.py`
  - 여행 GPS batch request/result/DLQ 메시지 스키마

- `app/services/location_log_writer.py`
  - Kafka로 수신한 GPS raw 로그를 `location_logs_raw`에 저장
  - `(trip_id, user_id, client_log_uuid)` 기준으로 중복 저장 방지

- `app/services/location_pipeline.py`
  - GPS batch 처리 진입점
  - `PROCESSING -> READY/FAILED` 상태 전이 관리
  - raw 저장 후 1차 전처리, clean 로그 저장, 후속 파이프라인까지 연결
  - raw/clean/route/place/READY status를 하나의 DB 트랜잭션으로 처리

- `app/services/location_clean_writer.py`
  - 전처리된 clean GPS 로그를 `location_logs_clean` 테이블에 저장
  - `(trip_id, user_id, client_log_uuid)` 기준으로 중복 저장 방지

- `app/services/location_preprocessor.py`
  - recordedAt 기준 정렬
  - near-duplicate 제거
  - accuracy threshold 초과 포인트 제거
  - 비정상 jump/outlier 제거

- `app/services/trip_processing_status.py`
  - `trip_processing_statuses` 테이블 갱신
  - `PROCESSING`, `READY`, `FAILED` 상태 전이 처리

- `app/services/location_followup_pipeline.py`
  - clean GPS 기준 stay detection 실행
  - move/stay segment 분리 및 일자별 route 생성
  - place 후보 생성 및 병합
  - route/place 저장 및 timeline candidate 생성

- `app/services/location_stay_detector.py`
  - clean GPS 데이터를 기반으로 체류 구간을 탐지
  - 반경/시간 기준의 contiguous stay segment 계산

- `app/services/location_route_builder.py`
  - stay segment를 제외한 이동 구간을 move segment로 구성
  - move segment를 일자별 route로 집계

- `app/services/location_place_builder.py`
  - stay segment를 place 후보로 변환
  - 인접한 place 후보를 거리 기준으로 병합
  - 같은 stay segment 묶음이면 동일한 place_id를 생성하도록 멱등성 보장

- `app/services/location_route_writer.py`
  - 일자별 route 결과를 `location_route_days` 테이블에 저장

- `app/services/location_place_writer.py`
  - 병합된 place 결과를 `location_places` 테이블에 저장

- `app/services/location_timeline_linker.py`
  - route/place 결과를 timeline 연결용 candidate로 변환
  - 현재는 후보 payload 생성과 로깅만 수행

- `sql/create_location_logs_clean.sql`
  - Worker 기준 clean GPS 저장 테이블 초안
  - 백엔드 migration 설계 시 기준이 되는 SQL 스키마

- `sql/create_location_route_days.sql`
  - Worker 기준 route day 저장 테이블 초안

- `sql/create_location_places.sql`
  - Worker 기준 place 저장 테이블 초안

- `app/consumer/location_consumer.py`
  - `trip-location-log-batch` / retry 토픽 consume
  - 처리 성공 시 result topic 발행
  - 처리 실패 시 retry 또는 DLQ 발행
  - payload 검증 실패 시 즉시 DLQ 발행

## GPS 처리 흐름

1. Backend가 `trip-location-log-batch` 토픽으로 GPS batch 메시지 발행
2. Worker의 `location_consumer`가 메시지 consume
3. `location_pipeline`이 raw 저장 파이프라인 실행
4. `location_pipeline`이 trip processing status를 `PROCESSING`으로 갱신
5. `location_log_writer`가 `location_logs_raw` 테이블에 저장
6. `location_preprocessor`가 1차 clean 파이프라인 실행
7. `location_clean_writer`가 `location_logs_clean` 테이블에 저장
8. `location_followup_pipeline`이 stay detection, move/stay 분리, route 생성, place 생성 실행
9. route/place 결과를 Worker 기준 저장 테이블에 반영
10. timeline 연결용 candidate를 생성
11. 성공 시 trip processing status를 `READY`로 갱신하고 result topic 발행
12. 실패 시 trip processing status를 `FAILED`로 갱신하고 retry 또는 DLQ topic으로 발행

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
- `GPS_ACCURACY_THRESHOLD_M`
- `GPS_JUMP_SPEED_THRESHOLD_MPS`
- `GPS_STAY_RADIUS_M`
- `GPS_STAY_MIN_DURATION_SECONDS`
- `GPS_PLACE_MERGE_RADIUS_M`
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

1. timeline / photo 매칭 연결 고도화
