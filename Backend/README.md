# Backend 로컬 실행 가이드

## 1) 사전 준비
- Java 21
- Docker Desktop

## 2) 로컬 Spring 설정
`application.properties`는 공통 기본 설정을, `application-local.properties`는 로컬 환경 전용 설정을 관리합니다.
환경별로 달라질 수 있는 값은 공통 설정과 분리합니다.

로컬 PC에서 아래 파일을 복사해 `application-local.properties`를 생성해 주세요.
해당 파일은 커밋하지 않습니다.

```bash
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
```

생성 후 최소한 아래 값은 로컬에 맞게 변경해 주세요.
- `jwt.secret` : JWT 서명 키이므로, 예시 파일의 기본값을 그대로 사용하지 말고 로컬에서 고유한 긴 문자열로 변경해 주세요.

## 3) 로컬 인프라 실행
아래 명령어는 Backend 루트 디렉터리 기준입니다.

```bash
docker compose -f docker-compose.dev.yml up -d
docker ps
```

정상 기동 컨테이너:
- `yeoun-local-postgres` (포트 `5432`)
- `yeoun-local-redis` (포트 `6379`)

## 4) Spring Boot 실행 (local 프로필)
```bash
./mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

### IntelliJ 실행 방법 (Shift+F10)
`Run/Debug Configurations`에서 아래처럼 설정하면 터미널 실행과 동일하게 `local` 프로필로 실행됩니다.

- `Main class`: `com.yeoun.YeounApplication`
- `Active profiles`: `local`

설정 저장 후 해당 Run Configuration을 선택하고 `Shift+F10`으로 실행하세요.

## 5) 로컬 인프라 종료
```bash
docker compose -f docker-compose.dev.yml down
```

볼륨까지 제거하려면:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## 참고
이 문서는 Backend 로컬 개발 환경만 다룹니다.

로컬 개발 편의를 위해 Backend에서는 PostgreSQL, Redis 기반의 최소 실행 환경을 별도로 제공합니다.
운영/배포 환경 인프라(PostgreSQL, Redis, Kafka, Nginx)는 `yeoun-infra`에서 관리합니다.
