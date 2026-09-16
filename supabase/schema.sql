-- LEVEL-UP ARCHERY (양궁 성장일지) 데이터베이스 스키마
-- Supabase SQL Editor에서 그대로 실행하면 됩니다.
--
-- v3: "일차(day)" 구조 도입. 학급 안에 여러 "일차"를 만들고, 읽어보기/배워보기/
-- 성찰 문항과 학생의 슈팅 기록/성찰 기록을 전부 특정 일차에 연결한다(러닝
-- 성찰일지 앱의 classes → days → day_questions/records 구조를 그대로 따름).
-- 이 버전은 read_contents/learn_contents/reflection_questions/shooting_logs/
-- reflections/reflection_answers 테이블을 통째로 새로 만든다(DROP 후 재생성).
-- 아직 실제 콘텐츠·기록 데이터가 쌓이기 전이라 안전하게 할 수 있는 선택이었음
-- (teachers/classes/students/equipment는 그대로 유지됨).
--
-- 사전 준비: Supabase 대시보드 → Authentication → Sign In / Providers 에서
-- "Anonymous Sign-Ins"를 켜주세요. 학생은 학번+이름+PIN, 교사는 아이디+비밀번호로
-- 로그인하며, 둘 다 내부적으로 익명 인증 세션을 사용한다.
--
-- 설계: RLS를 켜두되 직접 테이블 접근은 기본적으로 막고, 모든 읽기/쓰기를
-- SECURITY DEFINER RPC 함수를 통해서만 한다. 예외: 콘텐츠 조회(읽어보기/배워보기/
-- 성찰문항/일차 목록)는 민감하지 않아 anon에게 직접 select를 허용한다.

create extension if not exists pgcrypto;

-- ── 콘텐츠·기록 테이블은 구조가 바뀌어서 통째로 새로 만듦 ──────────
drop table if exists reflection_answers cascade;
drop table if exists reflections cascade;
drop table if exists shooting_logs cascade;
drop table if exists reflection_questions cascade;
drop table if exists learn_contents cascade;
drop table if exists read_contents cascade;

-- ── 테이블: 교사/학급/학생/장비 (이전과 동일) ──────────────────

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  email text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table classes drop column if exists admin_pin_hash;
alter table classes add column if not exists teacher_id uuid references teachers(id) on delete cascade;
create index if not exists idx_classes_teacher on classes(teacher_id);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_number text not null,
  name text not null,
  pin_hash text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  unique (class_id, student_number, name)
);

create table if not exists equipment (
  student_id uuid primary key references students(id) on delete cascade,
  bow_number text,
  lane_info text,
  sight_vertical text,
  sight_horizontal text,
  sight_note text,
  updated_at timestamptz not null default now()
);

-- ── 일차 ──────────────────────────────────────────────────

create table if not exists days (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  order_index int not null default 0,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_days_class on days(class_id, order_index);

-- ── 일차별 콘텐츠 ────────────────────────────────────────

create table read_contents (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  title text not null,
  category text,
  image_urls text,
  order_index int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table learn_contents (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  title text not null,
  category text,
  video_url text,
  image_urls text,
  description text,
  order_index int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table reflection_questions (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  question_text text not null,
  activity_sheet_url text,
  order_index int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_read_contents_day on read_contents(day_id, order_index);
create index if not exists idx_learn_contents_day on learn_contents(day_id, order_index);
create index if not exists idx_reflection_questions_day on reflection_questions(day_id, order_index);

-- ── 학생의 일차별 기록 ────────────────────────────────────

create table shooting_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  class_name text,
  student_name text,
  student_number text,
  day_title text,
  bow_number text,
  markers jsonb not null default '[]'::jsonb,
  hit_count int not null default 0,
  group_center_x numeric,
  group_center_y numeric,
  aim_advice text,
  sight_before text,
  sight_after text,
  created_at timestamptz not null default now(),
  unique (student_id, day_id)
);

create table reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  class_name text,
  student_name text,
  student_number text,
  day_title text,
  used_skills text[] not null default '{}',
  short_note text,
  created_at timestamptz not null default now(),
  unique (student_id, day_id)
);

create table reflection_answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  day_id uuid not null references days(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  question_id uuid not null references reflection_questions(id) on delete cascade,
  class_name text,
  student_name text,
  student_number text,
  answer_text text,
  created_at timestamptz not null default now(),
  unique (student_id, question_id)
);

alter table shooting_logs add column if not exists miss_count int not null default 0;

create index if not exists idx_students_class on students(class_id);
create index if not exists idx_shooting_logs_class on shooting_logs(class_id, created_at desc);
create index if not exists idx_reflections_class on reflections(class_id, created_at desc);
create index if not exists idx_reflection_answers_class on reflection_answers(class_id, created_at desc);

-- ── RLS: 기본적으로 전부 잠그고, 일차·콘텐츠 조회만 anon에게 허용 ──

alter table teachers enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table equipment enable row level security;
alter table days enable row level security;
alter table read_contents enable row level security;
alter table learn_contents enable row level security;
alter table reflection_questions enable row level security;
alter table shooting_logs enable row level security;
alter table reflections enable row level security;
alter table reflection_answers enable row level security;

drop policy if exists days_select_all on days;
create policy days_select_all on days for select using (true);
grant select on days to anon, authenticated;

drop policy if exists read_contents_select_visible on read_contents;
create policy read_contents_select_visible on read_contents for select using (visible = true);
grant select on read_contents to anon, authenticated;

drop policy if exists learn_contents_select_visible on learn_contents;
create policy learn_contents_select_visible on learn_contents for select using (visible = true);
grant select on learn_contents to anon, authenticated;

drop policy if exists reflection_questions_select_visible on reflection_questions;
create policy reflection_questions_select_visible on reflection_questions for select using (visible = true);
grant select on reflection_questions to anon, authenticated;

-- ── 이전 버전 함수 정리 (시그니처가 바뀐 것들) ──────────────

drop function if exists assert_admin(uuid, text);
drop function if exists create_class(text, text);
drop function if exists teacher_login(text, text);
drop function if exists admin_list_read_contents(uuid, text);
drop function if exists admin_list_read_contents(uuid);
drop function if exists admin_upsert_read_content(uuid, text, uuid, text, text, text, int, boolean);
drop function if exists admin_upsert_read_content(uuid, uuid, text, text, text, int, boolean);
drop function if exists admin_delete_read_content(uuid, text, uuid);
drop function if exists admin_delete_read_content(uuid, uuid);
drop function if exists admin_list_learn_contents(uuid, text);
drop function if exists admin_list_learn_contents(uuid);
drop function if exists admin_upsert_learn_content(uuid, text, uuid, text, text, text, text, text, int, boolean);
drop function if exists admin_upsert_learn_content(uuid, uuid, text, text, text, text, text, int, boolean);
drop function if exists admin_delete_learn_content(uuid, text, uuid);
drop function if exists admin_delete_learn_content(uuid, uuid);
drop function if exists admin_list_students(uuid, text);
drop function if exists admin_list_shooting_logs(uuid, text, int);
drop function if exists admin_list_shooting_logs(uuid, int);
drop function if exists admin_list_reflections(uuid, text, int);
drop function if exists admin_list_reflections(uuid, int);
drop function if exists admin_list_reflection_questions(uuid);
drop function if exists admin_upsert_reflection_question(uuid, uuid, text, text, int, boolean);
drop function if exists admin_delete_reflection_question(uuid, uuid);
drop function if exists admin_list_reflection_answers(uuid, int);
drop function if exists save_reflection(date, text[], text, text, text, text);
drop function if exists save_reflection(date, text[], text);
drop function if exists get_my_reflection(date);
drop function if exists save_reflection_answer(uuid, date, text);
drop function if exists get_my_reflection_answers(date);
drop function if exists save_shooting_log(date, text, text, jsonb, int, numeric, numeric, text, text, text);
drop function if exists get_my_shooting_log(date);
drop function if exists get_my_shooting_log(uuid);
drop function if exists get_my_shooting_history(int);

-- ── 교사 계정: 가입 / 로그인 / 아이디 찾기 / 비밀번호 재설정 ──────

create or replace function teacher_signup(p_username text, p_password text, p_email text)
returns table(id uuid, username text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row teachers%rowtype;
begin
  if coalesce(trim(p_username), '') = '' then
    raise exception '아이디를 입력해주세요';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상으로 입력해주세요';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception '이메일을 입력해주세요 (아이디·비밀번호 찾기에 필요해요)';
  end if;
  if exists (select 1 from teachers where teachers.username = trim(p_username)) then
    raise exception '이미 사용 중인 아이디예요';
  end if;
  insert into teachers (username, password_hash, email, auth_user_id)
  values (trim(p_username), crypt(p_password, gen_salt('bf')), trim(p_email), auth.uid())
  returning * into v_row;
  return query select v_row.id, v_row.username;
end;
$$;
grant execute on function teacher_signup(text, text, text) to anon, authenticated;

create or replace function teacher_login(p_username text, p_password text)
returns table(id uuid, username text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher teachers%rowtype;
begin
  select * into v_teacher from teachers where teachers.username = trim(p_username);
  if not found or v_teacher.password_hash <> crypt(coalesce(p_password, ''), v_teacher.password_hash) then
    raise exception '아이디 또는 비밀번호가 올바르지 않아요';
  end if;
  update teachers set auth_user_id = auth.uid() where teachers.id = v_teacher.id;
  return query select v_teacher.id, v_teacher.username;
end;
$$;
grant execute on function teacher_login(text, text) to anon, authenticated;

create or replace function teacher_find_username(p_email text)
returns table(username text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query select t.username from teachers t where t.email = trim(p_email);
end;
$$;
grant execute on function teacher_find_username(text) to anon, authenticated;

create or replace function teacher_reset_password(p_username text, p_email text, p_new_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher teachers%rowtype;
begin
  select * into v_teacher from teachers where teachers.username = trim(p_username) and teachers.email = trim(p_email);
  if not found then
    raise exception '아이디와 이메일이 일치하는 계정을 찾을 수 없어요';
  end if;
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상으로 입력해주세요';
  end if;
  update teachers set password_hash = crypt(p_new_password, gen_salt('bf')) where teachers.id = v_teacher.id;
end;
$$;
grant execute on function teacher_reset_password(text, text, text) to anon, authenticated;

-- ── 학급: 만들기 / 내 학급 목록 / 코드 수정 ──────────────────

create or replace function create_class(p_name text)
returns table(id uuid, name text, code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher_id uuid;
  v_code text;
  v_row classes%rowtype;
begin
  select teachers.id into v_teacher_id from teachers where teachers.auth_user_id = auth.uid();
  if v_teacher_id is null then
    raise exception '로그인이 필요해요. 다시 로그인해주세요';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception '학급 이름을 입력해주세요';
  end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from classes c where c.code = v_code);
  end loop;
  insert into classes (name, code, teacher_id)
  values (trim(p_name), v_code, v_teacher_id)
  returning * into v_row;
  return query select v_row.id, v_row.name, v_row.code;
end;
$$;
grant execute on function create_class(text) to anon, authenticated;

create or replace function get_my_classes()
returns table(id uuid, name text, code text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select c.id, c.name, c.code, c.created_at
    from classes c
    join teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
    order by c.created_at desc;
end;
$$;
grant execute on function get_my_classes() to anon, authenticated;

create or replace function assert_class_owner(p_class_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from classes c
    join teachers t on t.id = c.teacher_id
    where c.id = p_class_id and t.auth_user_id = auth.uid()
  ) then
    raise exception '이 학급에 대한 권한이 없어요. 다시 로그인해주세요';
  end if;
end;
$$;

create or replace function admin_update_class_code(p_class_id uuid, p_new_code text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
begin
  perform assert_class_owner(p_class_id);
  v_code := upper(trim(p_new_code));
  if v_code !~ '^[A-Z0-9]{4,12}$' then
    raise exception '학급 코드는 영문 대문자/숫자 4~12자로 입력해주세요';
  end if;
  if exists (select 1 from classes c where c.code = v_code and c.id <> p_class_id) then
    raise exception '이미 사용 중인 학급 코드예요';
  end if;
  update classes set code = v_code where classes.id = p_class_id;
end;
$$;
grant execute on function admin_update_class_code(uuid, text) to anon, authenticated;

-- ── 일차: 만들기 / 수정 / 삭제 (학급 소유자만) ──────────────

create or replace function assert_day_owner(p_day_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from days d
    join classes c on c.id = d.class_id
    join teachers t on t.id = c.teacher_id
    where d.id = p_day_id and t.auth_user_id = auth.uid()
  ) then
    raise exception '이 일차에 대한 권한이 없어요. 다시 로그인해주세요';
  end if;
end;
$$;

create or replace function admin_create_day(p_class_id uuid, p_title text, p_order_index int default 0)
returns days
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row days%rowtype;
begin
  perform assert_class_owner(p_class_id);
  if coalesce(trim(p_title), '') = '' then
    raise exception '일차 제목을 입력해주세요';
  end if;
  insert into days (class_id, title, order_index)
  values (p_class_id, trim(p_title), coalesce(p_order_index, 0))
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function admin_create_day(uuid, text, int) to anon, authenticated;

create or replace function admin_update_day(p_class_id uuid, p_id uuid, p_title text, p_order_index int)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  update days set title = p_title, order_index = coalesce(p_order_index, 0)
  where days.id = p_id and days.class_id = p_class_id;
end;
$$;
grant execute on function admin_update_day(uuid, uuid, text, int) to anon, authenticated;

create or replace function admin_delete_day(p_class_id uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  delete from days where days.id = p_id and days.class_id = p_class_id;
end;
$$;
grant execute on function admin_delete_day(uuid, uuid) to anon, authenticated;

-- ── 학생: 로그인 ──────────────────────────────────────────

create or replace function student_login(p_class_code text, p_student_number text, p_name text, p_pin text)
returns table(id uuid, class_id uuid, student_number text, name text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_student students%rowtype;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN은 숫자 4자리로 입력해주세요';
  end if;
  select * into v_class from classes where classes.code = upper(trim(p_class_code));
  if not found then
    raise exception '학급 코드를 찾을 수 없어요';
  end if;

  select * into v_student from students
    where students.class_id = v_class.id
      and students.student_number = trim(p_student_number)
      and students.name = trim(p_name);

  if not found then
    insert into students (class_id, student_number, name, pin_hash, auth_user_id)
    values (v_class.id, trim(p_student_number), trim(p_name), crypt(p_pin, gen_salt('bf')), auth.uid())
    returning * into v_student;
  else
    if v_student.pin_hash <> crypt(p_pin, v_student.pin_hash) then
      raise exception 'PIN이 올바르지 않아요';
    end if;
    update students set auth_user_id = auth.uid() where students.id = v_student.id;
  end if;

  return query select v_student.id, v_student.class_id, v_student.student_number, v_student.name;
end;
$$;
grant execute on function student_login(text, text, text, text) to anon, authenticated;

-- ── 내 장비 ──────────────────────────────────────────────

create or replace function save_equipment(
  p_bow_number text, p_lane_info text,
  p_sight_vertical text, p_sight_horizontal text, p_sight_note text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student_id uuid;
begin
  select students.id into v_student_id from students where students.auth_user_id = auth.uid();
  if v_student_id is null then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  insert into equipment (student_id, bow_number, lane_info, sight_vertical, sight_horizontal, sight_note, updated_at)
  values (v_student_id, p_bow_number, p_lane_info, p_sight_vertical, p_sight_horizontal, p_sight_note, now())
  on conflict (student_id) do update set
    bow_number = excluded.bow_number,
    lane_info = excluded.lane_info,
    sight_vertical = excluded.sight_vertical,
    sight_horizontal = excluded.sight_horizontal,
    sight_note = excluded.sight_note,
    updated_at = now();
end;
$$;
grant execute on function save_equipment(text, text, text, text, text) to anon, authenticated;

create or replace function get_my_equipment()
returns table(bow_number text, lane_info text, sight_vertical text, sight_horizontal text, sight_note text, updated_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select e.bow_number, e.lane_info, e.sight_vertical, e.sight_horizontal, e.sight_note, e.updated_at
    from equipment e
    join students s on s.id = e.student_id
    where s.auth_user_id = auth.uid();
end;
$$;
grant execute on function get_my_equipment() to anon, authenticated;

-- ── 기록하기 (탄착·조준 보정, 일차별) ──────────────────────

create or replace function save_shooting_log(
  p_day_id uuid, p_bow_number text,
  p_markers jsonb, p_hit_count int,
  p_group_center_x numeric, p_group_center_y numeric,
  p_aim_advice text, p_sight_before text, p_sight_after text,
  p_miss_count int default 0
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_day days%rowtype;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  select * into v_day from days where days.id = p_day_id;
  if not found or v_day.class_id <> v_student.class_id then
    raise exception '일차를 찾을 수 없어요';
  end if;

  insert into shooting_logs (
    student_id, day_id, class_id, class_name, student_name, student_number, day_title,
    bow_number, markers, hit_count, miss_count,
    group_center_x, group_center_y, aim_advice, sight_before, sight_after
  ) values (
    v_student.id, p_day_id, v_student.class_id,
    (select name from classes where classes.id = v_student.class_id),
    v_student.name, v_student.student_number, v_day.title,
    p_bow_number, coalesce(p_markers, '[]'::jsonb), coalesce(p_hit_count, 0), coalesce(p_miss_count, 0),
    p_group_center_x, p_group_center_y, p_aim_advice, p_sight_before, p_sight_after
  )
  on conflict (student_id, day_id) do update set
    bow_number = excluded.bow_number,
    markers = excluded.markers,
    hit_count = excluded.hit_count,
    miss_count = excluded.miss_count,
    group_center_x = excluded.group_center_x,
    group_center_y = excluded.group_center_y,
    aim_advice = excluded.aim_advice,
    sight_before = excluded.sight_before,
    sight_after = excluded.sight_after;
end;
$$;
grant execute on function save_shooting_log(uuid, text, jsonb, int, numeric, numeric, text, text, text, int) to anon, authenticated;

create or replace function get_my_shooting_log(p_day_id uuid)
returns table(bow_number text, markers jsonb, hit_count int, miss_count int)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select l.bow_number, l.markers, l.hit_count, l.miss_count
    from shooting_logs l
    join students s on s.id = l.student_id
    where s.auth_user_id = auth.uid() and l.day_id = p_day_id;
end;
$$;
grant execute on function get_my_shooting_log(uuid) to anon, authenticated;

create or replace function get_my_shooting_history(p_limit int default 10)
returns table(day_id uuid, day_title text, hit_count int, miss_count int, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select l.day_id, l.day_title, l.hit_count, l.miss_count, l.created_at
    from shooting_logs l
    join students s on s.id = l.student_id
    where s.auth_user_id = auth.uid()
    order by l.created_at desc
    limit p_limit;
end;
$$;
grant execute on function get_my_shooting_history(int) to anon, authenticated;

-- ── 성찰하기 (심리기법 체크+메모, 일차별) ──────────────────

create or replace function save_reflection(p_day_id uuid, p_used_skills text[], p_short_note text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_day days%rowtype;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  select * into v_day from days where days.id = p_day_id;
  if not found or v_day.class_id <> v_student.class_id then
    raise exception '일차를 찾을 수 없어요';
  end if;

  insert into reflections (
    student_id, day_id, class_id, class_name, student_name, student_number, day_title,
    used_skills, short_note
  ) values (
    v_student.id, p_day_id, v_student.class_id,
    (select name from classes where classes.id = v_student.class_id),
    v_student.name, v_student.student_number, v_day.title,
    coalesce(p_used_skills, '{}'), p_short_note
  )
  on conflict (student_id, day_id) do update set
    used_skills = excluded.used_skills,
    short_note = excluded.short_note;
end;
$$;
grant execute on function save_reflection(uuid, text[], text) to anon, authenticated;

create or replace function get_my_reflection(p_day_id uuid)
returns table(used_skills text[], short_note text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select r.used_skills, r.short_note
    from reflections r
    join students s on s.id = r.student_id
    where s.auth_user_id = auth.uid() and r.day_id = p_day_id;
end;
$$;
grant execute on function get_my_reflection(uuid) to anon, authenticated;

create or replace function save_reflection_answer(p_question_id uuid, p_answer_text text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_question reflection_questions%rowtype;
  v_day days%rowtype;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  select * into v_question from reflection_questions where reflection_questions.id = p_question_id;
  if not found then
    raise exception '문항을 찾을 수 없어요';
  end if;
  select * into v_day from days where days.id = v_question.day_id;
  if not found or v_day.class_id <> v_student.class_id then
    raise exception '문항을 찾을 수 없어요';
  end if;

  insert into reflection_answers (
    student_id, day_id, class_id, question_id, class_name, student_name, student_number, answer_text
  ) values (
    v_student.id, v_day.id, v_student.class_id, p_question_id,
    (select name from classes where classes.id = v_student.class_id),
    v_student.name, v_student.student_number, p_answer_text
  )
  on conflict (student_id, question_id) do update set
    answer_text = excluded.answer_text;
end;
$$;
grant execute on function save_reflection_answer(uuid, text) to anon, authenticated;

create or replace function get_my_reflection_answers(p_day_id uuid)
returns table(question_id uuid, answer_text text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select a.question_id, a.answer_text
    from reflection_answers a
    join students s on s.id = a.student_id
    where s.auth_user_id = auth.uid() and a.day_id = p_day_id;
end;
$$;
grant execute on function get_my_reflection_answers(uuid) to anon, authenticated;

-- ── 관리자: 일차별 콘텐츠 관리 (일차 소유자만) ──────────────

create or replace function admin_list_read_contents(p_day_id uuid)
returns setof read_contents
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  return query select * from read_contents where read_contents.day_id = p_day_id order by order_index, created_at;
end;
$$;
grant execute on function admin_list_read_contents(uuid) to anon, authenticated;

create or replace function admin_upsert_read_content(
  p_day_id uuid, p_id uuid,
  p_title text, p_category text, p_image_urls text, p_order_index int, p_visible boolean
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  perform assert_day_owner(p_day_id);
  if p_id is null then
    insert into read_contents (day_id, title, category, image_urls, order_index, visible)
    values (p_day_id, p_title, p_category, p_image_urls, coalesce(p_order_index, 0), coalesce(p_visible, true))
    returning read_contents.id into v_id;
  else
    update read_contents set
      title = p_title, category = p_category, image_urls = p_image_urls,
      order_index = coalesce(p_order_index, 0), visible = coalesce(p_visible, true)
    where read_contents.id = p_id and read_contents.day_id = p_day_id
    returning read_contents.id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function admin_upsert_read_content(uuid, uuid, text, text, text, int, boolean) to anon, authenticated;

create or replace function admin_delete_read_content(p_day_id uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  delete from read_contents where read_contents.id = p_id and read_contents.day_id = p_day_id;
end;
$$;
grant execute on function admin_delete_read_content(uuid, uuid) to anon, authenticated;

create or replace function admin_list_learn_contents(p_day_id uuid)
returns setof learn_contents
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  return query select * from learn_contents where learn_contents.day_id = p_day_id order by order_index, created_at;
end;
$$;
grant execute on function admin_list_learn_contents(uuid) to anon, authenticated;

create or replace function admin_upsert_learn_content(
  p_day_id uuid, p_id uuid,
  p_title text, p_category text, p_video_url text, p_image_urls text, p_description text,
  p_order_index int, p_visible boolean
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  perform assert_day_owner(p_day_id);
  if p_id is null then
    insert into learn_contents (day_id, title, category, video_url, image_urls, description, order_index, visible)
    values (p_day_id, p_title, p_category, p_video_url, p_image_urls, p_description, coalesce(p_order_index, 0), coalesce(p_visible, true))
    returning learn_contents.id into v_id;
  else
    update learn_contents set
      title = p_title, category = p_category, video_url = p_video_url,
      image_urls = p_image_urls, description = p_description,
      order_index = coalesce(p_order_index, 0), visible = coalesce(p_visible, true)
    where learn_contents.id = p_id and learn_contents.day_id = p_day_id
    returning learn_contents.id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function admin_upsert_learn_content(uuid, uuid, text, text, text, text, text, int, boolean) to anon, authenticated;

create or replace function admin_delete_learn_content(p_day_id uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  delete from learn_contents where learn_contents.id = p_id and learn_contents.day_id = p_day_id;
end;
$$;
grant execute on function admin_delete_learn_content(uuid, uuid) to anon, authenticated;

create or replace function admin_list_reflection_questions(p_day_id uuid)
returns setof reflection_questions
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  return query select * from reflection_questions where reflection_questions.day_id = p_day_id order by order_index, created_at;
end;
$$;
grant execute on function admin_list_reflection_questions(uuid) to anon, authenticated;

create or replace function admin_upsert_reflection_question(
  p_day_id uuid, p_id uuid,
  p_question_text text, p_activity_sheet_url text, p_order_index int, p_visible boolean
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  perform assert_day_owner(p_day_id);
  if coalesce(trim(p_question_text), '') = '' then
    raise exception '문항 내용을 입력해주세요';
  end if;
  if p_id is null then
    insert into reflection_questions (day_id, question_text, activity_sheet_url, order_index, visible)
    values (p_day_id, p_question_text, p_activity_sheet_url, coalesce(p_order_index, 0), coalesce(p_visible, true))
    returning reflection_questions.id into v_id;
  else
    update reflection_questions set
      question_text = p_question_text, activity_sheet_url = p_activity_sheet_url,
      order_index = coalesce(p_order_index, 0), visible = coalesce(p_visible, true)
    where reflection_questions.id = p_id and reflection_questions.day_id = p_day_id
    returning reflection_questions.id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function admin_upsert_reflection_question(uuid, uuid, text, text, int, boolean) to anon, authenticated;

create or replace function admin_delete_reflection_question(p_day_id uuid, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_day_owner(p_day_id);
  delete from reflection_questions where reflection_questions.id = p_id and reflection_questions.day_id = p_day_id;
end;
$$;
grant execute on function admin_delete_reflection_question(uuid, uuid) to anon, authenticated;

create or replace function admin_list_reflection_questions_by_class(p_class_id uuid)
returns setof reflection_questions
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  return query
    select rq.* from reflection_questions rq
    join days d on d.id = rq.day_id
    where d.class_id = p_class_id
    order by d.order_index, rq.order_index, rq.created_at;
end;
$$;
grant execute on function admin_list_reflection_questions_by_class(uuid) to anon, authenticated;

-- ── 관리자: 학생·기록 조회 (학급 소유자만) ──────────────────

create or replace function admin_list_students(p_class_id uuid)
returns table(
  student_id uuid, student_number text, name text, created_at timestamptz,
  has_equipment boolean, shooting_log_count bigint, reflection_count bigint
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  return query
    select s.id, s.student_number, s.name, s.created_at,
      exists(select 1 from equipment e where e.student_id = s.id),
      (select count(*) from shooting_logs l where l.student_id = s.id),
      (select count(*) from reflections r where r.student_id = s.id)
    from students s
    where s.class_id = p_class_id
    order by s.student_number;
end;
$$;
grant execute on function admin_list_students(uuid) to anon, authenticated;

create or replace function admin_list_shooting_logs(p_class_id uuid, p_limit int default 300)
returns setof shooting_logs
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  return query select * from shooting_logs where shooting_logs.class_id = p_class_id order by created_at desc limit p_limit;
end;
$$;
grant execute on function admin_list_shooting_logs(uuid, int) to anon, authenticated;

create or replace function admin_list_reflections(p_class_id uuid, p_limit int default 300)
returns setof reflections
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  return query select * from reflections where reflections.class_id = p_class_id order by created_at desc limit p_limit;
end;
$$;
grant execute on function admin_list_reflections(uuid, int) to anon, authenticated;

create or replace function admin_list_reflection_answers(p_class_id uuid, p_limit int default 500)
returns setof reflection_answers
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_class_owner(p_class_id);
  return query select * from reflection_answers where reflection_answers.class_id = p_class_id order by created_at desc limit p_limit;
end;
$$;
grant execute on function admin_list_reflection_answers(uuid, int) to anon, authenticated;

-- ── 콘텐츠 파일 업로드(Storage): 읽어보기/배워보기 이미지·영상 직접 업로드 ──
-- 버킷은 공개 읽기(콘텐츠 자체가 민감하지 않음)이고, 업로드/수정/삭제는
-- teachers 테이블에 auth_user_id가 연결된 사람(=로그인한 교사)만 가능하다.

insert into storage.buckets (id, name, public)
values ('content-uploads', 'content-uploads', true)
on conflict (id) do update set public = true;

drop policy if exists "content-uploads_select" on storage.objects;
create policy "content-uploads_select" on storage.objects
  for select using (bucket_id = 'content-uploads');

drop policy if exists "content-uploads_insert" on storage.objects;
create policy "content-uploads_insert" on storage.objects
  for insert with check (
    bucket_id = 'content-uploads'
    and exists (select 1 from teachers where teachers.auth_user_id = auth.uid())
  );

drop policy if exists "content-uploads_update" on storage.objects;
create policy "content-uploads_update" on storage.objects
  for update using (
    bucket_id = 'content-uploads'
    and exists (select 1 from teachers where teachers.auth_user_id = auth.uid())
  );

drop policy if exists "content-uploads_delete" on storage.objects;
create policy "content-uploads_delete" on storage.objects
  for delete using (
    bucket_id = 'content-uploads'
    and exists (select 1 from teachers where teachers.auth_user_id = auth.uid())
  );

-- ── 관리자: 학생 상세(일차별 기록 조회·삭제) + 비밀번호(PIN) 재설정 ──

create or replace function assert_student_owner(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (
    select 1 from students s
    join classes c on c.id = s.class_id
    join teachers t on t.id = c.teacher_id
    where s.id = p_student_id and t.auth_user_id = auth.uid()
  ) then
    raise exception '이 학생에 대한 권한이 없어요. 다시 로그인해주세요';
  end if;
end;
$$;

create or replace function admin_list_student_shooting_logs(p_student_id uuid)
returns setof shooting_logs
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_student_owner(p_student_id);
  return query
    select * from shooting_logs
    where shooting_logs.student_id = p_student_id
    order by created_at desc;
end;
$$;
grant execute on function admin_list_student_shooting_logs(uuid) to anon, authenticated;

create or replace function admin_list_student_reflection_answers(p_student_id uuid)
returns table(
  id uuid, day_id uuid, day_title text,
  question_id uuid, question_text text, answer_text text, created_at timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_student_owner(p_student_id);
  return query
    select ra.id, ra.day_id, d.title, ra.question_id, rq.question_text, ra.answer_text, ra.created_at
    from reflection_answers ra
    join days d on d.id = ra.day_id
    join reflection_questions rq on rq.id = ra.question_id
    where ra.student_id = p_student_id
    order by d.order_index, rq.order_index;
end;
$$;
grant execute on function admin_list_student_reflection_answers(uuid) to anon, authenticated;

create or replace function admin_delete_student_day_record(p_student_id uuid, p_day_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_student_owner(p_student_id);
  delete from shooting_logs where shooting_logs.student_id = p_student_id and shooting_logs.day_id = p_day_id;
  delete from reflection_answers where reflection_answers.student_id = p_student_id and reflection_answers.day_id = p_day_id;
end;
$$;
grant execute on function admin_delete_student_day_record(uuid, uuid) to anon, authenticated;

create or replace function admin_reset_student_pin(p_student_id uuid, p_new_pin text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_student_owner(p_student_id);
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN은 숫자 4자리로 입력해주세요';
  end if;
  update students set pin_hash = crypt(p_new_pin, gen_salt('bf')) where students.id = p_student_id;
end;
$$;
grant execute on function admin_reset_student_pin(uuid, text) to anon, authenticated;
