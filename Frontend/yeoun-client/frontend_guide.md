# 여운(YEOUN) 프론트엔드 개발 가이드

이 문서는 2인 이상의 개발자가 효율적으로 협업하기 위한 프로젝트 구조와 코딩 규칙을 정의합니다.

## 1. 아키텍처: 기능 중심 구조 (Feature-based)

우리는 `src/features` 폴더를 중심으로 기능을 독립적으로 관리합니다. 각 개발자는 특정 기능을 맡아 해당 폴더 안에서 작업하며, 서로의 코드를 최소한으로 간섭합니다.

### 폴더 역할 상세
- **`app/`**: 라우팅 전용 (Expo Router)
  - 실제 로직은 작성하지 않고, `src/features`의 화면을 연결(Import)만 합니다.
- **`src/features/[기능이름]/`**: 특정 기능의 모든 코드
  - `components/`: 해당 기능에서만 사용하는 UI
  - `hooks/`: 해당 기능 전용 커스텀 훅 (API 호출 등)
  - `services/`: API 요청 함수들
  - `screens/`: 페이지 전체를 구성하는 화면 컴포넌트
  - `store/`: 해당 기능의 로컬 상태 (Zustand 등)
- **`src/components/`**: 버튼, 입력창 등 앱 전체에서 공용으로 쓰이는 UI
- **`src/types/`**: 공용 데이터 모델 (이미 정의됨)

---

## 2. 작업 흐름 (Workflow)

두 명의 개발자가 협업할 때 다음과 같은 흐름을 권장합니다.

1.  **공통 기반 작업 (함께)**: 디자인 시스템(색상, 폰트), 공용 컴포넌트 명세 정의
2.  **기능 분담**: 
    - 개발자 A: 인증(Auth), 프로필(Profile), 홈(Home)
    - 개발자 B: 여행 기록(Records), 지도(Map), 정산(Settlement)
3.  **파일 생성 예시**:
    - `src/features/auth/screens/LoginScreen.tsx` 생성
    - `app/(auth)/login.tsx`에서 위 파일을 import하여 노출

---

## 3. 코딩 규칙 (Coding Convention)

- **언어**: TypeScript (strict 모드)
- **컴포넌트**: 함수형 컴포넌트 (`export const Component = () => { ... }`)
- **스타일링**: **Tailwind CSS (NativeWind v4)** 사용
  - 유틸리티 클래스를 사용하여 디자인을 구현합니다. (예: `className="text-lg font-pretendard-bold"`)
  - 복잡한 스타일은 `src/styles/global.css`에서 `@layer`를 활용해 정의할 수 있습니다.
- **폰트**: **Pretendard** 사용
  - 기본 폰트로 설정되어 있으며, 굵기에 따라 아래 클래스를 사용합니다.
  - `font-pretendard` (Regular)
  - `font-pretendard-medium`
  - `font-pretendard-semibold`
  - `font-pretendard-bold`
- **상태 관리**:
  - 서버 데이터: `React Query` (@tanstack/react-query)
  - 전역 스토어: `Zustand`
- **파일명**: PascalCase (컴포넌트), camelCase (나머지)

---

## 4. 기능별 파일 구성 예시 (Example: Auth Feature)

기능별 폴더(`src/features/auth`)는 아래와 같이 구성하는 것을 표준으로 합니다.

```text
src/features/auth/
├── components/           # 이 기능에서만 재사용되는 UI 컴포넌트
│   ├── AuthButton.tsx
│   └── LoginForm.tsx
├── hooks/                # API 호출 로직이 포함된 커스텀 훅
│   └── useLogin.ts       # React Query를 활용한 로그인 로직
├── services/             # 순수 API 호출 함수 (Axios)
│   └── auth.service.ts
├── screens/              # 페이지 단위 컴포넌트
│   ├── LoginScreen.tsx
│   └── RegisterScreen.tsx
├── store/                # 기능 전용 상태 관리 (필요 시)
│   └── loginState.ts
└── utils/                # 이 기능에서만 쓰는 유틸리티
    └── authValidator.ts
```

### 아키텍처 흐름 예시
1.  **Service**: `auth.service.ts`에서 Axios로 API를 호출합니다.
2.  **Hook**: `useLogin.ts`에서 위 서비스를 호출하고 `useMutation`으로 상태를 관리합니다.
3.  **Screen**: `LoginScreen.tsx`에서 위 훅을 사용하여 UI를 렌더링합니다.
4.  **Route**: `app/(auth)/login.tsx`에서 `LoginScreen`을 import하여 실제 페이지로 노출합니다.

