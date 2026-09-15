# LEVEL-UP ARCHERY (양궁 성장일지)

중학교 체육(양궁) 수업용 웹앱. 학생이 활·조준 데이터를 관리하며 스스로 조준을 보정하고,
심리기술을 읽고·배우고·기록하고·성찰하며, 그 기록이 수행평가 자료로 쌓이게 합니다.

자세한 구조/설계 이유/다음 단계는 [`HANDOFF.md`](./HANDOFF.md)를 참고하세요.

## 개발

```bash
npm install
cp .env.example .env   # Supabase 프로젝트 URL/anon key 채우기
npm run dev
```

## 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 GitHub Pages로 자동 배포합니다.
