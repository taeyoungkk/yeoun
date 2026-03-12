# Backend 로컬 실행 가이드

## 사전 준비
- Java 21
- Docker Desktop

## 1) 로컬 Spring 설정
`application.properties`는 공통 기본 설정입니다.  
`application-local.properties`는 로컬 전용 설정입니다.

예시 파일을 복사해서 로컬 설정 파일을 생성하세요.

```bash
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties
```

## 2) 환경 변수(.env) 설정
`.env.example`을 복사해서 `.env`를 만들고 값을 채우세요.

필수 키:
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `MAIL_USERNAME`
- `MAIL_PASSWORD` (Gmail 앱 비밀번호)
- `MAIL_FROM`

보안 주의:
- `.env`는 민감 정보가 포함되므로 Git에 커밋하면 안 됩니다.
- `.gitignore`에 `.env`, `.env.*`가 포함되어 있어 커밋에서 자동 제외됩니다.

## 3) 로컬 인프라 실행

```bash
docker compose -f docker-compose.dev.yml up -d
docker ps
```

정상 실행 컨테이너:
- `yeoun-local-postgres` (포트 `5432`)
- `yeoun-local-redis` (포트 `6379`)

## 4) Spring Boot 실행 (local 프로필)

### IntelliJ 실행
Run/Debug Configuration에서 아래를 설정하세요.
- Main class: `com.yeoun.YeounApplication`
- Active profiles: `local`

### 터미널 실행

```bash
./mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

## 5) 로컬 인프라 종료

```bash
docker compose -f docker-compose.dev.yml down
```

볼륨까지 삭제하려면:

```bash
docker compose -f docker-compose.dev.yml down -v
```
