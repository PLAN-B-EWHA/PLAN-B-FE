# MyExpressionFriend Frontend

React + Vite + Tailwind 기반 프론트엔드입니다.

## 실행

```bash
npm install
npm run dev
```

## 환경변수

`.env` 파일에 아래 값을 설정하세요.

```env
VITE_API_BASE_URL=http://localhost:8080
```

## 현재 구현

- 로그인 (`/login`)
- 자동 세션 복구 (`/api/auth/refresh`)
- 내 정보 조회 (`/api/users/me`) 기반 인증 상태 유지
- 401 발생 시 자동 refresh 후 1회 재시도 (`withAuthRetry`)
- 권한 기반 라우팅
  - `/admin` -> `ADMIN`
  - `/parent` -> `PARENT`
  - `/therapist` -> `THERAPIST` 또는 `TEACHER`
- 권한 부족 시 `/403` 페이지 안내
- 관리자 화면
  - 유저 목록 조회 (`GET /api/users`)
  - PENDING 유저 역할 승급 (`PATCH /api/users/{userId}/role`)
- 로그아웃
- 백엔드 연결 확인 (`/actuator/health`)

## 참고

- 개발 환경 fallback으로 로그인 응답에 `refreshToken`이 바디에 있으면 브라우저 쿠키(`refreshToken`)를 설정합니다.
- 운영 환경에서는 서버가 HttpOnly 쿠키를 직접 내려주는 구성을 권장합니다.
