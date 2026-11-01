# 양궁 성장일지 MCP 서버

LEVEL-UP ARCHERY(양궁 성장일지) 앱의 Supabase 데이터를 Claude가 직접 조회할 수 있게 해주는 로컬 MCP 서버예요.
"1학년 5반 학생들 명중률 어때?" 같은 질문을 Claude에게 바로 물어볼 수 있어요.

## 할 수 있는 것 (도구 5개)

- `list_classes` — 내 학급 목록
- `list_students` — 특정 학급의 학생 명단
- `list_days` — 특정 학급의 일차 목록
- `get_shooting_logs` — 슈팅(기록하기) 결과 조회
- `get_reflection_answers` — 성찰 문항 답변 조회(질문 내용 포함)
- `get_class_summary` — 학급 전체 통계(총 명중률, 학생별 명중 랭킹 TOP 20)

이 서버는 **읽기 전용**이에요 — 학생 데이터를 수정하거나 지우는 도구는 없어요.

## 설치

```bash
cd mcp-server
npm install
cp .env.example .env
```

`.env` 파일을 열어서 `SUPABASE_SERVICE_ROLE_KEY`를 채워주세요:

1. https://supabase.com/dashboard/project/uufwydjebpxydyjjseix/settings/api-keys 접속
2. **service_role** 키(secret)를 복사해서 `.env`의 `SUPABASE_SERVICE_ROLE_KEY=` 뒤에 붙여넣기

> ⚠️ **service_role 키는 모든 보안 검사(RLS)를 건너뛰는 강력한 키예요.** 이 키가 있으면
> 학생 PIN, 교사 비밀번호 해시를 포함한 전체 데이터베이스에 접근할 수 있어요. 깃허브에
> 올리거나 다른 사람과 공유하지 마세요 — `.env` 파일은 `.gitignore`에 이미 포함되어 있어서
> 실수로 커밋되지 않아요.

## Claude Code에 연결하기

터미널에서(이 폴더 경로는 본인 컴퓨터 기준으로 바꿔주세요):

```bash
claude mcp add level-up-archery -- node /절대/경로/level-up-archery/mcp-server/index.js
```

또는 `.env`를 안 쓰고 싶으면 환경변수를 직접 넘겨도 돼요:

```bash
claude mcp add level-up-archery \
  --env SUPABASE_URL=https://uufwydjebpxydyjjseix.supabase.co \
  --env SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_키 \
  -- node /절대/경로/level-up-archery/mcp-server/index.js
```

## Claude Desktop에 연결하기

Claude Desktop 설정(`claude_desktop_config.json`)의 `mcpServers`에 추가:

```json
{
  "mcpServers": {
    "level-up-archery": {
      "command": "node",
      "args": ["/절대/경로/level-up-archery/mcp-server/index.js"],
      "env": {
        "SUPABASE_URL": "https://uufwydjebpxydyjjseix.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "여기에_service_role_키"
      }
    }
  }
}
```

설정 후 Claude Desktop을 재시작하면 연결돼요.

## 설계 메모

- 테이블을 직접 조회한다(`shooting_logs`/`reflections`/`reflection_answers`가 이미 `class_name`/`student_name`처럼
  필요한 정보를 같이 저장해두고 있어서, 복잡한 조인 없이도 바로 쓸만한 결과가 나온다).
- 학생/교사 로그인 세션을 흉내내지 않고 `service_role` 키로 RLS를 건너뛴다 — 이 서버는
  "교사 본인 컴퓨터에서만 실행하는 신뢰된 도구"라는 전제이기 때문. 여러 교사가 함께 쓰는
  배포형 서버로 만들려면 그때는 학급별 접근 제어를 다시 설계해야 한다.
- 수정/삭제 도구는 의도적으로 넣지 않았다. 학생 기록을 고치거나 지우고 싶으면 앱의 관리자
  화면을 쓰는 게 안전하다(실수로 잘못 지우는 사고를 막기 위함).
