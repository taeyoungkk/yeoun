# Infra Scripts Guide

이 폴더는 Jenkins나 수동 SSH 배포 시 사용할 서버 실행 스크립트를 관리합니다.

## 목적

- Jenkinsfile 안에 긴 배포 명령을 직접 적지 않기 위해 사용합니다.
- `Infra/docker`의 Compose 파일을 실제로 어떤 순서로 실행할지 정의합니다.
- 같은 절차를 Jenkins와 수동 배포에서 함께 재사용할 수 있게 합니다.

## 파일 구성

- `common.sh`
  - 공통 함수 모음
  - 로그 출력, env 로드, 필수 파일/변수 확인, `docker compose` 실행 래퍼 포함
- `check-env.sh`
  - node1/node2 배포 전에 필요한 파일과 env 변수가 있는지 점검
- `deploy-node1.sh`
  - EC2-1에서 실행
  - `node1`의 `api`, `nginx`를 대상으로 pull/up 수행
- `deploy-node2.sh`
  - EC2-2에서 실행
  - `node2`의 `worker`, `nginx`를 대상으로 pull/up 수행
- `rollback-node1.sh`
  - API 이미지 태그를 이전 값으로 바꾼 뒤 node1 재배포
- `rollback-node2.sh`
  - Worker 이미지 태그를 이전 값으로 바꾼 뒤 node2 재배포

## 배포 원칙

- 상태 저장 서비스는 기본적으로 배포 대상에서 제외합니다.
  - node1: `postgres`, `redis`는 유지
  - node2: `kafka`는 유지
- 앱 계층만 갱신합니다.
  - node1: `api`, `nginx`
  - node2: `worker`, `nginx`
- EC2 배포는 항상 `compose.ec2.yml` 조합으로 수행합니다.

## 사용 예시

### 1. 사전 점검

```bash
bash Infra/scripts/check-env.sh node1
bash Infra/scripts/check-env.sh node2
```

### 2. 배포

```bash
bash Infra/scripts/deploy-node1.sh
bash Infra/scripts/deploy-node2.sh
```

### 3. 롤백

```bash
bash Infra/scripts/rollback-node1.sh 1.0.3
bash Infra/scripts/rollback-node2.sh 1.0.3
```

위 예시에서 `1.0.3`은 이전 이미지 태그입니다.
실제로는 Jenkins가 빌드/배포 기록을 보고 이전 태그를 넘겨주는 방식이 적절합니다.

## Jenkins 연계 방식

권장 흐름은 아래와 같습니다.

1. Jenkins가 API 또는 Worker 이미지를 빌드합니다.
2. Docker Hub에 태그를 push 합니다.
3. 서버에 SSH 접속 후 해당 서버용 스크립트를 실행합니다.
4. 스크립트가 `.env` 값을 읽고 `docker compose pull`, `up -d`를 수행합니다.

즉, Jenkins는 오케스트레이션을 담당하고, 실제 배포 절차는 이 폴더의 스크립트가 담당합니다.

## 주의 사항

- 이 스크립트들은 Linux EC2에서 실행하는 Bash 스크립트 기준입니다.
- Windows 로컬에서 편집하더라도, 실제 실행 대상은 EC2 서버입니다.
- `.env` 파일은 Git에 올리지 않습니다.
- 롤백 스크립트는 `.env`의 이미지 값을 변경하므로, 운영 환경에서는 변경 이력 관리가 필요합니다.
