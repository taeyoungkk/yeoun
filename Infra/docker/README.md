# Docker Infra Guide

이 폴더는 `node1`(service node)과 `node2`(worker node)용 Docker Compose 설정 및 Jenkins 기반 배포 흐름을 관리합니다.

## 1. 구성 개요

- `node1`
  - 역할: 서비스 계층
  - 구성: `postgres`, `redis`, `api`, `nginx`
  - 배포 대상: `EC2-1`
- `node2`
  - 역할: 비동기/워커 계층
  - 구성: `kafka`, `worker`, `nginx`
  - 배포 대상: `EC2-2`

각 노드는 공통 정의 파일 1개와 환경별 override 파일 2개로 나뉩니다.

- 공통 파일: `docker-compose.yml`
- 로컬용: `compose.local.yml`
- EC2용: `compose.ec2.yml`

즉, 공통 파일은 "어떤 서비스를 띄우는지"를 정의하고, 환경별 파일은 "로컬/EC2에서 어떻게 노출하고 실행하는지"를 정의합니다.

## 2. 디렉토리 구조

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
      default.local.conf
      default.ec2.conf
```

## 3. 파일 역할

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

## 4. 환경 파일

실제 값은 `.env`에 두고, 예시는 `.env.example`를 기준으로 맞춥니다.  
`.env`는 Git에 올리지 않습니다.

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
- `NODE1_HEALTHCHECK_URL`

### node1에서 실제 앱 기동 시 추가로 필요한 값

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `SPRING_DATA_REDIS_HOST`
- `SPRING_DATA_REDIS_PORT`
- `SPRING_DATA_REDIS_PASSWORD`
- `OAUTH_GOOGLE_CLIENT_ID`
- `JWT_SECRET`
- `SPRING_MAIL_USERNAME`
- `SPRING_MAIL_PASSWORD`
- `APP_MAIL_FROM`

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
- `NODE2_HEALTHCHECK_URL`

## 5. 로컬 실행 방법

### 1) 환경 파일 준비

- `node1/.env.example` -> `node1/.env`
- `node2/.env.example` -> `node2/.env`

### 2) node1 실행

```powershell
cd Infra/docker/node1
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

### 3) node2 실행

```powershell
cd Infra/docker/node2
docker compose -f docker-compose.yml -f compose.local.yml up -d
```

## 6. EC2 실행 방법

### EC2-1

```bash
cd /opt/yeoun/Infra/docker/node1
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

### EC2-2

```bash
cd /opt/yeoun/Infra/docker/node2
docker compose -f docker-compose.yml -f compose.ec2.yml up -d
```

## 7. Jenkins 연계 방식

현재 배포 구조는 `/opt/yeoun` 경로를 기준으로 동작합니다.

Jenkins 역할:

- GitLab checkout
- API/Worker 이미지 build
- Docker Hub push
- 각 서버의 `/opt/yeoun/Infra/docker/node1/.env`, `/opt/yeoun/Infra/docker/node2/.env`에 새 이미지 태그 반영
- 원격 서버에서 `deploy-node1.sh`, `deploy-node2.sh` 실행

즉, Compose는 인프라 선언을 담당하고, Jenkins는 이미지 버전 갱신과 배포 실행을 담당합니다.

## 8. 현재까지 확인된 상태

### Jenkins

- Jenkins 컨테이너는 Docker CLI 및 Docker socket 연동 완료
- Jenkins에서 `docker build`, `docker push` 가능
- GitLab webhook + Jenkins job 구성 완료
- `develop` 자동 배포는 최종 end-to-end 검증만 남음

### node2

- `/opt/yeoun` 경로 준비 완료
- `.env`, compose, deploy script 준비 완료
- Jenkins 산출 `WORKER_IMAGE` 기준 수동 배포 검증 완료
- 현재 테스트 이미지 기준으로 worker 응답 확인 완료
- 실제 worker 앱 기능 검증은 아직 별도 필요

### node1

- `/opt/yeoun` 경로 준비 완료
- `.env`, compose, deploy script 준비 완료
- API 이미지 build/push 및 배포까지 확인 완료
- `api`, `postgres`, `redis`, `nginx` 컨테이너 기동 확인 완료
- Actuator 전체 health는 추가 설정/실제 운영 값 정리가 더 필요할 수 있음

## 9. CI/CD 최종 검증 기준

다음이 모두 만족되면 CI/CD 완료로 봅니다.

1. `develop` 브랜치 push
2. GitLab webhook으로 Jenkins 자동 트리거
3. API 이미지 build/push 성공
4. Worker 이미지 build/push 성공
5. EC2-1 deploy 성공
6. EC2-2 deploy 성공
7. 각 서버 health check 및 서비스 응답 확인

## 10. 팀원 주의사항

- `.env` 실파일은 Git에 올리지 않습니다.
- Jenkins credentials는 임의 수정하지 않습니다.
- Docker Hub namespace는 현재 `kss095` 기준입니다.
- Jenkins 콘솔에 출력된 최종 `API_IMAGE`, `WORKER_IMAGE` 값을 기준으로 배포 상태를 확인합니다.
- 문서상 서버 역할과 실제 서버 상태가 다를 수 있으므로, 최종 확인은 항상 `docker ps` 기준으로 합니다.

## 11. 정리

- `docker-compose.yml`: 공통 정의
- `compose.local.yml`: 로컬 차이만
- `compose.ec2.yml`: EC2 차이만
- `.env.example`: 변수 형식 안내
- `.env`: 실제 값
- Jenkins: 이미지 build/push + 원격 배포 실행
- `/opt/yeoun`: 현재 배포 기준 경로
