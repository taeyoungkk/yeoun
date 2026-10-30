# 🌿 여운 (YEO-UN)

> **다녀만 오세요, 기록은 여운이 남깁니다.**

여운은 여행 중 수집한 **위치·사진·지출을 타임라인과 지도에 모으는 여행 기록 플랫폼**입니다. 이동 경로와 사진을 연결하고, 영수증에서 추출한 비용을 동행자와 정산하며, 여행 기록을 공유 앨범으로 남길 수 있습니다.

| 항목 | 내용 |
| --- | --- |
| 개발 기간 | 2026.02.19 ~ 2026.03.30 |
| 개발 인원 | 6명 |
| 플랫폼 | React Native 모바일 앱 |
| 기관 | 삼성 청년 SW·AI 아카데미 14기 |

## 📋 목차

- [🧩 주요 기능](#-주요-기능)
- [🧰 기술 스택](#-기술-스택)
- [🧱 시스템 아키텍처](#-시스템-아키텍처)
- [🔧 핵심 구현](#-핵심-구현)
- [🤝 팀 구성 및 역할](#-팀-구성-및-역할)
- [🚀 시작하기](#-시작하기)
- [📚 관련 문서](#-관련-문서)

## 🧩 주요 기능

| 기능 | 설명 |
| --- | --- |
| 여행 관리 및 동행자 초대 | 여행을 생성·시작·종료하고 친구를 초대해 함께 기록합니다. |
| 위치 기록 및 지도 | 백그라운드 위치를 수집하고 날짜별 이동 경로와 방문 지역을 지도에서 확인합니다. |
| 사진 동기화 및 타임라인 | 여행 기간의 사진을 동기화하고 위치·시간 정보를 바탕으로 방문 장소와 연결합니다. 이벤트·사진·메모를 조회하고 수정할 수 있습니다. |
| 영수증 OCR | 영수증 이미지에서 가맹점·금액·품목을 추출하고, 확인한 결과를 지출로 등록합니다. |
| 지출 관리 및 정산 | 지출별·영수증 품목별 참여자를 지정하고 멤버별 부담액과 송금 관계를 확인합니다. |
| 공유 앨범 및 여행 리포트 | 사진·타임라인·정산 정보를 모아 여행을 돌아보고, 공유 앨범의 멤버와 공개 범위를 관리합니다. |

## 🧰 기술 스택

| 분야 | 주요 기술 |
| --- | --- |
| Frontend | TypeScript, React Native, Expo, Expo Router, NativeWind |
| 상태 / 로컬 저장 | Zustand, TanStack Query, AsyncStorage |
| Backend | Java 21, Spring Boot, Spring Security, Spring Data JPA, Flyway |
| Worker / AI | Python, FastAPI, aiokafka, Pillow, Gemini 기반 OCR (GMS 연동) |
| 데이터 / 메시징 | PostgreSQL·PostGIS, Redis, Apache Kafka |
| 지도 / 스토리지 | Mapbox, AWS S3 |
| 인프라 | AWS EC2, Docker Compose, Nginx, Jenkins |

세부 의존성은 [Frontend package.json](./Frontend/yeoun-client/package.json), [Backend pom.xml](./Backend/pom.xml), [Worker requirements.txt](./Worker/requirements.txt)에 정의되어 있습니다.

## 🧱 시스템 아키텍처

하나의 저장소에서 모바일 앱, API 서버, Worker, 인프라를 관리합니다. 운영 환경은 서비스 서버와 Worker 서버로 나누고, Kafka를 통해 위치·사진·영수증 처리 작업을 전달합니다.

```text
[모바일 앱]
React Native / Expo
  ├─ 위치 수집 → AsyncStorage 임시 저장 → 위치 로그 업로드
  ├─ 사진 동기화 / 영수증 업로드
  └─ 여행·타임라인·앨범·정산 조회
                    ↓
[서비스 서버 · EC2-1]
Nginx → Spring Boot API ↔ PostgreSQL·PostGIS / Redis
                    ├─ 사진·영수증 저장 → S3
                    └─ 작업 발행 → Kafka
                                      ↓
[데이터 처리 서버 · EC2-2]
FastAPI / Kafka Consumer
  ├─ GPS 전처리 → 체류 장소·이동 경로 생성
  ├─ 사진 EXIF·썸네일 처리 → GPS·장소 매칭
  └─ Gemini 영수증 OCR → 금액·품목 추출
                    ↓
DB 결과·상태 반영 / Kafka 결과 이벤트
                    ↓
Spring Boot API → 앱에서 처리 상태 및 결과 조회
```

```text
S14P21B105/
├── Frontend/yeoun-client/  # 모바일 앱, 화면 및 API 연동
├── Backend/               # 여행·인증·타임라인·정산 API
├── Worker/                # GPS·사진 후처리, 영수증 OCR
├── Infra/                 # Docker Compose, Nginx, 배포·롤백 스크립트
├── Docs/                  # 프로젝트 문서
└── Jenkinsfile            # CI/CD 파이프라인
```

## 🔧 핵심 구현

### 📍 위치 수집과 비동기 경로 처리

앱은 위치 권한과 사용자 설정에 따라 백그라운드 GPS를 수집하고 AsyncStorage에 임시 저장합니다. 업로드 요청이 실패 응답을 반환하면 로그를 다시 큐에 넣도록 처리합니다.

백엔드는 위치 로그를 Kafka로 전달하고, Worker는 정확도·이동 속도를 기준으로 GPS를 정제한 뒤 체류 구간·방문 장소·날짜별 경로를 생성합니다. 앱은 동기화 상태를 폴링해 처리 결과를 조회합니다.

### 📷 사진과 장소·타임라인 연결

Worker가 사진의 EXIF 시각·좌표를 추출하고 썸네일을 생성합니다. 촬영 시각과 GPS·장소 정보를 비교해 사진을 연결하고, 대표 사진과 타임라인 후보를 저장합니다.

매칭되지 않거나 신뢰도가 낮은 사진은 수동 보정 후보로 남기며, 여행 단위로 기존 사진의 연결 관계를 다시 계산하는 재처리 흐름을 제공합니다.

### 🧾 영수증 인식과 품목별 정산

영수증 이미지를 GMS를 통한 Gemini API로 분석해 가맹점·결제 시각·금액·품목을 구조화합니다. 처리 상태와 결과를 조회한 뒤 사용자가 선택한 결과를 지출로 확정합니다.

품목별 참여자를 정산에 반영하고, 확정 지출을 기준으로 멤버별 부담액과 송금 관계를 계산합니다. 영수증과 결제 기록을 연결할 때 중복 반영을 검사합니다.

### 🔄 처리 상태·재시도 및 공유 접근 제어

GPS·사진·OCR 처리를 별도 Kafka Consumer로 분리하고, 실패 작업을 재시도 토픽 또는 DLQ로 전달합니다. 처리 상태를 저장해 앱에서 진행 상황과 결과를 확인할 수 있도록 구성했습니다.

공유 앨범은 멤버와 공개 범위를 관리하고, 공개 조회 API와 멤버 대상 조회 API에서 접근 조건을 확인합니다.

## 🤝 팀 구성 및 역할

저장소의 구현 및 작성자별 커밋 기록을 기준으로 주요 기여를 요약했습니다.

| 이름 | 담당 | 주요 기여 |
| --- | --- | --- |
| 김승수 (팀장) | Worker / AI | GPS 전처리·경로 생성, 사진·장소 매칭, 영수증 OCR 파이프라인 |
| 김건남 | Backend | 위치 로그 수집·조회, 타임라인·이벤트 API, 공유 앨범·친구 관리 |
| 김태영 | Backend | 인증·여행 관리, 사진·영수증 API, 지출·품목별 정산 |
| 류지우 | Frontend | 여행 기록·앨범 화면, 결제·정산 API 연동, 공통 UI 정리 |
| 유동훈 | Infrastructure | EC2·컨테이너 구성, Jenkins CI/CD, Nginx·HTTPS 설정 |
| 정회묵 | Frontend | 지도·방문 지역 시각화, 인증·프로필 연동, 홈·마이페이지 구현 |

## 🚀 시작하기

### 개발 환경

- Java 21, Node.js 및 npm, Python 3.11 (Worker 컨테이너 기준)
- Docker 및 Docker Compose
- 모바일 실행을 위한 Android 개발 환경 또는 iOS 개발 환경
- 사용하는 기능에 맞는 Mapbox·S3·GMS 및 인증·메일 설정

아래 명령은 각각 **저장소 루트에서 시작하는 별도 터미널** 기준입니다. 예시 환경 파일을 복사한 뒤 해당 환경에 맞게 값을 설정합니다.

### Backend

[Backend 실행 가이드](./Backend/README.md)에 따라 `Backend/.env.example`을 `.env`로, `application-local.properties.example`을 `application-local.properties`로 복사합니다. DB·JWT·메일·S3·초대 URL·카드 연동 암호화 키 등 로컬 설정에서 참조하는 값을 준비합니다.

```bash
cd Backend
docker compose -f docker-compose.dev.yml up -d
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

이 Compose 구성은 PostgreSQL·PostGIS, Redis, Kafka를 실행합니다. Windows PowerShell에서는 마지막 명령을 다음과 같이 실행합니다.

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

### Worker

`Worker/.env.example`을 `.env`로 복사합니다. 호스트에서 직접 실행할 때는 `KAFKA_BOOTSTRAP_SERVERS=localhost:9092`와 접근 가능한 `WORKER_DATABASE_URL`을 지정합니다. OCR·사진·GPS를 함께 처리하려면 아래 세 플래그를 모두 활성화합니다.

```dotenv
KAFKA_ENABLED=true
KAFKA_PHOTO_ENABLED=true
KAFKA_LOCATION_ENABLED=true
```

OCR에는 `GMS_API_KEY`, 사진 처리에는 S3 설정 등이 필요합니다. 상세 설정은 [Worker 문서](./Worker/README.md)를 참고합니다.

```bash
cd Worker
python -m venv .venv
# 가상환경 활성화 후 실행
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

`Frontend/yeoun-client/.env.example`을 `.env`로 복사해 `EXPO_PUBLIC_API_URL`과 `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`을 설정합니다. API 주소에는 `/api/v1` 경로를 포함하고, 실기기에서는 개발 PC에 접근할 수 있는 주소를 사용합니다.

```bash
cd Frontend/yeoun-client
npm install
npm run android
```

Mapbox와 Google 로그인 등 네이티브 모듈을 사용하므로 개발 빌드를 기준으로 실행합니다. iOS는 macOS의 개발 환경에서 `npm run ios`를 사용합니다. 위치·사진 기록은 기기 권한과 앱 내 수집 설정을 확인해야 합니다.

## 📚 관련 문서

| 문서 | 내용 |
| --- | --- |
| [Frontend 개발 가이드](./Frontend/yeoun-client/frontend_guide.md) | 기능별 폴더 구조, 상태 관리, 컴포넌트·코딩 규칙 |
| [Backend](./Backend/README.md) | 환경 설정, 로컬 인프라, Spring Boot 실행 |
| [Worker](./Worker/README.md) | GPS·사진·OCR 처리 흐름, 상태 관리, 환경 변수 |
| [Infra](./Infra/README.md) | 서버 구성, 로컬·운영 실행, Jenkins 배포 |
| [Docker 구성](./Infra/docker/README.md) | 노드별 Compose 및 환경 설정 |
| [배포 스크립트](./Infra/scripts/README.md) | 배포 점검·실행·롤백 절차 |
