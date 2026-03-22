# Yeoun Worker

`Worker`는 Kafka 기반 비동기 처리 서버다. 현재 영수증 OCR, 여행 사진 후처리, 여행 GPS 전처리 파이프라인을 담당한다.

## 담당 기능

- 영수증 OCR 요청 consume, 결과/result, retry, DLQ 처리
- 여행 사진 처리 요청 consume, EXIF 추출, 썸네일 생성, GPS 매칭, 대표 사진 선정
- 여행 사진 처리 결과 DB 반영, place/event 링크 저장, 타임라인 후보 저장
- 여행 사진 수동보정 후보 저장
- 여행 GPS batch consume, raw 저장, clean 전처리, stay/route/place 생성
- 여행 GPS 처리 상태 갱신

## 주요 디렉터리

```text
Worker/
  app/
    main.py
    config.py
    consumer/
      location_consumer.py
      photo_consumer.py
      receipt_consumer.py
    schemas/
      location.py
      photo.py
      receipt.py
    services/
      location_*.py
      photo_*.py
      receipt_ocr.py
      trip_processing_status.py
  sql/
    create_location_logs_clean.sql
    create_location_places.sql
    create_location_route_days.sql
    create_photo_event_links.sql
    create_photo_manual_review_candidates.sql
    create_photo_place_links.sql
    create_photo_processing_statuses.sql
    create_photo_timeline_candidates.sql
  .env.example
  Dockerfile
```

## 여행 사진 파이프라인

1. `photo-processing-request` 또는 retry 토픽 consume
2. 원본 이미지 다운로드
3. EXIF 메타데이터 추출 및 촬영 시각/좌표 정규화
4. 썸네일 생성
5. GPS clean/place 기준 자동 매칭
6. place 연결 및 대표 사진 선정
7. 타임라인 후보 생성
8. 수동보정 후보 생성
9. 결과를 DB에 반영하고 result topic 발행
10. 실패 시 retry 또는 DLQ 처리

## 여행 사진 저장 구조

- `photos`
  - EXIF/정규화 시각/좌표, 썸네일 키, metadata JSON 반영
- `photo_processing_statuses`
  - `PROCESSING`, `READY`, `RETRY_SCHEDULED`, `DLQ`
- `photo_place_links`
  - 사진의 place 연결 결과와 대표 사진 선정 결과 저장
- `photo_event_links`
  - 사진의 event/timeline 연결 결과 저장
- `photo_timeline_candidates`
  - 후속 타임라인 생성용 후보 저장
- `photo_manual_review_candidates`
  - 자동 매칭 실패 또는 낮은 신뢰도 결과 저장
- `photo_rebuild_pipeline`
  - trip 단위로 기존 사진을 다시 읽어 GPS 매칭, place/event 링크, 수동보정 후보를 재계산

## 여행 사진 수동보정 후보 규칙

- GPS 매칭 결과가 없으면 `UNMATCHED`
- GPS 매칭 점수가 `PHOTO_MANUAL_REVIEW_SCORE_THRESHOLD` 미만이면 `LOW_CONFIDENCE_MATCH`
- 수동보정 후보는 `photo_manual_review_candidates`에 저장

## 여행 사진 재처리

- `PhotoRebuildPipeline.rebuild_trip(trip_id)`로 trip 단위 재처리를 수행할 수 있다.
- 기존 `photos` 테이블의 저장 결과를 읽어 GPS 매칭, place/event 링크, timeline candidate, 수동보정 후보를 다시 계산한다.
- 재처리 시 `photo_timeline_candidates`, `photo_event_links`, `photo_manual_review_candidates`는 사진 단위로 교체 저장된다.

## 여행 GPS 파이프라인

1. `trip-location-log-batch` 또는 retry 토픽 consume
2. `PROCESSING` 상태 갱신
3. raw GPS 저장
4. clean GPS 생성 및 저장
5. stay detection
6. move/stay segment 분리
7. day별 route 생성
8. place 생성 및 병합
9. route/place 저장
10. 타임라인 후보 생성
11. 성공 시 `READY`, 실패 시 `FAILED` 처리

## 환경 변수

주요 변수:

- `KAFKA_BOOTSTRAP_SERVERS`
- `KAFKA_MAX_RETRY_ATTEMPTS`
- `KAFKA_PHOTO_ENABLED`
- `KAFKA_LOCATION_ENABLED`
- `WORKER_DATABASE_URL`
- `PHOTO_GPS_MATCH_ENABLED`
- `PHOTO_GPS_MATCH_TIME_WINDOW_SECONDS`
- `PHOTO_GPS_MATCH_PLACE_RADIUS_M`
- `PHOTO_GPS_MATCH_LOG_RADIUS_M`
- `PHOTO_MANUAL_REVIEW_SCORE_THRESHOLD`
- `GPS_ACCURACY_THRESHOLD_M`
- `GPS_STAY_RADIUS_M`
- `GPS_STAY_MIN_DURATION_SECONDS`

## 실행

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Kafka consumer를 함께 실행하려면 `.env`에서 각 기능별 Kafka 플래그를 `true`로 설정한다.

- `KAFKA_ENABLED=true`
- `KAFKA_PHOTO_ENABLED=true`
- `KAFKA_LOCATION_ENABLED=true`
