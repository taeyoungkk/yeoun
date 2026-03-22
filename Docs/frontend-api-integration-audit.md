# Frontend API Integration Audit

## 목적

현재 프론트엔드와 백엔드의 API 연동 상태를 점검하고, 실제 연동 여부와 스펙 불일치를 기록한다.

- 기준일: 2026-03-20
- 기준 범위: `Frontend/yeoun-client`, `Backend/src/main/java/com/yeoun`
- 주의: 아래 내용은 코드 기준 점검 결과이며, 목업 데이터는 유지 전제다.

## 1. 현재 프론트에서 실제 API 호출이 있는 영역

### 인증

- 구현 파일: `Frontend/yeoun-client/src/api/auth.ts`
- 연결 화면:
  - `Frontend/yeoun-client/src/features/auth/screens/LoginScreen.tsx`
  - `Frontend/yeoun-client/src/features/auth/screens/RegisterScreen.tsx`
  - `Frontend/yeoun-client/src/features/auth/screens/ForgotPasswordScreen.tsx`
- 호출 중인 API:
  - `POST /auth/login`
  - `POST /auth/oauth/google`
  - `POST /auth/email/code`
  - `POST /auth/email/verify`
  - `POST /auth/signup`
  - `POST /auth/password/reset/request`
  - `POST /auth/password/reset/confirm`
  - `POST /auth/logout`
  - `POST /auth/refresh`

### 사용자

- 구현 파일: `Frontend/yeoun-client/src/api/user.ts`
- 연결 화면:
  - `Frontend/yeoun-client/app/(tabs)/mypage.tsx`
  - `Frontend/yeoun-client/app/edit-profile.tsx`
  - `Frontend/yeoun-client/app/settings.tsx`
- 호출 중인 API:
  - `GET /users/me`
  - `PATCH /users/me`
  - `PATCH /users/me/password`
  - `DELETE /users/me`

### 여행

- 구현 파일: `Frontend/yeoun-client/src/api/trip.ts`
- 연결 화면/서비스:
  - `Frontend/yeoun-client/src/features/trip/screens/TripStartScreen.tsx`
  - `Frontend/yeoun-client/src/features/trip/screens/TripRecordingScreen.tsx`
  - `Frontend/yeoun-client/src/features/home/components/PastTravelSection.tsx`
  - `Frontend/yeoun-client/src/services/locationService.ts`
- 호출 중인 API:
  - `POST /trips`
  - `GET /trips`
  - `GET /trips/{tripId}`
  - `POST /trips/{tripId}/start`
  - `POST /trips/{tripId}/end`
  - 위치 업로드용 endpoint 호출 시도

## 2. 현재 프론트에서 목업 중심인 영역

### 친구

- 현재 프론트에는 친구 검색, 친구 요청, 받은 요청 목록, 보낸 요청 목록, 수락/거절, 친구 목록용 전용 화면이 없다.
- 프론트 API 모듈도 없다.
- 즉, 기존 화면에 API만 붙이는 작업이 아니라 신규 구축 작업이다.
- 백엔드 구현은 존재한다.

### 여행 멤버/초대

- `TripStartScreen.tsx` 내부 상수 사용
- 목업 데이터:
  - `SEARCH_CANDIDATES`
  - `INITIAL_INVITE_MEMBERS`
  - `DUMMY_INVITE_LINK`

### 사진

- `TripPhotoAlbumScreen.tsx`가 `tripMockStore.ts` 사용
- 실제 사진 API 모듈 없음
- 백엔드 구현은 존재

### 타임라인/이벤트

- `TripRecordingScreen.tsx`, `TripReportScreen.tsx`, `TripPhotoAlbumScreen.tsx`가 `tripMockStore.ts` 의존
- 실제 타임라인 API 모듈 없음
- 백엔드 구현은 존재

### 비용/결제

- `expenseStore.ts`, `cardStore.ts` 중심
- 관련 화면:
  - `PaymentScreen.tsx`
  - `payment-details.tsx`
  - `ExpenseGraph.tsx`
  - `ExpenseTable.tsx`
- 실제 비용 API 모듈 없음
- 비용 백엔드 구현은 존재
- 정산/결제내역 후보 백엔드는 아직 없음

### 리포트

- `TripReportScreen.tsx`가 `tripMockStore.ts` 기반
- 실제 리포트 API 모듈 없음
- 백엔드도 아직 없음

## 3. 백엔드 구현 완료, 프론트 미연동 API

### 사용자

- `GET /api/v1/users/check-nickname`
- `GET /api/v1/users/check-email`

### 친구

- `GET /api/v1/friends/search`
- `POST /api/v1/friends/requests`
- `GET /api/v1/friends/requests/received`
- `GET /api/v1/friends/requests/sent`
- `POST /api/v1/friends/requests/{friendshipId}/accept`
- `POST /api/v1/friends/requests/{friendshipId}/decline`
- `GET /api/v1/friends`

### 여행 멤버/초대

- `GET /api/v1/trips/{tripId}/members`
- `POST /api/v1/trips/{tripId}/invites/users`
- `POST /api/v1/trips/{tripId}/invites/link`
- `GET /api/v1/trip-invites/{inviteToken}`
- `POST /api/v1/trip-invites/{inviteToken}/accept`
- `POST /api/v1/trip-invites/{inviteToken}/decline`
- `POST /api/v1/trips/{tripId}/leave`

### 사진

- `GET /api/v1/trips/{tripId}/photos`
- `GET /api/v1/photos/{photoId}`
- `PATCH /api/v1/photos/{photoId}`
- `PUT /api/v1/photos/{photoId}/memo`
- `GET /api/v1/photos/{photoId}/memo`
- `DELETE /api/v1/photos/{photoId}/memo`
- `POST /api/v1/trips/{tripId}/photos/sync`

### 타임라인/이벤트

- `POST /api/v1/trips/{tripId}/timeline-build-jobs`
- `GET /api/v1/trips/{tripId}/timeline-days`
- `GET /api/v1/timeline-days/{timelineDayId}`
- `GET /api/v1/events/{eventId}`
- `PATCH /api/v1/events/{eventId}`
- `PUT /api/v1/events/{eventId}/photos`
- `PUT /api/v1/events/{eventId}/memo`

### 비용

- `GET /api/v1/trips/{tripId}/expenses`
- `GET /api/v1/expenses/{expenseId}`
- `POST /api/v1/trips/{tripId}/expenses`
- `PATCH /api/v1/expenses/{expenseId}`
- `DELETE /api/v1/expenses/{expenseId}`

## 4. 명세에는 있으나 백엔드 구현이 확인되지 않은 API

### 사용자 권한

- `GET /api/v1/users/me/permissions`
- `PUT /api/v1/users/me/permissions/{permissionType}`

### 위치 로그 조회

- `GET /api/v1/trips/{tripId}/location-logs`
- `GET /api/v1/trips/{tripId}/days/{dayDate}/route`

### 리포트

- `POST /api/v1/trips/{tripId}/reports`
- `GET /api/v1/trips/{tripId}/reports`
- `GET /api/v1/trip-reports/{tripReportId}`
- `PATCH /api/v1/trip-reports/{tripReportId}`
- `POST /api/v1/trip-reports/{tripReportId}/publish`

### 공유 앨범

- `GET /api/v1/trips/{tripId}/shared-album`
- `POST /api/v1/trips/{tripId}/shared-album`
- `PATCH /api/v1/shared-albums/{sharedAlbumId}`
- `GET /api/v1/shared-albums/{sharedAlbumId}/members`
- `PUT /api/v1/shared-albums/{sharedAlbumId}/members`
- `PUT /api/v1/shared-albums/{sharedAlbumId}/events`
- `GET /api/v1/public/shared-albums/{sharedAlbumId}`

### 결제내역 후보

- `GET /api/v1/trips/{tripId}/payment-imports`
- `GET /api/v1/users/me/payment-imports`
- `POST /api/v1/payment-imports/{paymentImportId}/select`
- `POST /api/v1/payment-imports/{paymentImportId}/ignore`

### 정산

- `POST /api/v1/trips/{tripId}/settlements`
- `GET /api/v1/trips/{tripId}/settlements`
- `GET /api/v1/settlements/{settlementId}`
- `POST /api/v1/settlements/{settlementId}/finalize`
- `POST /api/v1/settlement-transfers/{settlementTransferId}/settle`

### 공통 비동기 작업

- `GET /api/v1/sync-jobs/{syncJobId}`

### 알림

- 명세만 있고 코드 기준 구현 확인 불가

## 5. 실제 연동 전에 수정이 필요한 스펙 불일치

### 5-1. 공통 base URL 중복 가능성

- 파일: `Frontend/yeoun-client/src/api/client.ts`
- 현재 기본 `baseURL`: `.../api/v1`
- 문제:
  - `Frontend/yeoun-client/src/api/user.ts`는 다시 `/api/v1/users/...` 경로 사용
  - 결과적으로 `/api/v1/api/v1/...` 호출 가능성 존재

### 5-2. 위치 로그 업로드 경로 불일치

- 프론트: `POST /trips/{tripId}/locations`
- 백엔드: `POST /api/v1/trips/{tripId}/location-logs:batch`
- 영향:
  - 현재 호출은 백엔드에 도달하지 않을 가능성이 큼

### 5-3. 위치 로그 payload 불일치

- 프론트 payload: `{ locations: [...] }`
- 백엔드 payload: `{ logs: [...] }`
- 백엔드 필수 필드:
  - `clientLogUuid`
  - `recordedAt`
  - `latitude`
  - `longitude`
  - `accuracyM`
  - `source`
- 프론트 현재 타입에는 위 필드 일부가 없음

### 5-4. 여행 생성 request 불일치

- 백엔드 `TripCreateRequest` 필드:
  - `title`
  - `startDate`
  - `endDate`
  - `visibility`
- 프론트 `createTripApi` 필드:
  - `title`
  - `startDate`
  - `endDate`
  - `region`
  - `country`
  - `participants`
- 영향:
  - `visibility` 누락
  - 백엔드에 없는 필드 전송

### 5-5. 여행 상세 response 기대값 불일치

- 백엔드 `TripDetailResponse`:
  - `tripId`
  - `title`
  - `startDate`
  - `endDate`
  - `startedAt`
  - `actualEndedAt`
  - `status`
  - `visibility`
  - `ownerUserId`
  - `reportStatus`
  - `memberCount`
  - `createdAt`
- 프론트 `TripDetail` 기대값:
  - `region`
  - `country`
  - `participants`
  - `imageUrl`
- 영향:
  - 실서버 응답을 그대로 쓰기 어려움

### 5-6. 사진 동기화 명세와 실제 백엔드 구현 차이

- 명세 문서: sync trigger 형태로 읽힘
- 실제 백엔드: multipart form-data 업로드
- 영향:
  - 프론트 설계 전 request 형식 확정 필요

## 6. 권장 문서 사용법

- 연동 시작 전:
  - 이 문서의 `3`, `4`, `5` 섹션 확인
- 작업 순서 결정:
  - `Docs/frontend-api-integration-priority.md` 참고
- 구현 원칙:
  - 기존 목업 제거 금지
  - API 실패 시 fallback 유지
  - 백엔드 미구현 구간은 mock adapter 유지
