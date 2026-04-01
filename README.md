# My Expression Friend Front

React + Vite + Tailwind CSS 기반 프론트 프로젝트입니다.

## 시작하기

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173` 에서 실행됩니다.

## 환경 변수

`.env.example` 을 참고해서 `.env` 파일을 만들 수 있습니다.

```env
VITE_API_BASE_URL=http://localhost:8080
```

Vite 프록시가 `/api` 요청을 백엔드로 전달하므로, 프론트 코드에서는 상대 경로 `/api/...` 를 그대로 사용하면 됩니다.
