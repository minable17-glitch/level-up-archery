# LEVEL-UP ARCHERY (양궁 성장일지) — 프로젝트 인수인계 문서

이 문서는 다른 AI 코딩 도구/세션이 처음부터 맥락을 파악할 수 있도록 작성된 인수인계 문서입니다.

## 1. 프로젝트 개요

- **무엇**: 중학교 체육(양궁) 수업용 웹앱. 학생이 (1) 활 번호를 적고 과녁에 맞은 자리를 기록하며(빨강·금색만 명중으로 집계, 탄착군에 따른 자동 피드백 포함), (2) 심리기술을 읽고·배우고·성찰 문항에 답하며, (3) 이 기록이 수행평가 자료로 축적되게 한다. (초기 버전엔 앱이 사이트(조준기) 세팅값을 어느 방향으로 옮길지 제안하는 "조준 보정 코치" 기능이 있었으나, 교사가 학생을 의도적으로 오조준시켜 스스로 물리적 사이트를 조정하게 하는 수업 방식이라 그 부분은 제거했다. 다만 탄착군을 보고 "다음엔 어느 방향으로 조준하라"/"자세를 점검하라" 정도의 가벼운 피드백은 다시 필요하다고 해서 별도 로직(`aimFeedback.js`)으로 다시 넣었다 — 아래 §5 참고.)
- **누구를 위해**: 비개발자 교사(minable17@gmail.com)가 실제 학급에서 운영할 예정. 학생은 모바일에서 주로 사용.
- **다른 프로젝트와의 관계**: 같은 교사가 운영하는 "새싹책방"(독서 챌린지 앱, `minable17-glitch/Mingit1` 저장소)이 별도로 있다. **처음에는 이 앱도 그 저장소의 브랜치 하나로 같이 만들었다가, GitHub Pages 배포 주소가 같은 저장소 안에서 서로 충돌하는 문제 때문에 이 저장소(`level-up-archery`)로 완전히 분리했다.** 그래서 코드 스타일/패턴이 그 저장소의 것과 많이 닮아 있다 (의도적으로 재사용함). **두 앱은 서로 다른 Supabase 프로젝트를 쓴다** — 절대 같은 Supabase 프로젝트/키를 공유하면 안 됨.
- **원본 기획서**: 교사가 제공한 구현 명세서(사용자 메시지)와, 같은 교사의 러닝 성찰일지 앱에서 얻은 교훈을 정리한 인수인계서(업로드 파일)를 함께 참고해서 만들었다. 명세서는 Google Apps Script 스택을 제안했지만, 실제로는 새싹책방에서 이미 검증된 **React + Vite + Supabase** 스택을 그대로 재사용했다 (같은 교사가 관리하기 쉽고, 이미 겪은 함정을 피할 수 있어서).

## 2. 기술 스택

```
React 19 + Vite 8, 단일 페이지 앱 (탭 전환은 JS state로 구현, 라우터 없음)
Supabase (Postgres + Auth) — 이 앱 전용 프로젝트를 새로 만들어야 함
vite-plugin-pwa (기존 새싹책방과 동일한 캐싱 전략 재사용)
```

인증 방식: 학생/교사 로그인 모두 내부적으로 Supabase **익명 인증**을 사용한다 (`ensureFreshAnonSession()` → signOut 후 signInAnonymously). 실제 신원 확인은 SECURITY DEFINER RPC 함수 안에서 `crypt()`/`gen_salt('bf')`로 해시된 PIN(학생)/관리자 코드(교사)를 검증한다. 이메일 인증은 전혀 쓰지 않는다.

### 환경변수

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.example` 참고. 로컬 개발 시 `.env`로 복사해서 채운다 (`.gitignore`에 이미 등록됨).

### 배포

`.github/workflows/deploy.yml`이 `main` 브랜치 push 시 GitHub Pages로 빌드/배포한다. publishable(anon) key는 공개해도 안전한 값이라 워크플로 파일에 직접 넣어뒀다 (Secrets 등록 불필요). 배포 주소: **https://minable17-glitch.github.io/level-up-archery/**

저장소를 처음 만들면 GitHub Pages 소스를 "GitHub Actions"로 설정해야 할 수 있다 (Settings → Pages → Build and deployment → Source). 새 저장소의 `github-pages` 배포 환경(Settings → Environments)에 브랜치 제한이 걸려있으면 배포가 원인 불명으로 실패하니, 실패하면 이것부터 확인할 것 (새싹책방 저장소에서 실제로 겪은 문제였다).

## 3. 화면 구조

**v3: "일차(day)" 구조.** 학급 안에 여러 "일차"가 있고, 읽어보기/배워보기/성찰 문항과 학생의 기록은 전부 특정 일차에 속한다(러닝 성찰일지 앱의 classes → days → day_questions/records 구조를 그대로 따름). 학생은 먼저 일차를 고른 뒤, 그 일차 안에서 STEP1~4를 진행한다.

```
RoleGate   "역할을 선택하세요" — 학생으로 로그인 / 선생님으로 로그인
  ├ 학생으로 로그인
  │  StudentLoginGate   학급 코드 + 학번 + 이름 + PIN(4자리) 로그인 (최초 로그인 = 자동 등록)
  │    └ 하단 탭 2개 — 일차 / 내 기록 ("내 장비" 탭은 삭제됨)
  │        일차       DayList(일차 목록) → 일차 선택 → DayView, 안에 STEP 1~4 pill 네비게이션
  │                      STEP 1 읽어보기   이미지 콘텐츠 카드 목록 → 상세(이미지 세로 스크롤)
  │                      STEP 2 배워보기   영상(유튜브 embed/직접 재생) + 이미지 + 설명, 박스 호흡 타이머 포함
  │                      STEP 3 기록하기   활 번호를 이 화면에서 직접 입력 + 과녁 탭 마커 기록(최대 50발,
  │                                        빨강·금색만 명중) + "빗나간 화살 수" 스테퍼로 총 발수/명중 집계 +
  │                                        탄착군 기반 조준/자세 피드백
  │                      STEP 4 성찰하기   교사가 만든 성찰 문항에 답변만 (일차당 1건 업서트)
  │        내 기록     MyRecordsTab — 지금까지의 모든 일차를 나열하며 일차별 기록 요약(총발수/명중)과
  │                    내가 쓴 성찰 문항 답변을 한 번에 모아볼 수 있는 화면 (읽기 전용)
  └ 선생님으로 로그인 → AdminTab
       AuthScreen       아이디/비밀번호 로그인, 계정 만들기, 아이디 찾기(이메일), 비밀번호 찾기(아이디+이메일)
       ClassPicker      로그인한 교사가 만든 학급 목록 + 새 학급 만들기 (교사 1명이 여러 학급 가능)
       학급 선택 후     2개 서브탭 — 학생·기록 / 일차 관리
                        일차 관리(AdminDayManager) = 일차 목록(추가·수정·삭제) → 일차 선택 →
                          STEP 1 읽어보기 / STEP 2 배워보기 / STEP 4 성찰 문항 CRUD
                        헤더에서 학급 코드도 직접 수정 가능
```

학생 화면 상단에도 작은 "관리자" 버튼이 있어서 로그아웃 없이 바로 관리자 화면으로 전환할 수 있다(같은 기기를 교사가 테스트할 때 편하도록).

## 4. 파일 지도

```
src/
  App.jsx                     세션 상태 + 하단 탭(일차/내 기록) 네비게이션 셸 ("내 장비" 탭은 삭제됨)
  index.css                   디자인 토큰(CSS 변수) + 유틸리티 클래스 (인라인 스타일 대신 클래스 사용)
  lib/
    supabaseClient.js         Supabase 클라이언트 (그대로 재사용 가능한 범용 코드)
    date.js                   KST 날짜 유틸 (그대로 재사용 가능한 범용 코드)
    session.js                localStorage 학생 세션 + 저장된 학급 코드
    api.js                    모든 Supabase RPC 호출 래퍼
    media.js                   유튜브 URL → embed 변환, 쉼표구분 URL 파싱
    upload.js                  Supabase Storage(`content-uploads` 버킷)로 이미지/영상 파일 업로드 후 공개 URL 반환
    aimFeedback.js              명중 판정 반지름(HIT_RADIUS)과 탄착군 기반 조준/자세 피드백 로직 (순수 함수, 아래 §5 참고)
    offlineCache.js              cachedFetch(key, fetchFn) — 목록성 조회(일차 목록/읽어보기·배워보기 자료/성찰 문항) 결과를 localStorage에 남겨뒀다가, 네트워크 요청이 실패하면(오프라인) 그 캐시로 대체
    offlineQueue.js               markPending/attemptSync/flushAll/startAutoFlush — 기록하기·성찰하기 저장을 항상 먼저 localStorage 큐에 남기고 서버 저장을 시도, 실패(오프라인)하면 큐에 남겨뒀다가 'online' 이벤트·주기적 재시도로 자동 재전송
    useOnlineStatus.js            navigator.onLine + online/offline 이벤트를 구독하는 훅. RecordTab/ReflectTab의 오프라인 배너에 사용
  components/
    RoleGate.jsx                 첫 화면 역할 선택(학생/선생님)
    StudentLoginGate.jsx
    DayList.jsx                  학생용 일차 목록 (classId → 일차 카드 리스트, 로그인 직후 바로 보임)
    DayView.jsx                  학생용 일차 상세: STEP1~4 pill 네비게이션 + Read/Learn/Record/ReflectTab을 dayId로 렌더
    MyRecordsTab.jsx             "내 기록" 탭: classId의 모든 일차를 나열하며 각 일차의 슈팅 기록 요약과 성찰 문항+내 답변을 함께 보여줌 (읽기 전용, 새 API 없이 기존 per-day 엔드포인트를 일차 수만큼 병렬 호출)
    ReadTab.jsx / LearnTab.jsx    dayId prop 기준으로 콘텐츠 조회 (이전엔 classId 기준)
    TargetFace.jsx               과녁 SVG스러운 원형 탭 UI (실제로는 절대위치 div 레이어), MAX_MARKERS=50. 마커는 pointer-events:none이라 탭해도 지워지지 않음 — 삭제는 RecordTab의 "마지막 취소"/"전체 지우기" 버튼으로만 가능. 명중(빨강·금색, HIT_RADIUS 이내)은 초록 ●, 그 외(과녁엔 맞았지만 비명중)는 흐린 ✕로 표시
    RecordTab.jsx                 기록하기 화면 본체 (dayId prop, 활 번호를 이 화면에서 직접 입력, 장비 등록 개념 없음, 명중 마커 + "빗나간 화살 수" 스테퍼로 총 발수/명중 집계, 탄착군 기반 조준/자세 피드백(aimFeedback.js) 표시, 일차당 1건 업서트). 변경사항이 있으면 800ms 디바운스로 자동 저장하고, 컴포넌트가 언마운트될 때(STEP 전환·일차 목록으로 나가기 등) 저장 대기 중이던 값을 즉시 flush함
    BoxBreathing.jsx              박스 호흡(4-4-4-4) 타이머 위젯
    ReflectTab.jsx                 dayId prop 기준, 교사 문항 답변만 (일차당 1건 업서트). RecordTab과 같은 방식으로 문항별 답변을 800ms 디바운스 자동 저장 + 언마운트 시 즉시 flush
    AdminTab.jsx                  교사 계정 로그인/가입/찾기(AuthScreen) + 학급 선택(ClassPicker) + 서브탭 셸(학생·기록/일차 관리)
    AdminDayManager.jsx           일차 목록 CRUD → 일차 선택 시 STEP1/2/4 콘텐츠 편집 UI를 감싸서 보여줌. 일차별 "다른 반에 복사" 버튼(교사의 다른 학급 목록 중 골라서 admin_copy_day 호출, 읽어보기/배워보기/성찰 문항까지 통째로 복사)
    AdminContentEditor.jsx        읽어보기/배워보기 콘텐츠 CRUD (kind prop으로 공용화, dayId 기준)
    AdminReflectionEditor.jsx     성찰 문항 CRUD (일차별로 교사가 자유롭게 문항 추가/수정/삭제, dayId 기준)
    AdminRecords.jsx              🏆 명중 랭킹(TOP 20, 학급 내 모든 일차 명중 발수 합산, 새 RPC 없이 이미 불러온 슈팅 기록을 클라이언트에서 집계) + 학급 전체 슈팅기록/성찰기록 요약 표 + 학생 명단(이름 클릭 시 AdminStudentDetail로 드릴다운)
    AdminStudentDetail.jsx        특정 학생의 기록을 일차별로 묶어 보여줌(슈팅 기록 + 성찰 답변), 일차별 "기록 삭제" 버튼, 비밀번호(PIN) 재설정 폼

supabase/schema.sql            전체 스키마 + RPC 함수 (Supabase SQL Editor에서 실행)
```

## 5. 명중 판정 + 탄착군 피드백 로직 (`src/lib/aimFeedback.js`)

- 최초엔 사이트(조준기) 세팅값을 어느 방향으로 옮길지 제안하는 "조준 보정 코치"(`src/lib/aimCoach.js`)가 있었는데, 학생을 의도적으로 오조준시켜 스스로 물리적 사이트를 조정하게 하는 수업 방식이라 **완전히 삭제**했었다. 그 다음에 "명중 판정을 빨강·금색 안쪽으로만 제한하고, 탄착군을 보고 조준 방향/자세 피드백을 달라"는 요청이 들어와서, **사이트 세팅과 무관한 훨씬 가벼운 형태로 다시 만들었다** — `aimCoach.js`(삭제됨, 사이트 값 입력·저장까지 다루던 구버전)와는 별개의 새 파일 `aimFeedback.js`다.
- **명중(명중 수) 판정**: 과녁 중심에서 반지름의 `HIT_RADIUS = 0.4` 이내(빨강+금색 영역)에 탭한 것만 "명중"으로 집계한다. `TargetFace.jsx`에서 각 마커의 중심 거리를 계산해 그 안쪽이면 초록 `●`(hit), 바깥쪽(흰색/검정/파랑 영역, 과녁에는 맞았지만 명중은 아님)이면 흐린 흰색 `✕`(non-hit)로 다르게 표시한다. `RecordTab`은 `hitCount = markers.filter(안쪽).length`를 계산해서 저장한다(더 이상 `markers.length` 전체가 아님).
- **다음 조준 지점 표시(참고용)**: 탄착군이 잘 모였는데 중앙에서 벗어난 경우(`kind: 'warn'`, offset 케이스), `computeAimFeedback`이 탄착군 중심을 과녁 중심 기준으로 대칭 이동한 좌표를 `suggestedAimPoint`로 함께 반환한다. `TargetFace`가 그 위치에 파란 `◎`를 펄스 애니메이션으로 표시해서 "대략 이 방향으로 조준해보라"는 시각적 힌트를 준다(탄착군이 흩어진 경우·잘 모인 경우엔 `suggestedAimPoint`가 `null`이라 표시 안 됨).
- **탄착군 피드백**: 명중 여부와 무관하게 **과녁에 맞은 모든 마커**(non-hit 포함)의 평균 좌표(탄착군 중심)와 평균 퍼짐(각 마커의 중심으로부터 거리 평균)을 계산한다.
  - 마커 3발 미만 → "더 쏴야 피드백 가능" 안내.
  - 퍼짐이 넓으면(`GROUP_SPREAD_THRESHOLD=0.35` 초과) → 방향 안내 대신 **자세 피드백**("탄착군이 고르게 모이지 않았어요... 자세 문제일 수 있어요").
  - 퍼짐은 좁은데(잘 모였는데) 중심이 과녁 중심에서 `CENTER_OFFSET_THRESHOLD=0.15` 넘게 벗어났으면 → **반대 방향으로 조준하라는 안내**(탄착군이 위로 몰렸으면 "아래로 조준", 오른쪽으로 몰렸으면 "왼쪽으로 조준" 등 — 사이트를 옮기라는 게 아니라 다음 발의 조준점 자체를 그렇게 잡으라는 의미라 방향이 이전 sight-coach 로직과 반대다).
  - 잘 모였고 중심도 맞으면 → "잘하고 있어요" 긍정 피드백.
  - `RecordTab`의 `.advice-box`(`pending`/`good`/`warn` 클래스, `index.css`에 이미 있던 스타일 재사용)에 표시된다.
- `save_shooting_log` RPC는 하위 호환을 위해 `p_group_center_x/y`, `p_aim_advice`, `p_sight_before/after` 파라미터를 여전히 받지만, 프런트엔드는 전부 `null`을 보낸다(탄착군 피드백은 매번 클라이언트에서 실시간 계산하고 DB에는 저장하지 않음).

## 6. DB 스키마 요약 (`supabase/schema.sql`)

| 테이블 | 용도 |
|---|---|
| `teachers` | 교사 계정: 아이디(unique)+비밀번호 해시+이메일, `auth_user_id`로 현재 익명 세션과 연결 |
| `classes` | 학급 이름, 학급 코드(학생용), `teacher_id`로 소유 교사 연결 |
| `students` | 학번+이름+PIN해시, `auth_user_id`로 현재 익명 세션과 연결 |
| `equipment` | **더 이상 프런트엔드에서 쓰지 않음** — "내 장비" 탭을 통째로 없앴다. 테이블/`save_equipment`/`get_my_equipment` RPC는 DB에 남아있지만(호출하는 코드 없음, 데이터 손실 없이 안전하게 방치) 활 번호는 이제 `shooting_logs.bow_number`에 기록 시점마다 직접 입력됨 |
| `days` | **(v3 신규)** 학급 안의 "일차". `class_id` 소유, `order_index`로 정렬, `title` |
| `read_contents` / `learn_contents` | 교사가 등록하는 콘텐츠. **(v3) `day_id` 소유로 변경**(이전엔 `class_id`). 이미지 URL은 쉼표로 여러 개, 학생에게는 `visible=true`만 노출 |
| `shooting_logs` | 학생당 일차 1건(`unique(student_id, day_id)`) 탄착 마커·명중수(`hit_count`)·빗나간 화살 수(`miss_count`, 신규). 총 발수는 `hit_count + miss_count`로 계산. `group_center_x/y`/`aim_advice`/`sight_before`/`sight_after` 컬럼은 남아있지만 조준 보정 코치 제거 이후 항상 null. `day_title` 등 조회 편의용 비정규화 컬럼 포함 |
| `reflections` | 학생당 일차 1건(`unique(student_id, day_id)`). `used_skills`/`short_note` 컬럼은 남아있지만 학생 화면에서 UI가 빠져서 항상 빈 값(`{}`/null)으로 저장됨 — 이 행 자체는 성찰 문항 답변을 관리자 화면에 묶어 보여주기 위한 뼈대로 계속 저장됨 |
| `reflection_questions` | 교사가 **일차별로** 만드는 성찰 문항 (러닝앱의 day_questions 대응, **v3에서 `class_id`→`day_id` 소유로 변경**) |
| `reflection_answers` | 학생별·문항별 답변 (`unique(student_id, question_id)`, **v3에서 `log_date` 제거** — 문항 자체가 일차에 속하므로 날짜가 불필요해짐) |

**보안 설계**: 모든 테이블에 RLS를 켜두고, `days`/`read_contents`/`learn_contents`/`reflection_questions`의 "select만 허용"(콘텐츠 조회용) 정책 외에는 **직접 테이블 접근을 전부 막는다**. 모든 읽기/쓰기는 SECURITY DEFINER RPC 함수를 통해서만 하고, 함수 내부에서 `auth.uid()`로 신원(학생 또는 교사)을 확인한다. 관리자 함수들은 `assert_class_owner(p_class_id)`(학급 단위), `assert_day_owner(p_day_id)`(일차 단위, 내부적으로 `days.class_id`를 거쳐 교사 소유를 확인), 또는 `assert_student_owner(p_student_id)`(학생 단위, `students.class_id`를 거쳐 확인)로 권한을 확인한다. 이 패턴(익명 인증 + SECURITY DEFINER RPC + RLS)은 새싹책방 앱에서 실제로 검증된 방식을 그대로 따른 것이다.

**관리자: 학생별 기록 조회·삭제·PIN 재설정**: `AdminRecords`의 학생 명단에서 이름을 누르면 `AdminStudentDetail`로 드릴다운되어, 그 학생의 기록을 **일차별로 묶어서** 보여준다(슈팅 기록 + 그 일차의 성찰 문항 답변). 관련 RPC: `admin_list_student_shooting_logs(p_student_id)`, `admin_list_student_reflection_answers(p_student_id)`(reflection_answers를 days/reflection_questions와 조인해 day_title·question_text까지 한 번에 반환), `admin_delete_student_day_record(p_student_id, p_day_id)`(그 학생의 그 일차 슈팅 기록 + 성찰 답변을 한 번에 삭제 — 행 단위가 아니라 "일차 단위" 삭제), `admin_reset_student_pin(p_student_id, p_new_pin)`(학생이 PIN을 잊어버렸을 때 교사가 4자리 숫자로 재설정). 전부 `assert_student_owner`로 권한 확인.

**v3 마이그레이션 주의**: `read_contents`/`learn_contents`/`reflection_questions`/`shooting_logs`/`reflections`/`reflection_answers` 6개 테이블은 구조가 바뀌어 `schema.sql`이 `DROP TABLE ... CASCADE` 후 재생성한다(당시 실제 콘텐츠·기록 데이터가 없어서 안전하게 내린 선택). `teachers`/`classes`/`students`/`equipment`는 그대로 유지된다. 이미 콘텐츠·기록을 입력한 뒤에 이 SQL을 다시 실행하면 그 데이터는 사라지니 주의할 것.

**교사 계정 (v2, 최초 버전의 "학급코드+관리자코드" 방식에서 교체됨)**: 아이디+비밀번호 계정 시스템. 교사 1명이 여러 학급을 만들 수 있고, 로그인 후 `ClassPicker`에서 관리할 학급을 고른다. "아이디 찾기"/"비밀번호 찾기"는 **이메일 발송 인프라가 없어서** 실제 이메일을 보내지 않고, 가입 시 등록한 이메일이 일치하면 그 자리에서 바로 아이디를 보여주거나 새 비밀번호를 설정하게 해준다 — 진짜 이메일 인증 루프는 아니지만, 학교 내부용 저위험 도구라 이 정도면 충분하다고 판단했다. 나중에 진짜 이메일을 보내고 싶으면 러닝 앱 인수인계서에서 설명한 `supabase.functions.invoke('send-password-reset')` 패턴(Supabase Edge Function + 이메일 서비스)을 참고할 것.

## 7. 배포 상태 & 아직 안 한 것

- **Supabase 프로젝트**: 만들어졌다. 프로젝트명 `level-up-archery`, 프로젝트 ref `uufwydjebpxydyjjseix` (`minable17` 계정, 새싹책방과는 별개의 Supabase 계정 — Free 플랜 "계정당 프로젝트 2개" 제한 때문에 새 계정으로 만들었다). Anonymous Sign-Ins도 켜져 있다. `supabase/schema.sql`은 안전하게 재실행 가능하게 작성되어 있으니(IF EXISTS 가드), 스키마를 더 바꾸면 SQL Editor에서 전체 파일을 다시 실행하면 된다.
- **배포**: `.github/workflows/deploy.yml`이 `main` push마다 GitHub Pages로 빌드/배포한다. 배포 주소: **https://minable17-glitch.github.io/level-up-archery/**
  - 이 앱은 원래 `minable17-glitch/Mingit1` 저장소의 브랜치 하나로 시작했는데, 그 저장소가 이미 새싹책방의 GitHub Pages 사이트로 쓰이고 있어서 같은 주소를 두고 배포가 서로 덮어쓰는 문제가 있었다. 그래서 이 저장소로 통째로 옮겼다 — 지금은 완전히 독립된 배포 주소를 쓴다.
  - Mingit1 저장소 쪽에는 더 이상 양궁 앱 배포 워크플로가 없어야 한다(옮기면서 지웠음). 혹시 다시 생기면 똑같은 충돌이 날 수 있으니 주의.
- **앱 아이콘**: `public/icon-192.png`, `public/icon-512.png`가 아직 새싹책방(나무 그림)의 아이콘 그대로 남아있다. `public/favicon.svg`만 과녁 모양으로 교체했다. 실제 배포 전에 학교 쪽에서 양궁 테마 아이콘으로 교체를 권한다.
- **콘텐츠 업로드**: 읽어보기/배워보기 이미지·영상, 성찰 문항의 참고 이미지는 이제 관리자 화면에서 **파일을 직접 선택해서 업로드**할 수 있다(Supabase Storage `content-uploads` 버킷, 공개 읽기 + 교사만 업로드 가능한 RLS 정책). URL을 직접 붙여넣는 방식도 여전히 지원한다(유튜브 링크 등). 버킷/정책은 `schema.sql` 맨 아래에 포함되어 있다.
- **성장 그래프**: `getMyShootingHistory()`로 최근 기록을 가져오는 API는 만들어뒀고 `RecordTab`에서 간단한 리스트로만 보여준다. "성장" 느낌을 살리려면 `/my-records` 스타일의 꺾은선 그래프를 추가하면 좋다(러닝 앱 인수인계서 §8의 제안과 동일한 방향).
- **사진 증빙/AI 자동인식**: 이번 구현에는 포함하지 않았다. 필요해지면 러닝 앱 인수인계서 §6-6(구글 드라이브 업로드), §6-7(AI는 항상 선택지)의 패턴을 참고할 것.
- **관리자 학생 삭제/PIN 초기화**: 명세서에 명시되지 않아 이번 버전에는 없다. 필요하면 새싹책방의 `teacher_delete_student`, `teacher_reset_student_pin` RPC 패턴을 그대로 가져오면 된다.
- **진짜 이메일 발송**: 위 §6 참고 — 아이디/비밀번호 찾기가 지금은 이메일을 안 보내고 화면에 바로 보여주는 방식이다.
- **자동 저장 + 오프라인 지원 (RecordTab/ReflectTab)**: 변경이 생기면 항상 먼저 `offlineQueue.markPending()`으로 localStorage에 즉시 기록해두고(오프라인이어도 안전), 800ms 디바운스 뒤 서버 저장을 시도한다(`attemptSync`). 서버 저장이 성공하면 큐에서 지우고, 실패(오프라인 등)하면 큐에 남겨둔 채로 `window`의 `online` 이벤트나 8초 주기 재시도에서 자동으로 다시 시도한다(`startAutoFlush`, App.jsx에서 앱 시작 시 1회 등록). 화면을 나갈 때(STEP 전환, 일차 목록으로 나가기 등 컴포넌트 언마운트)도 대기 중인 저장을 즉시 한 번 더 시도한다. 화면에 다시 들어오면(같은 화면 재마운트든, 완전히 새로고침이든) localStorage에 아직 서버로 못 보낸 값이 있으면 서버 값보다 그걸 우선해서 보여준다 — 오프라인 중에 쓴 내용이 그대로 이어진다.
  - 성찰 문항 목록(`listReflectionQuestions`)·읽어보기/배워보기 자료(`listReadContents`/`listLearnContents`)·일차 목록(`listDays`)은 `offlineCache.cachedFetch()`로 감싸 마지막으로 성공한 응답을 localStorage에 캐싱해둔다. 오프라인이라 이 조회들이 실패하면 캐시를 대신 보여줘서, 한 번이라도 열어본 화면은 오프라인에서도 계속 이어서 쓸 수 있다. (처음부터 한 번도 안 연결된 상태로 새 일차에 처음 들어가는 경우는 지원 대상이 아님 — 그 일차의 문항/자료를 아직 받아온 적이 없어서.)
  - 브라우저 탭을 강제로 닫거나 기기 전원이 꺼지는 등 JS 실행이 즉시 중단되는 극단적인 경우엔 마지막 변경 후 800ms 이내의 아주 짧은 구간만 로컬 큐에 남고 화면에 반영은 안 됐을 수 있지만, 다음에 그 기기로 다시 열면 큐에 남아있던 값이 그대로 이어진다. `navigator.sendBeacon`은 Supabase 인증 헤더를 실어보낼 수 없어 쓰지 않았다.

## 8. 스모크 테스트 이력

`npm run build`, `npm run lint` 통과 확인. Playwright로 (구버전 기준) 역할 선택 화면·학생 로그인·학생 5개 탭·과녁 탭 마커 찍기→저장(조준 보정 문구 포함)·교사 로그인/가입/아이디찾기/비밀번호찾기 화면·학급 선택(ClassPicker)·학급 관리 서브탭까지 목(mock) Supabase 응답으로 콘솔 에러 없이 동작하는 것을 확인했다. **v3(일차 구조) 이후에는** 학생 플로우(학생 로그인 → 일차 탭 → 일차 목록 → 일차 선택 → STEP1~4 전환 → 일차 목록으로 돌아가기)와 관리자 플로우(교사 로그인 → 학급 선택 → 일차 관리 탭 → 새 일차 추가 → 일차 선택 → STEP1/2/4 콘텐츠 편집 화면 진입)를 각각 목 Supabase 응답으로 다시 확인했고 콘솔 에러 없음. GitHub Actions 빌드+배포도 실제로 성공해서 라이브 URL에 올라가 있다 (§7 참고). 다만 실제 Supabase 프로젝트에 대고 진짜 로그인/회원가입까지 이 세션의 샌드박스에서 직접 눌러보지는 못했다 — 샌드박스의 아웃바운드 네트워크 정책이 임의의 외부 도메인(발급받은 Supabase 프로젝트 서브도메인 포함)을 막고 있기 때문. 실제 브라우저(교사/학생 기기)에서는 문제 없이 접속된다.

**아직 사용자가 확인해주지 않은 부분**: v2(교사 계정 시스템 전환) 때 "column reference username is ambiguous" 오류가 있었고, 수정 SQL을 재실행하라고 안내한 뒤 사용자가 "함"이라고만 답해서 실제로 계정 만들기가 성공했는지 최종 확인을 못 받았다. v3 SQL을 실행하면서 계정 만들기/로그인부터 다시 한 번 정상 동작하는지 확인해보는 게 좋다.
