# SSAFY 14기 특화 프로젝트

## 프로젝트 개요


과정: SSAFY 14기

지역 / 반 / 팀: 대전 1반 B105팀

프로젝트 유형: 특화 프로젝트

본 프로젝트는 SSAFY 14기 대전 1반 B105팀이 협업하여 진행하는 공통 프로젝트입니다.
일관된 Git 컨벤션과 협업 도구를 기반으로 원활한 팀 개발을 목표로 합니다.


## 팀 소개
SSAFY 14기 대전 1반 B105팀은 역할 분담을 통해 프로젝트를 효율적으로 운영하며,
팀장은 프로젝트 전반의 일정 관리와 의사결정을 담당합니다.


김승수 (팀장)
김건남
김태영
류지우
유동훈
정회묵


## 포트 규칙 및 볼륨 마운트 정책

충돌을 방지하기 위해 로컬 환경의 포트와 볼륨을 아래와 같이 통제합니다.

| **서비스 명** | **컨테이너 내부 포트** | **로컬(Host) 포트** | **볼륨 마운트 경로 (Host ↔ Container)** | **비고** |
| --- | --- | --- | --- | --- |
| **PostgreSQL (PostGIS)** | 5432 | `5432` | `./volumes/postgres_data:/var/lib/postgresql/data` | H3 헥사곤 공간 연산용 DB |
| **Redis** | 6379 | `6379` | `./volumes/redis_data:/data` | 세션 및 캐싱 |
| **Kafka (KRaft)** | 9092, 9093 | `9092`, `9093` | `./volumes/kafka_data:/bitnami/kafka` | 오프라인 큐잉 데이터 스트리밍 브로커 |
| **Spring Boot API** | 8080 | `8080` | (IDE에서 직접 실행 권장) | 메인 비즈니스 서버 |
| **Python Worker** | 8000 | `8000` | (IDE에서 직접 실행 권장) | AI/데이터 가공 워커 |




---

# 🚀 여운 (YEO-UN) : 남겨진 시간과 공간을 잇는 여행 기록 플랫폼

> **"다녀만 오세요, 기록은 여운이 남깁니다."**

## 🏗️ 1. 시스템 아키텍처 개요 (Polyrepo 구조)

본 프로젝트는 제한된 EC2 환경(2대)에서 병목을 막고 확장성을 확보하기 위해 **4개의 독립된 레포지토리**로 구성됩니다.

* **📱 Frontend (`yeoun-client`)**: 오프라인 큐잉과 백그라운드 수집을 담당하는 모바일 앱 (React Native)
* **⚙️ Core API (`yeoun-api`)**: 즉각적인 응답이 필요한 핵심 비즈니스 로직 처리 서버 (Spring Boot)
* **🧠 AI Worker (`yeoun-worker`)**: 메인 서버를 보호하기 위해 무거운 데이터 가공 및 AI 연산을 병렬로 전담하는 공장 (Python)
* **🏗️ Infra (`yeoun-infra`)**: 전체 서버 환경 및 CI/CD 파이프라인 중앙 관리소 (Docker, Jenkins)

---

## 📂 2. 레포지토리별 상세 디렉토리 구조

### 📱 1. `yeoun-client` (Frontend / React Native)

프론트엔드 팀의 Expo 기반 UI 화면과, '수기 입력 0%'를 달성하기 위한 백그라운드 데이터 수집 엔진이 결합된 저장소입니다.

```text
yeoun-client/
├── app/                   # Expo Router 화면 라우팅 (UI 뷰어)
├── components/            # 재사용 가능한 UI 컴포넌트
├── store/                 # 전역 상태 관리 (Zustand: 유저 세션, 활성 여행 상태)
├── services/              
│   ├── api/               # Spring Boot 서버 통신 (Axios)
│   └── tracker/           # [핵심] 백그라운드 GPS 및 결제 푸시 알림 파싱 로직
├── database/              # [핵심] 오프라인 큐잉용 로컬 DB (SQLite) - 네트워크 단절 대비
└── utils/                 # 권한 요청(FR-005) 및 헬퍼 함수

```

### ⚙️ 2. `yeoun-api` (Backend / Node 1)

유저 인증, 타임라인 병합, 정산 등 메인 비즈니스 로직을 담당하며, 무거운 작업은 Kafka를 통해 워커로 넘깁니다.

```text
yeoun-api/
├── src/main/java/com/yeoun/api/
│   ├── global/            # 공통 설정 (보안, PostGIS, Redis, 전역 예외 처리 등)
│   ├── domain/            # 도메인별 비즈니스 로직
│   │   ├── travel/        # 여행 생성, 활성화, 종료 (FR-001 ~ FR-003)
│   │   ├── timeline/      # 타임라인 조회 및 편집
│   │   └── settlement/    # 정산 및 결제 내역 딥링크 연결
│   └── infra/             
│       └── kafka/         # Kafka Producer (사진/로그 데이터를 워커로 비동기 전송)
└── Jenkinsfile            # API 전용 CI/CD 배포 파이프라인

```

### 🧠 3. `yeoun-worker` (AI & Data Pipeline / Node 2)

프론트에서 쏟아지는 이벤트 데이터를 스트리밍으로 받아 사진 매칭, OCR, STT 등을 처리하는 데이터 가공 전담 워커입니다.

```text
yeoun-worker/
├── app/
│   ├── main.py            # FastAPI 엔트리포인트 (헬스체크용)
│   ├── consumer/          # Kafka Consumer 로직 (메시지 수신 대기)
│   └── services/          # 핵심 데이터 처리 파이프라인
│       ├── image_task.py  # 갤러리 이미지 리사이징 및 EXIF 추출
│       ├── auto_match.py  # 사진 + GPS 교차 검증 및 장소 카드 매칭 알고리즘
│       └── ai_stt.py      # 현장음 텍스트 변환 및 감성 분석
├── data/                  
│   ├── temp/              # 가공 중인 임시 파일 (Git 추적 제외)
│   └── models/            # AI 모델 가중치 파일 보관
└── Jenkinsfile            # 워커 전용 CI/CD 배포 파이프라인

```

### 🏗️ 4. `yeoun-infra` (Infrastructure)

서비스 구동에 필요한 데이터베이스, 캐시, 메시지 큐 등 인프라 설정과 배포 스크립트를 관리합니다.

```text
yeoun-infra/
├── docker/
│   ├── node1/             # 메인 서비스계 (EC2-1)
│   │   ├── docker-compose.yml # PostgreSQL(PostGIS), Redis, Nginx
│   │   └── init-db/       # PostGIS 확장 등 초기 DB 세팅 스크립트
│   └── node2/             # 데이터 파이프라인계 (EC2-2)
│       └── docker-compose.yml # Kafka (Zookeeper 없는 KRaft 모드)
├── scripts/               # Jenkins 연동용 배포 쉘 스크립트
└── README.md              # 팀원 로컬 개발 환경(Docker) 셋업 가이드

```

---

## 🛠️ 3. 기술 스택 요약 (Tech Stack)

| 구분 | 기술 스택 | 비고 |
| --- | --- | --- |
| **Frontend** | React Native (Expo), Zustand, SQLite | 오프라인 큐잉 및 백그라운드 제어 |
| **Backend (API)** | Java 17, Spring Boot, Spring Data JPA | 빠르고 안정적인 코어 비즈니스 |
| **Data / AI Worker** | Python, FastAPI, OpenCV, Tesseract/Whisper | 이미지 처리, OCR, STT 등 비정형 데이터 가공 |
| **Database** | PostgreSQL + **PostGIS** | H3 헥사곤 공간 연산 및 트래블 포그 시각화 기반 |
| **Cache & Queue** | Redis, Apache Kafka (KRaft Mode) | 토큰/세션 관리 및 대용량 데이터 스트리밍 브로커 |
| **DevOps** | Docker Compose, Jenkins, AWS EC2 | 무중단 자동화 배포 파이프라인 |

---

**💡 로컬 환경 세팅을 시작하려면?**
개발을 시작하는 팀원은 가장 먼저 `yeoun-infra/README.md`를 참고하여 `docker-compose up -d` 명령어로 로컬 DB와 Kafka 환경을 구축해 주세요.

---