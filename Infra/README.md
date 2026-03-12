# Infra Guide

이 문서는 팀원이 인프라 구조를 빠르게 이해하고, 로컬 Docker 실행과 서버 배포 흐름을 따라갈 수 있도록 정리한 상위 가이드입니다.

## 1. 인프라 구성 개요

현재 인프라는 아래와 같이 역할을 나눠서 사용합니다.

- `EC2-1`
  - 역할: service node + Jenkins server
  - 주요 구성: `postgres`, `redis`, `api`, `nginx`, `jenkins`
- `EC2-2`
  - 역할: worker node
  - 주요 구성: `kafka`, `worker`, `nginx`
- `로컬`
  - 역할: 개발 및 Docker 기반 로컬 테스트
  - 목적: 인프라 조합 확인, 컨테이너 실행 검증

즉, 로컬은 개발용이고, 실제 배포 대상은 `EC2-1`, `EC2-2`입니다.

## 2. 폴더 구조

```text
Infra/
  README.md                 # 현재 문서
  .gitignore                # Infra 전용 ignore 규칙
  docker/
    README.md               # Docker/Compose 구조 설명
    node1/
      docker-compose.yml    # node1 공통 compose
      compose.local.yml     # node1 로컬 override
      compose.ec2.yml       # node1 EC2 override
      .env.example
      .env                  # 실제 서버/로컬 값, Git 제외
      init-db/
      nginx/
    node2/
      docker-compose.yml    # node2 공통 compose
      compose.local.yml     # node2 로컬 override
      compose.ec2.yml       # node2 EC2 override
      .env.example
      .env                  # 실제 서버/로컬 값, Git 제외
      nginx/
  scripts/
    README.md               # 배포 스크립트 설명
    common.sh               # 공통 함수
    check-env.sh            # 배포 전 점검
    deploy-node1.sh         # EC2-1 배포
    deploy-node2.sh         # EC2-2 배포
    rollback-node1.sh       # EC2-1 롤백
    rollback-node2.sh       # EC2-2 롤백
```

## 3. 로컬 Docker 실행 가이드

로컬에서는 `node1`, `node2`를 각각 띄워서 인프라 조합을 검증합니다.

### 3-1. 환경 파일 준비

예시 파일을 복사해서 실제 `.env`를 만듭니다.

- `Infra/docker/node1/.env.example` -> `Infra/docker/node1/.env`
- `Infra/docker/node2/.env.example` -> `Infra/docker/node2/.env`

`.env`는 Git에 올리지 않습니다.

### 3-2. node1 실행

```powershell
cd Infra/docker/node1
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

기본 구성:
- postgres
- redis
- api
- nginx

### 3-3. node2 실행

```powershell
cd Infra/docker/node2
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

기본 구성:
- kafka
- worker
- nginx

### 3-4. 로컬 확인 포인트

- node1 nginx: 기본 `80`
- node2 nginx: 기본 `8081`
- postgres: `5432`
- redis: `6379`
- kafka: `9092`
- worker: `8000`

세부 변수는 각 `.env.example` 참고

## 4. 서버 실행 방식

### EC2-1

실행 대상:
- Jenkins
- node1 compose (`postgres`, `redis`, `api`, `nginx`)

EC2-1 배포 명령:

```bash
cd /opt/yeoun/Infra/docker/node1
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

### EC2-2

실행 대상:
- node2 compose (`kafka`, `worker`, `nginx`)

EC2-2 배포 명령:

```bash
cd /opt/yeoun/Infra/docker/node2
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

## 5. 팀원용 서버 접속 정보

아래 값은 실제 값으로 채워서 공유해야 합니다.

### EC2-1

- 역할: service node + Jenkins
- SSH 사용자: `<예: ubuntu>`
- SSH 주소: `<EC2-1 public ip or domain>`
- Jenkins 주소: `<예: http://EC2-1-IP:8080>`
- 프로젝트 경로: `/opt/yeoun`

### EC2-2

- 역할: worker node
- SSH 사용자: `<예: ubuntu>`
- SSH 주소: `<EC2-2 public ip or domain>`
- 프로젝트 경로: `/opt/yeoun`

주의:
- 실제 IP/도메인/키 경로는 저장소에 커밋하지 말고 팀 내부 문서나 비공개 채널에서 공유
- `.env` 실값도 Git에 올리지 않음

## 6. Jenkins 배포 흐름

현재 기준 배포 정책은 아래와 같습니다.

- `develop` 브랜치 push만 자동 배포
- `main`은 자동 운영 배포하지 않음
- Backend/Worker는 변경된 쪽만 배포
- 빌드 실패 시 배포 중단
- 배포 후 health check 실패 시 rollback

배포 흐름:

1. 개발자가 `develop`에 push
2. GitLab webhook이 Jenkins pipeline 트리거
3. Jenkins가 변경 파일을 확인
4. Backend 변경 시 API 이미지 빌드/push 후 node1 배포
5. Worker 변경 시 Worker 이미지 빌드/push 후 node2 배포
6. 각 배포 후 health check 수행
7. 실패 시 이전 이미지 태그로 rollback

## 7. 팀원이 꼭 알아야 하는 파일

- `Jenkinsfile`
  - CI/CD 파이프라인 정의
- `Infra/docker/README.md`
  - Docker/Compose 구조 설명
- `Infra/scripts/README.md`
  - 배포/롤백 스크립트 설명
- `Infra/docker/node1/.env.example`
- `Infra/docker/node2/.env.example`
  - 환경 변수 기준

## 8. 자주 하는 작업

### 로컬에서 인프라만 띄우기

```powershell
cd Infra/docker/node1
docker compose -f docker-compose.yml -f compose.local.yml up -d

cd ../node2
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

### 서버 배포 전 점검

```bash
bash Infra/scripts/check-env.sh node1
bash Infra/scripts/check-env.sh node2
```

### 수동 배포

```bash
bash Infra/scripts/deploy-node1.sh
bash Infra/scripts/deploy-node2.sh
```

### 수동 롤백

```bash
bash Infra/scripts/rollback-node1.sh <previous-tag>
bash Infra/scripts/rollback-node2.sh <previous-tag>
```

## 9. 주의 사항

- `node1`, `node2`는 서버 역할 구분입니다.
- `local`, `ec2`는 실행 환경 구분입니다.
- 상태 저장 서비스(`postgres`, `redis`, `kafka`)는 앱 컨테이너처럼 쉽게 내렸다 올리지 않습니다.
- `.env`는 예시만 공유하고 실값은 서버에서 직접 관리합니다.
- Jenkins UI 설정, GitLab webhook, credential 등록은 저장소 밖에서 별도 진행합니다.

## 10. 참고 문서

- `Infra/docker/README.md`
- `Infra/scripts/README.md`
