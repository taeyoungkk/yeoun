# 여운(YEOUN) 프론트엔드 개발 가이드

이 문서는 2명 이상의 개발자가 효율적으로 협업하기 위한 프로젝트 구조와 코딩 규칙을 정의합니다.

## 1. 아키텍처: 기능 중심 구조

우리는 `src/features` 폴더를 중심으로 기능을 독립적으로 관리합니다. 각 개발자는 특정 기능을 맡아 해당 폴더 안에서 작업하며, 서로의 코드를 최소한으로 간섭합니다.

### 폴더별 역할

- `app/`: Expo Router를 사용하는 라우팅 레이어
  - 실제 화면 로직은 작성하지 않고, `src/features` 의 화면을 연결하는 역할만 담당합니다.
- `src/features/[기능명]/`: 특정 기능의 모든 코드
  - `components/`: 해당 기능에서만 사용하는 UI
  - `hooks/`: 해당 기능 전용 커스텀 훅
  - `services/`: API 요청 함수
  - `screens/`: 페이지 전체를 구성하는 화면 컴포넌트
  - `store/`: 해당 기능 전용 상태 관리
  - `utils/`: 해당 기능 전용 유틸 함수
- `src/components/`: 프로젝트 전역에서 재사용하는 공용 UI 컴포넌트
- `src/types/`: 공용 타입 정의
- `src/styles/`: 전역 스타일, Tailwind layer, 공용 스타일 정의

## 2. 작업 흐름

1. 공통 기반 작업
   - 디자인 토큰, 컬러, 폰트, 공용 컴포넌트, 상태 관리 방식 등을 정리합니다.
2. 기능 분담
   - 예: `auth`, `home`, `trip`, `record`, `settlement`
3. 라우트 연결
   - 실제 로직은 `src/features` 에 구현하고, `app/` 에서 import 하여 화면을 연결합니다.

예시:

```text
src/features/auth/screens/LoginScreen.tsx
app/(auth)/login.tsx
```

`app/(auth)/login.tsx` 에서는 `LoginScreen` 을 import 해서 연결만 합니다.

## 3. 코딩 규칙

- 언어: TypeScript (`strict` 모드)
- 컴포넌트: 함수형 컴포넌트
- 스타일링: Tailwind CSS (NativeWind v4) 우선 사용
  - 예: `className="text-lg font-pretendard-bold"`
  - 복잡한 스타일은 `StyleSheet` 또는 `src/styles/global.css` 에서 관리합니다.
- 폰트: Pretendard 사용
  - `font-pretendard`
  - `font-pretendard-medium`
  - `font-pretendard-semibold`
  - `font-pretendard-bold`
- 상태 관리
  - 서버 상태: React Query
  - 전역 상태: Zustand
- 파일명
  - 컴포넌트: PascalCase
  - 나머지: camelCase 또는 팀 규칙에 맞는 명명

## 4. 기능 폴더 예시

예시: `auth` 기능

```text
src/features/auth/
  components/
    AuthButton.tsx
    LoginForm.tsx
  hooks/
    useLogin.ts
  services/
    auth.service.ts
  screens/
    LoginScreen.tsx
    RegisterScreen.tsx
  store/
    loginState.ts
  utils/
    authValidator.ts
```

흐름:

1. `services/` 에서 API 요청 함수 작성
2. `hooks/` 에서 React Query 또는 UI 상태 로직 작성
3. `screens/` 에서 페이지 전체 UI 구성
4. `app/` 에서 해당 screen을 import 해서 라우트 연결

## 5. Expo Router Route Group 규칙

`app/` 구조와 `src/features/` 구조는 기준이 다릅니다.

- `app/`: URL 경로와 레이아웃 기준
- `src/features/`: 기능 단위 코드 조직 기준

즉, `src/features/trip/` 이 있다고 해서 반드시 `app/(trip)/...` 로 만들 필요는 없습니다.

### Route Group이란?

Expo Router에서 괄호가 있는 폴더는 **Route Group** 입니다.

예시:

```text
app/(auth)/login.tsx
```

- 실제 URL: `/login`
- `auth` 는 URL에 포함되지 않습니다.

```text
app/(tabs)/index.tsx
```

- 실제 URL: `/`
- `tabs` 는 URL에 포함되지 않습니다.

### 괄호가 없는 폴더는?

괄호가 없는 폴더는 실제 URL segment로 사용됩니다.

예시:

```text
app/trip/start.tsx
```

- 실제 URL: `/trip/start`

```text
app/trip/[tripId].tsx
```

- 실제 URL: `/trip/123`

### 언제 괄호를 쓰는가?

- URL에 보일 필요는 없지만 레이아웃이나 역할상 묶고 싶을 때
  - 예: `(auth)`, `(tabs)`
- 실제 기능 경로를 URL에 드러내고 싶을 때는 괄호를 쓰지 않습니다.
  - 예: `trip`, `record`, `settlement`

## 6. Route와 Feature 관계 예시

### 인증 기능

```text
app/
  (auth)/
    login.tsx
    register.tsx

src/
  features/
    auth/
      screens/
        LoginScreen.tsx
        RegisterScreen.tsx
```

- URL은 `/login`, `/register`
- 인증 전용 레이아웃을 공유하기 위해 `(auth)` 로만 묶습니다.

### 여행 기능

```text
app/
  trip/
    start.tsx
    create.tsx
    [tripId].tsx

src/
  features/
    trip/
      screens/
        TripStartScreen.tsx
        TripCreateScreen.tsx
        TripDetailScreen.tsx
```

- URL은 `/trip/start`, `/trip/create`, `/trip/:tripId`
- 실제 화면 로직은 `src/features/trip/screens` 에 둡니다.
- `app/trip/*.tsx` 는 화면 import 및 연결만 담당합니다.

## 7. 정리

- `app/(group)` = 파일 정리 및 공통 레이아웃 그룹, URL에는 포함되지 않음
- `app/trip/...` = `trip` 이 실제 URL에 포함됨
- `src/features/trip/...` = trip 기능의 실제 코드 위치
- `app` 구조와 `src/features` 구조는 같은 이름일 수도 있고 다를 수도 있음
- 라우트 폴더명은 URL 설계 기준으로, feature 폴더명은 기능 조직 기준으로 판단합니다.
