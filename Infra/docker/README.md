# Docker Infra Guide

이 폴더는 `node1`(service node)과 `node2`(worker node)용 Docker Compose 설정을 관리합니다.

## 구조 요약

- `node1`
  - 역할: 서비스 계층
  - 구성: `postgres`, `redis`, `api`, `nginx`
- `node2`
  - 역할: 비동기/워커 계층
  - 구성: `kafka`, `worker`, `nginx`

각 노드는 공통 정의 파일 1개와 환경별 override 파일 2개로 나뉩니다.

- 공통 파일: `docker-compose.yml`
- 로컬용: `compose.local.yml`
- EC2용: `compose.ec2.yml`

즉, 공통 파일은 "무슨 서비스를 띄우는지"를 정의하고, 환경별 파일은 "로컬/EC2에서 어떻게 노출하고 실행하는지"를 정의합니다.

## 디렉토리 구조

```text
Infra/docker/
  node1/
    docker-compose.yml
    compose.local.yml
    compose.ec2.yml
    .env
    .env.example
    init-db/
    nginx/
      default.local.conf
      default.ec2.conf
  node2/
    docker-compose.yml
    compose.local.yml
    compose.ec2.yml
    .env
    .env.example
    nginx/
      default.conf
      default.local.conf
      default.ec2.conf
```

## 파일 역할

### node1

- `docker-compose.yml`
  - node1 공통 베이스
  - `postgres`, `redis`, `api`, `nginx` 정의
- `compose.local.yml`
  - 로컬 포트 공개
  - 로컬 nginx 설정 연결
- `compose.ec2.yml`
  - EC2-1 포트 공개
  - 운영 nginx 설정 연결
- `nginx/default.local.conf`
  - 로컬에서 `nginx -> api` 프록시
- `nginx/default.ec2.conf`
  - EC2-1에서 외부 요청을 `api`로 프록시

### node2

- `docker-compose.yml`
  - node2 공통 베이스
  - `kafka`, `worker`, `nginx` 정의
- `compose.local.yml`
  - 로컬 포트 공개
  - 로컬 Kafka advertised host 설정 사용
  - 로컬 nginx 설정 연결
- `compose.ec2.yml`
  - EC2-2 포트 공개
  - 운영 worker 이미지 태그 사용
  - 운영 nginx 설정 연결
- `nginx/default.local.conf`
  - 로컬에서 이미지 경로 제공 및 `nginx -> worker` 프록시
- `nginx/default.ec2.conf`
  - EC2-2에서 이미지 경로 제공 및 `nginx -> worker` 프록시

## 환경 파일

실제 값은 `.env`에 두고, 예시는 `.env.example`를 기준으로 맞춥니다.
`.env`는 Git에 올리지 않습니다. `Infra/.gitignore`에서 제외합니다.

### node1 주요 변수

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `REDIS_PASSWORD`
- `API_IMAGE`
- `API_CONTAINER_PORT`
- `API_HOST_PORT`
- `NGINX_HTTP_PORT`
- `NGINX_HTTPS_PORT`
- `NGINX_SERVER_NAME`

### node2 주요 변수

- `KAFKA_CLUSTER_ID`
- `KAFKA_ADVERTISED_HOST`
- `KAFKA_EXTERNAL_PORT`
- `WORKER_IMAGE`
- `WORKER_CONTAINER_PORT`
- `WORKER_HOST_PORT`
- `NGINX_HTTP_PORT`
- `NGINX_HTTPS_PORT`
- `NGINX_SERVER_NAME`

## 로컬 실행 방법

### 1. 환경 파일 준비

예시 파일을 복사해서 실제 `.env` 파일을 만듭니다.

- `node1/.env.example` -> `node1/.env`
- `node2/.env.example` -> `node2/.env`

### 2. node1 실행

```powershell
cd Infra/docker/node1
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

### 3. node2 실행

```powershell
cd Infra/docker/node2
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

## EC2 실행 방법

### EC2-1

```powershell
cd Infra/docker/node1
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

### EC2-2

```powershell
cd Infra/docker/node2
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

## Jenkins 연계 방식

권장 방식은 다음과 같습니다.

- Jenkins가 API/Worker 이미지를 빌드
- Docker Hub에 태그 push
- EC2에서 해당 태그를 `.env` 또는 배포 스크립트로 주입
- `docker compose -f docker-compose.yml -f compose.ec2.yml pull`
- `docker compose -f docker-compose.yml -f compose.ec2.yml up -d`

즉, Compose는 인프라 선언을 담당하고, Jenkins는 이미지 버전 갱신과 배포 실행을 담당합니다.

## 주의 사항

- `node1`과 `node2`는 역할 구분입니다. 환경 구분이 아닙니다.
- `local`과 `ec2`는 실행 환경 구분입니다.
- `dev/prod` 개념과 `node1/node2` 개념을 섞지 않습니다.
- `postgres`, `redis`, `kafka`는 상태 저장 계층이므로 볼륨 관리와 비밀값 관리가 중요합니다.
- 로컬 기본 포트는 node1 nginx `80`, node2 nginx `8081` 기준으로 잡혀 있습니다.

## 정리

- `docker-compose.yml`: 공통 정의
- `compose.local.yml`: 로컬 차이만
- `compose.ec2.yml`: EC2 차이만
- `.env.example`: 변수 형식 안내
- `.env`: 실제 값

이 구조를 유지하면 로컬과 EC2 설정이 분리되면서도, 공통 서비스 정의는 한 곳에서 관리할 수 있습니다.
