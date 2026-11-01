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
    MyRecordsTab.jsx             "내 기록" 탭: classId의 모든 일차를 `<details>`로 접어서 나열(일차가 많아지면 전부 펼쳐진 채로 한없이 길어지던 문제 — 아래 §10 참고). 기본은 제일 최근 일차만 펼쳐져 있고, 접힌 상태에서도 명중 발수·답변 완료 개수가 요약 태그로 보임. 펼치면 성찰 문항+내 답변 표시(읽기 전용, 새 API 없이 기존 per-day 엔드포인트를 일차 수만큼 병렬 호출)
    ReadTab.jsx / LearnTab.jsx    dayId prop 기준으로 콘텐츠 조회 (이전엔 classId 기준)
    TargetFace.jsx               과녁 SVG스러운 원형 탭 UI (실제로는 절대위치 div 레이어), MAX_MARKERS=50. 마커는 pointer-events:none이라 탭해도 지워지지 않음 — 삭제는 RecordTab의 "마지막 취소"/"전체 지우기" 버튼으로만 가능. 명중(빨강·금색, HIT_RADIUS 이내)은 초록 ●, 그 외(과녁엔 맞았지만 비명중)는 흐린 ✕로 표시
    RecordTab.jsx                 기록하기 화면 본체 (dayId prop, 활 번호를 이 화면에서 직접 입력, 장비 등록 개념 없음, 명중 마커 + "빗나간 화살 수" 스테퍼로 총 발수/명중 집계, 탄착군 기반 조준/자세 피드백(aimFeedback.js) 표시, 일차당 1건 업서트). 변경사항이 있으면 800ms 디바운스로 자동 저장하고, 컴포넌트가 언마운트될 때(STEP 전환·일차 목록으로 나가기 등) 저장 대기 중이던 값을 즉시 flush함
    BoxBreathing.jsx              박스 호흡(4-4-4-4) 타이머 위젯
    PostureCheck.jsx              "내 자세 평가해보기" — 배워보기 화면에서 진입. 학생이 옆모습 사진을 찍으면 기기(브라우저) 안에서 MediaPipe Pose Landmarker(@mediapipe/tasks-vision)로 포즈를 추출해 발 간격/뻗은 팔 펴짐/당기는 팔 팔꿈치 높이/상체 기울기/머리 위치 5가지를 체크해서 보여줌. 사진은 서버로 전송·저장되지 않음(완전 클라이언트 사이드). 아래 §9 참고
    ReflectTab.jsx                 dayId prop 기준, 교사 문항 답변만 (일차당 1건 업서트). RecordTab과 같은 방식으로 문항별 답변을 800ms 디바운스 자동 저장 + 언마운트 시 즉시 flush
    AdminTab.jsx                  교사 계정 로그인/가입/찾기(AuthScreen) + 학급 선택(ClassPicker) + 서브탭 셸(학생·기록/일차 관리)
    AdminDayManager.jsx           일차 목록 CRUD → 일차 선택 시 STEP1/2/4 콘텐츠 편집 UI를 감싸서 보여줌. 일차별 "다른 반에 복사" 버튼(교사의 다른 학급 목록 중 골라서 admin_copy_day 호출, 읽어보기/배워보기/성찰 문항까지 통째로 복사). 일차 수정 폼에 구글 Gem 링크 입력란(선택) — 아래 참고. 일차 상세 화면 맨 위 "학생 화면으로 미리보기" 버튼 → DayPreview로 전환(아래 참고)
    DayPreview.jsx                교사가 특정 일차를 학생이 보는 화면 그대로 미리보는 컴포넌트. ReadTab/LearnTab/RecordTab/ReflectTab을 학생 화면과 똑같이 재사용(그래서 자세 평가·Gem 버튼도 자동으로 같이 보임). STEP3/4는 저장 RPC가 로그인한 학생 본인 것만 저장하게 돼 있어 교사 계정으로는 저장이 안 되므로, 그 두 단계에서는 "미리보기라 저장 안 됨" 안내 배너를 보여줌 — 아래 §11 참고
    icons.jsx                     이모지 대신 쓰는 선 아이콘(line icon) 모음. stroke=currentColor라 글자색이 바뀌면 같이 바뀜(러닝 성찰일지 앱 EventBottomNav.tsx 방식 참고). 하단 탭·브랜드 헤더·목록 행 chevron·배워보기 CTA에 사용
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
- **앱 아이콘**: ~~새싹책방 아이콘이 남아있던 문제~~ 해결됨. `public/icon-192.png`/`icon-512.png`를 `favicon.svg`와 똑같은 과녁 색(흰색/검정/파랑/빨강/금색, 과녁면 TargetFace.jsx의 RINGS 색과 동일)으로 새로 그려서 교체했다(PIL로 생성, 사과 터치 아이콘도 `index.html`에서 이미 `icon-192.png`를 쓰고 있어 자동으로 같이 바뀜).
- **콘텐츠 업로드**: 읽어보기/배워보기 이미지·영상, 성찰 문항의 참고 이미지는 이제 관리자 화면에서 **파일을 직접 선택해서 업로드**할 수 있다(Supabase Storage `content-uploads` 버킷, 공개 읽기 + 교사만 업로드 가능한 RLS 정책). URL을 직접 붙여넣는 방식도 여전히 지원한다(유튜브 링크 등). 버킷/정책은 `schema.sql` 맨 아래에 포함되어 있다.
- **성장 그래프**: `getMyShootingHistory()`로 최근 기록을 가져오는 API는 만들어뒀고 `RecordTab`에서 간단한 리스트로만 보여준다. "성장" 느낌을 살리려면 `/my-records` 스타일의 꺾은선 그래프를 추가하면 좋다(러닝 앱 인수인계서 §8의 제안과 동일한 방향).
- **사진 증빙/AI 자동인식**: 이번 구현에는 포함하지 않았다. 필요해지면 러닝 앱 인수인계서 §6-6(구글 드라이브 업로드), §6-7(AI는 항상 선택지)의 패턴을 참고할 것.
- **관리자 학생 삭제/PIN 초기화**: 명세서에 명시되지 않아 이번 버전에는 없다. 필요하면 새싹책방의 `teacher_delete_student`, `teacher_reset_student_pin` RPC 패턴을 그대로 가져오면 된다.
- **진짜 이메일 발송**: 위 §6 참고 — 아이디/비밀번호 찾기가 지금은 이메일을 안 보내고 화면에 바로 보여주는 방식이다.
- **자동 저장 + 오프라인 지원 (RecordTab/ReflectTab)**: 변경이 생기면 항상 먼저 `offlineQueue.markPending()`으로 localStorage에 즉시 기록해두고(오프라인이어도 안전), 800ms 디바운스 뒤 서버 저장을 시도한다(`attemptSync`). 서버 저장이 성공하면 큐에서 지우고, 실패(오프라인 등)하면 큐에 남겨둔 채로 `window`의 `online` 이벤트나 8초 주기 재시도에서 자동으로 다시 시도한다(`startAutoFlush`, App.jsx에서 앱 시작 시 1회 등록). 화면을 나갈 때(STEP 전환, 일차 목록으로 나가기 등 컴포넌트 언마운트)도 대기 중인 저장을 즉시 한 번 더 시도한다. 화면에 다시 들어오면(같은 화면 재마운트든, 완전히 새로고침이든) localStorage에 아직 서버로 못 보낸 값이 있으면 서버 값보다 그걸 우선해서 보여준다 — 오프라인 중에 쓴 내용이 그대로 이어진다.
  - 성찰 문항 목록(`listReflectionQuestions`)·읽어보기/배워보기 자료(`listReadContents`/`listLearnContents`)·일차 목록(`listDays`)은 `offlineCache.cachedFetch()`로 감싸 마지막으로 성공한 응답을 localStorage에 캐싱해둔다. 오프라인이라 이 조회들이 실패하면 캐시를 대신 보여줘서, 한 번이라도 열어본 화면은 오프라인에서도 계속 이어서 쓸 수 있다. (처음부터 한 번도 안 연결된 상태로 새 일차에 처음 들어가는 경우는 지원 대상이 아님 — 그 일차의 문항/자료를 아직 받아온 적이 없어서.)
  - 브라우저 탭을 강제로 닫거나 기기 전원이 꺼지는 등 JS 실행이 즉시 중단되는 극단적인 경우엔 마지막 변경 후 800ms 이내의 아주 짧은 구간만 로컬 큐에 남고 화면에 반영은 안 됐을 수 있지만, 다음에 그 기기로 다시 열면 큐에 남아있던 값이 그대로 이어진다. `navigator.sendBeacon`은 Supabase 인증 헤더를 실어보낼 수 없어 쓰지 않았다.
- **일차별 구글 Gem 링크 (배워보기)**: `days` 테이블에 `gem_url text` (nullable) 컬럼을 추가했다. 교사가 일차 관리 → 해당 일차 "수정"에서 입력/수정하면(`admin_update_day`에 `p_gem_url` 파라미터 추가, `admin_create_day`도 동일) 학생 화면의 STEP 2 배워보기 상단에 "✨ AI 코치와 대화하기" 버튼이 새 탭으로 뜬다(`LearnTab`이 `gemUrl` prop을 받아 비어있으면 버튼 자체를 숨김). `admin_copy_day`로 다른 반에 일차를 복사할 때도 Gem 링크가 함께 복사된다. Gem 링크 자체는 임베드되는 게 아니라 Gemini 앱으로 새 탭 이동하는 외부 링크일 뿐이다(Gem은 API/임베드를 공식 지원하지 않음).

## 8. 스모크 테스트 이력

`npm run build`, `npm run lint` 통과 확인. Playwright로 (구버전 기준) 역할 선택 화면·학생 로그인·학생 5개 탭·과녁 탭 마커 찍기→저장(조준 보정 문구 포함)·교사 로그인/가입/아이디찾기/비밀번호찾기 화면·학급 선택(ClassPicker)·학급 관리 서브탭까지 목(mock) Supabase 응답으로 콘솔 에러 없이 동작하는 것을 확인했다. **v3(일차 구조) 이후에는** 학생 플로우(학생 로그인 → 일차 탭 → 일차 목록 → 일차 선택 → STEP1~4 전환 → 일차 목록으로 돌아가기)와 관리자 플로우(교사 로그인 → 학급 선택 → 일차 관리 탭 → 새 일차 추가 → 일차 선택 → STEP1/2/4 콘텐츠 편집 화면 진입)를 각각 목 Supabase 응답으로 다시 확인했고 콘솔 에러 없음. GitHub Actions 빌드+배포도 실제로 성공해서 라이브 URL에 올라가 있다 (§7 참고). 다만 실제 Supabase 프로젝트에 대고 진짜 로그인/회원가입까지 이 세션의 샌드박스에서 직접 눌러보지는 못했다 — 샌드박스의 아웃바운드 네트워크 정책이 임의의 외부 도메인(발급받은 Supabase 프로젝트 서브도메인 포함)을 막고 있기 때문. 실제 브라우저(교사/학생 기기)에서는 문제 없이 접속된다.

**아직 사용자가 확인해주지 않은 부분**: v2(교사 계정 시스템 전환) 때 "column reference username is ambiguous" 오류가 있었고, 수정 SQL을 재실행하라고 안내한 뒤 사용자가 "함"이라고만 답해서 실제로 계정 만들기가 성공했는지 최종 확인을 못 받았다. v3 SQL을 실행하면서 계정 만들기/로그인부터 다시 한 번 정상 동작하는지 확인해보는 게 좋다.

## 9. 자체 자세 평가 도구 (`PostureCheck.jsx` / `postureAngles.js` / `poseModel.js`)

교사가 외부 AI(구글 Gem)에 의존하지 않고 자체적으로 자세를 점검할 수 있게 해달라고 해서, Google의 **MediaPipe Pose Landmarker**(`@mediapipe/tasks-vision`)를 학생 브라우저 안에서 직접 돌리는 방식으로 구현했다. 서버/DB 변경 없음 — 전부 클라이언트 사이드.

- **플로우(실시간 카메라, 기본)**: 학생이 배워보기(STEP 2)에서 "📸 내 자세 평가해보기" → 기본은 "실시간 카메라" 모드. `getUserMedia()`로 카메라를 켜고(기본 후면 카메라, "카메라 전환" 버튼으로 전/후면 전환) `poseModel.js`의 `loadPoseLandmarkerForVideo()`(`runningMode: 'VIDEO'`)로 `PoseLandmarker`를 1회 생성 → `requestAnimationFrame` 루프에서 매 프레임 `detectForVideo()`로 포즈를 뽑아 캔버스에 영상+스켈레톤(선+점)을 그리고, 체크리스트는 300ms마다(매 프레임 state를 갱신하면 너무 자주 리렌더돼서) `postureAngles.js`의 `evaluatePosture()`로 갱신. 화면을 나가거나 "카메라 끄기"를 누르면 `MediaStream`의 모든 트랙을 `stop()`해서 카메라를 확실히 끈다.
- **플로우(사진 한 장, 대체 수단)**: "사진으로 하기" 탭으로 전환하면 기존 방식 그대로 — 사진을 찍거나 고르면(`<input type="file" accept="image/*" capture="environment">`) `poseModel.js`의 `loadPoseLandmarker()`(`runningMode: 'IMAGE'`)로 한 장만 분석. `getUserMedia`를 아예 못 쓰는 브라우저(구형 웹뷰 등)에서는 처음부터 이 모드로 시작한다(`navigator.mediaDevices?.getUserMedia` 존재 여부로 판단). 카메라 권한이 막혀 있거나(`NotAllowedError`) 카메라가 없는 기기(`NotFoundError`)에서도 이 모드로 전환하라고 안내한다.
- **두 모드 모두** 분석 자체는 `postureAngles.js`의 `evaluatePosture()`(5개 항목, 아래)를 그대로 공유하고, `PostureCheck.jsx`가 사진/영상 프레임 위에 스켈레톤을 그려 보여준 뒤 항목별 피드백 문구를 나열하는 것도 동일하다.
- **왜 "측면" 사진인가**: 정면/뒤 사진은 좌우 대칭(어깨 수평 등)을 보기엔 좋지만 팔꿈치가 굽었는지·몸이 앞뒤로 기울었는지는 옆에서 봐야 더 잘 보인다. 그래서 체크 5개도 전부 옆모습에서 실제로 측정 가능한 것들로 구성했다(스탠스 폭처럼 옆모습에서 안 보이는 축은 애초에 체크 항목에서 뺐다):
  1. 발 간격(스탠스) — 두 발목의 가로 거리(= 옆모습 기준 앞뒤 벌어짐)를 상체 길이로 정규화
  2. 앞으로 뻗은 팔(활 든 팔) 펴짐 — 어깨-팔꿈치-손목 각도. 두 팔 중 더 곧게 펴진 쪽을 자동으로 "뻗은 팔"로 판단(손잡이를 어느 손으로 잡는지 입력받지 않음)
  3. 당기는 팔(나머지 한 팔) 팔꿈치 높이 — 팔꿈치 y좌표와 어깨 y좌표 차이
  4. 상체 기울기 — 어깨-엉덩이 선이 수직에서 벗어난 각도
  5. 머리/목 위치 — 귀(또는 코) x좌표가 어깨보다 얼마나 앞으로 나왔는지
  - 모든 거리 기준값(threshold)은 실제 코칭 데이터로 캘리브레이션한 게 아니라 상식적인 범위로 잡은 **참고용 추정치**다. 화면에도 "참고용, 정확한 코칭을 대신하지 않음"이라고 명시해뒀다. 교사가 써보고 기준이 너무 엄격/느슨하면 `postureAngles.js`의 숫자(0.5, 160/140, 0.12/0.25, 10/20, 0.15/0.3)만 조정하면 된다.
  - 한쪽 팔·발·몸통이 사진에 잘 안 보이면(MediaPipe visibility < 0.5) 해당 항목은 good/warn/bad 대신 "skip"으로 표시하고 이유를 알려준다(억지로 틀린 판정을 내지 않음).
- **개인정보**: 사진은 Supabase에 업로드되지 않고, `URL.createObjectURL`로 그 기기 메모리에서만 처리 후 즉시 해제(`revokeObjectURL`)한다. 분석 결과(체크리스트)도 저장하지 않음 — 매번 그 자리에서만 보여주고 끝. (나중에 "내 기록"에 이력으로 남기고 싶다고 하면 별도 테이블+RLS를 추가하면 됨.)
- **네트워크 의존성**: 처음 쓸 때 jsdelivr(wasm 런타임, ~백몇십KB)와 storage.googleapis.com(포즈 모델 파일)에서 내려받는다. 이후엔 브라우저가 캐싱하지만, 학교 와이파이가 해당 도메인을 막아두면 "카메라를 불러오지 못했어요"/"분석 도구를 불러오지 못했어요" 에러가 뜬다 — 그럴 땐 다른 네트워크(핫스팟 등)로 한 번 열어서 캐싱해두면 그 다음부터는 괜찮을 가능성이 높다.
- **카카오톡 등 인앱 브라우저 주의**: 실시간 카메라(`getUserMedia`)는 인앱 브라우저에서 권한 자체가 막혀 있거나 불안정한 경우가 있다. 그래서 "사진으로 하기"를 완전히 없애지 않고 대체 수단으로 남겨뒀다 — 카메라가 안 되면 사진 모드로 전환하라고 화면에 안내한다.
- **테스트 한계**: 이 세션의 샌드박스는 jsdelivr/storage.googleapis.com 같은 임의 외부 도메인 접근이 막혀 있어서, 실제 MediaPipe 모델을 불러와 진짜로 분석하는 전체 플로우(사진이든 실시간 카메라든)는 샌드박스에서 끝까지 돌려보지 못했다. 대신 (1) Playwright를 `--use-fake-device-for-media-stream` 플래그로 띄워 카메라 권한 허용 → "카메라 시작하기" → 모델 로딩 실패(샌드박스 네트워크 차단으로 예상된 실패) → 에러 메시지로 깔끔하게 전환 → "사진으로 하기"로 전환까지 되는 것을 확인했고(카메라가 중간에 꺼지지 않고 멈추지 않음), (2) `postureAngles.js`의 판정 로직은 합성(가짜) 랜드마크 좌표로 좋은 자세/나쁜 자세/몸통 안 보임/미검출 케이스를 각각 직접 돌려서 의도대로 good/warn/bad/skip이 나오는 것을 확인했다. 실제 카메라로 모델이 제대로 랜드마크를 뽑아내는지, 저사양 기기에서 실시간 프레임 처리가 버벅이지 않는지는 실제 배포 후 학생 기기에서 확인이 필요하다.
- **관리자 화면에서 미리보기**: §11의 `DayPreview`로 일차 전체를 미리보는 기능 안에 포함됨 — STEP 2 배워보기를 미리볼 때 자세 평가 도구도 자연스럽게 같이 보인다.

## 11. 교사용 일차 미리보기 (`DayPreview.jsx`)

"선생님 화면에서 일차 미리보기 가능하게" 요청으로 추가했다. `AdminDayManager`에서 일차를 선택하면 상단에 "👁 학생 화면으로 미리보기" 버튼이 있고, 누르면 `DayPreview`로 전환된다.

- **구현 방식**: 학생용 `DayView.jsx`와 똑같은 STEP1~4 pill 네비게이션을 그대로 복제하되, `ReadTab`/`LearnTab`/`RecordTab`/`ReflectTab`을 새로 만들지 않고 **그대로 재사용**한다. 별도의 "미리보기 전용 컴포넌트"를 안 만든 이유: 읽어보기·배워보기는 애초에 로그인 사용자를 구분하지 않는 순수 조회(`listReadContents`/`listLearnContents`가 `visible=true`만 보는 공개 select)라서 교사 계정으로 열어도 학생과 완전히 똑같이 동작한다.
- **기록하기·성찰하기는 "보기"는 되지만 "저장"은 안 됨**: `get_my_shooting_log`/`get_my_reflection_answers`는 로그인한 사람 기준으로 조회하는데, 교사의 auth 계정은 `students` 테이블에 없어서 그냥 빈 결과가 온다(에러 아님 — 화면은 빈 과녁/빈 답변칸으로 정상적으로 뜸). 반대로 `save_shooting_log`/`save_reflection`/`save_reflection_answer`는 "로그인한 사람에 대응하는 학생 행이 없으면" `raise exception '로그인 정보를 찾을 수 없어요'`로 명시적으로 막아뒀다 — 즉 교사가 저장을 눌러도 서버에 반영되지 않는다(의도된 동작, 학생 데이터에 교사 계정으로 잘못된 행이 들어가는 걸 막기 위한 안전장치). 다만 RecordTab/ReflectTab은 원래 오프라인 대비용으로 저장 실패를 "지금 오프라인이에요, 나중에 자동 재시도할게요" 식으로 조용히 처리하도록 짜여 있어서, 이 실패가 "권한 없음"인지 "진짜 오프라인"인지 화면만 봐서는 구분이 안 된다. 그래서 `DayPreview`가 STEP3/4에 들어가면 미리 "여기서 저장해도 실제로는 저장 안 됨" 배너를 보여줘서 교사가 헷갈리지 않게 했다.
- **DB/스키마 변경 없음** — 전부 기존 컴포넌트·RPC 재사용.

## 10. UI 다듬기 — 러닝 성찰일지 앱 참고

사용자가 같은 세션에서 만든 다른 프로젝트 `minable17-glitch/running-journal`(Next.js + Tailwind v4)을 디자인 참고용으로 보여달라고 해서, 그 앱의 `globals.css`·`EventBottomNav.tsx` 등을 읽고 **포팅 가능한 부분만** 가져왔다(이 앱은 Vite + 순수 CSS라 프레임워크를 바꾸진 않음):

- **이모지 → 선 아이콘(line icon)**: 러닝 앱이 하단 탭에서 이모지 대신 `stroke="currentColor"` SVG를 쓰는 이유(기기마다 이모지 그림이 달라 나란히 두면 지저분해 보임)를 그대로 따와서 `src/components/icons.jsx`를 만들었다(TargetIcon/ChartIcon/CameraIcon/BreathIcon/SparkleIcon/TrophyIcon/BookIcon/ChevronIcon). 적용한 곳: 하단 탭(일차/내 기록), 모든 화면의 "🎯 LEVEL-UP ARCHERY"/"🎯 관리자" 등 브랜드 헤더(`.brand-row` 클래스), 배워보기의 CTA 버튼들. **적용 안 한 곳**(일부러 남김, 러닝 앱도 전부 다 바꾸진 않았음): `PostureCheck.jsx`의 ✅⚠️❗ 상태 표시, `AdminRecords.jsx`의 🏆·🥇🥈🥉 랭킹 — 정보 전달용 글자라 위험 대비 이득이 적어서 남겨둠.
- **카드/목록 다듬기**: `index.css`에 `--shadow-sm`/`--shadow-md` 토큰을 추가해 `.card`/`.content-card`/`.btn-primary`/`.btn-accent`에 은은한 그림자를 줬다(기존엔 그림자가 아예 없었음). `.content-card`에 `>`(ChevronIcon) 붙여서 "누르면 들어가는 행"이라는 걸 더 분명하게 했다(DayList/ReadTab/LearnTab/AdminTab 클래스 목록에 적용).
- **CTA 카드**: `.cta-card` 클래스(그라데이션 배경 + 아이콘 뱃지 + 제목/부제)를 새로 만들어서, 배워보기 화면에서 가장 중요한 기능인 "내 자세 평가해보기"를 다른 버튼들보다 시각적으로 도드라지게 했다(러닝 앱이 "나의 성장 리포트" 카드 하나만 그라데이션으로 강조하고 나머지는 평범한 버튼으로 두는 "화면당 하나의 강조"를 참고).
- **스코프**: "전체적으로" 라고 하셨지만, 시간상 학생이 가장 자주 보는 화면(역할선택·로그인·일차목록·배워보기)과 교사 쪽 학급목록 화면 위주로 적용했다. RecordTab/ReflectTab/AdminRecords/AdminStudentDetail 등 나머지 화면은 아직 손대지 않았다 — 더 해달라고 하면 같은 패턴(그림자 토큰 + 아이콘 + chevron)으로 이어서 적용하면 된다.

**2차 — 토스(Toss) 스타일 참고, 이번엔 진짜 전체 적용.** 사용자가 "시중 앱 중 참고해달라"고 해서, 한국 앱 UI의 대표격인 토스 스타일(테두리보다 그림자로 뜬 느낌, 넉넉한 여백·둥근 모서리, 입력칸은 테두리 대신 옅은 회색 채움)을 참고했다. 이번엔 컴포넌트 파일을 하나씩 고치는 대신 `index.css`의 **공용 토큰/클래스만** 바꿔서, 그 클래스를 쓰는 모든 화면에 한 번에 적용되게 했다(그래서 1차 때 "아직 손 안 댐"이라고 적어둔 RecordTab/ReflectTab/AdminRecords도 전부 자동으로 같이 바뀜):
- `--radius-card` 16→20px, `--radius-sm` 10→12px(더 둥글게), `--shadow-md` 조금 더 뚜렷하게
- `.card`/`.content-card` 테두리를 진한 `--border-color` 대신 아주 옅은 `--border-soft`(rgba, 6% 불투명도)로 — 그림자가 경계를 대신 지게 함
- `.field input/textarea/select`: 흰 배경+테두리 → **옅은 회색 채움(`--surface-alt`) + 테두리 없음**, `:focus`일 때만 `--primary` 색 테두리가 생기고 배경이 흰색으로 바뀜(포커스 상태 표시는 꼭 필요해서 추가함 — 이전엔 브라우저 기본 파란 아웃라인이라 남색 톤이랑 안 어울렸음)
- `.btn-primary`/`.btn-accent`의 그림자를 뺐다(버튼은 색+굵은 글씨로만 눌리는 느낌을 주는 토스 스타일; 그림자는 카드처럼 "떠 있는 면"에만 남김). `.btn-outline`도 테두리를 빼고 옅은 회색 채움으로 바꿈(역할선택 화면의 "선생님으로 로그인" 등)
- `.pill`(STEP 네비게이션 등)도 흰 배경+테두리 → 옅은 회색 채움으로
- 하단 탭(`.bottom-nav`)의 위쪽 테두리 선을 없애고 위로 뜨는 은은한 그림자로 교체
- 결과적으로 로그인 폼·기록하기·성찰하기·관리자 학생기록 화면까지 전부 자동으로 "흰 카드가 크림색 배경 위에 둥실 떠 있고, 입력칸은 연한 회색 알약 모양" 톤으로 통일됨. Playwright로 로그인 폼/기록하기/성찰하기/관리자 랭킹 화면을 스크린샷 찍어서 눈으로 확인함.

**3차 — 화면 레이아웃(정보 밀도) 효율화, 파라런 "일차 드롭다운" 패턴 참고.** 색/그림자 같은 스타일이 아니라 **구조** 쪽 참고 요청이라, 러닝 앱의 `HomeDayList.tsx`를 다시 읽었다. 거기엔 "2026-10-11 선생님 '위아래로 너무 길다 → 드롭다운으로'" 라는 코멘트와 함께, 성찰일지 일차 목록을 `<details>/<summary>`로 접어둔 코드가 있었다 — 일차가 쌓일수록 화면이 한없이 길어지는 문제를 그렇게 해결한 것.
- 이 앱에서 똑같은 문제가 있는 화면은 `MyRecordsTab.jsx`("내 기록")였다 — 예전엔 일차마다 카드 하나씩, 그 안에 성찰 문항+내 답변이 전부 펼쳐진 채로 쌓여서, 학기가 지날수록(일차가 많아질수록) 스크롤이 끝없이 길어지는 구조였다. `DayList.jsx`(일차 탭, 목록을 눌러서 **들어가는** 용도)는 애초에 다른 문제라 그대로 뒀다 — 각 항목을 펼칠 이유가 없고 한 줄짜리라 길어져도 평범한 목록 스크롤이라 괜찮음.
- `MyRecordsTab.jsx`를 일차마다 `<details className="journal-day">`로 바꿨다. 접힌 상태(summary)에선 일차 제목 + 요약 태그만 보인다(명중 "5/6발", 성찰 "답변 1/1"처럼 접힌 채로도 한눈에 상태를 알 수 있게 — 파라런 리포트 카드의 "✅ 제출 완료/✏️ 쓰는 중" 미리보기와 같은 생각). 기본으로는 **가장 최근 일차 하나만 펼쳐진 채** 시작하고(`days` 배열의 마지막 항목), 나머지는 접혀 있다가 눌러야 펼쳐진다. 여러 개를 동시에 펼쳐둘 수도 있다(네이티브 `<details>`라 서로 독립적).
- CSS: `.journal-day`/`.journal-day summary`/`.journal-day-title`/`.journal-day-meta`/`.journal-day-chevron`/`.journal-day-body`를 `index.css`에 새로 추가. 기본 삼각형 마커는 `list-style:none` + `::-webkit-details-marker{display:none}`로 숨기고, 대신 `ChevronIcon`을 펼침 상태에 따라 90도 회전시킨다.

**4차 — 일차 상세 화면들의 중복된 "뒤로가기" 줄 줄이기.** 사용자가 관리자 화면(일차 관리 → 일차 선택) 스크린샷을 보여주며 "이것도 효율적으로" 라고 해서 보니, `← 일차 목록`(단독 줄) → 제목만 담은 카드 → `미리보기` 버튼(전체 너비) → STEP pill 순으로 **같은 내용을 두 번 세 번 나눠서** 쌓고 있었다 — "콘텐츠 추가" 폼에 닿기 전에 화면을 한참 내려야 했다. 똑같은 구조(뒤로가기 버튼 한 줄 + 제목만 담은 카드 한 줄)가 쓰인 5곳을 전부 "뒤로가기 화살표 + 제목(+필요하면 보조 버튼)"을 **한 줄짜리 카드**로 합쳤다:
- `DayView.jsx`(학생, 일차 상세) · `AdminDayManager.jsx`(교사, 일차 상세 — 제목 옆에 "👁 미리보기" 버튼도 같은 줄로) · `DayPreview.jsx`(교사, 미리보기 화면) · `AdminStudentDetail.jsx`(교사, 학생 상세) · `AdminTab.jsx`(학급 선택 후 "← 학급 목록" + 학생·기록/일차관리 pill을 한 줄로)
- 뒤로가기 버튼은 글자(`← 일차 목록`) 대신 화살표 아이콘만(`←`, `aria-label`로 스크린리더 텍스트는 유지) 쓰고, 제목은 `text-overflow: ellipsis`로 길면 "..." 처리. 화면마다 한 줄씩 줄어서, 교사용 "일차 상세 → 콘텐츠 추가" 화면은 스크롤 없이 바로 폼이 보일 정도로 짧아졌다(Playwright 스크린샷으로 전/후 비교 확인).

## 11. Figma 디자인 파일 (일부만 완료)

"UI 개선 figma 활용하자" 요청으로 새 Figma 파일을 만들어서 앱의 색상 토큰(`index.css`와 동일)·버튼 컴포넌트(Primary/Accent/Outline)·"역할 선택" 화면 하나까지 재현해뒀다. 파일: https://www.figma.com/design/GUkZLC3Qkuz13ZHGn5jXb1 — 사용자 Figma 계정이 **Starter 플랜이라 MCP 호출 한도**가 있어서, 그 한도에 걸려 일차 목록·배워보기 등 나머지 화면은 아직 못 만들었다. 사용자가 "지금까지만 해달라"고 해서 여기서 멈췄다. 나중에 이어서 하려면: 플랜 업그레이드 또는 한도 초기화를 기다린 뒤, 같은 파일(`fileKey: GUkZLC3Qkuz13ZHGn5jXb1`)에 이어서 화면을 더 만들면 된다(색상 변수·버튼 컴포넌트는 이미 있으니 재사용).

## 12. 교사용 MCP 서버 (`mcp-server/`)

"mcp 만들어줘" 요청으로, 교사가 Claude(Claude Code/Desktop)에서 양궁 앱 데이터를 직접 물어볼 수 있는 **읽기 전용** 로컬 MCP 서버를 추가했다. Node.js(`@modelcontextprotocol/sdk`) + `@supabase/supabase-js`로 Supabase 테이블을 직접 조회한다(RLS를 우회하는 **service_role 키** 사용 — 교사 본인 컴퓨터에서만 돌리는 신뢰된 로컬 도구라는 전제. 앱 자체의 학생/교사 익명 인증 흐름과는 무관).

- 도구 6개: `list_classes`/`list_students`/`list_days`/`get_shooting_logs`/`get_reflection_answers`/`get_class_summary`(학급 전체 집계 — 총 명중률, 학생별 랭킹 TOP 20). 쓰기/삭제 도구는 의도적으로 없음(실수 방지, 수정은 앱 관리자 화면에서).
- 설치·연결 방법은 `mcp-server/README.md`에 자세히 적어뒀다(Claude Code `claude mcp add`, Claude Desktop 설정 JSON 둘 다 안내). `service_role` 키를 Supabase 대시보드에서 직접 발급받아 `.env`에 넣어야 하는데, 이 키는 모든 보안 검사를 건너뛰므로 README에 강조 경고를 남겨뒀다.
- `shooting_logs`/`reflections`/`reflection_answers` 테이블이 이미 `class_name`/`student_name`/`day_title`을 같이 저장해두고 있어서(비정규화), 복잡한 조인 없이 바로 쓸만한 결과가 나온다. 성찰 답변만 `reflection_questions`와 PostgREST 임베드(`reflection_questions(question_text)`)로 질문 내용을 같이 가져온다.
- **테스트 한계**: 이 세션 샌드박스는 Supabase 서브도메인 접근이 막혀 있어서(기존에도 반복된 제약) 실제 데이터 조회까지는 확인 못 했다. 대신 (1) 서버가 MCP 핸드셰이크에 정상 응답하고 도구 6개가 올바른 스키마로 등록되는 것, (2) 네트워크 실패 시 서버가 죽지 않고 `isError: true`로 에러를 깔끔하게 돌려주는 것(Supabase 키가 틀렸거나 네트워크가 막혔을 때도 서버 자체는 안정적으로 동작)을 Node 스크립트로 직접 stdio 핸드셰이크를 주고받아 확인했다. 실제 `service_role` 키로 진짜 데이터가 잘 나오는지는 사용자 컴퓨터에서 연결해본 뒤 확인이 필요하다.
