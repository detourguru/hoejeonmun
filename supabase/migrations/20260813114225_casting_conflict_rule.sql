-- 기존 스키마는 slots가 uploads를 참조해서 회차 하나를 업로드 하나가 소유했다.
-- 캐스팅보드 이미지 1장 = 티켓팅 기간 전체(최대 200회차)이므로 같은 회차에 대한
-- 재업로드(캐스팅 변경, 추가 오픈분, 재촬영)가 정상 경로인데,
-- unique(show_id, date, time)에 걸려 두 번째 업로드가 들어갈 자리가 없었다.
--
-- 회차를 업로드에서 분리하고, 주장(assignments)이 업로드별로 쌓이게 바꾼다.
-- 채택 규칙은 회차별 최신 우선이며 current_castings 뷰 한 곳에만 정의한다.

-- 아직 저장 파이프라인이 없어 데이터가 없다는 전제다. 있으면 중단한다.
do $$
begin
  if exists (select 1 from assignments)
    or exists (select 1 from slots)
    or exists (select 1 from uploads)
    or exists (select 1 from vandal_reports)
  then
    raise exception '기존 테이블에 데이터가 있어 중단합니다. drop이 아니라 alter로 옮겨야 합니다.';
  end if;
end $$;

drop table vandal_reports;
drop table assignments;
drop table slots;
drop table uploads;
-- actors는 구조가 그대로라 유지한다.

-- 업로드 1건 = 캐스팅보드 이미지 1장 = 티켓팅 기간 전체(최대 200회차)
create table uploads (
  id bigint generated always as identity primary key,
  show_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  -- 파싱 유사도 미달 시 구조화 대신 보관하는 원문
  raw_text text,
  created_at timestamptz not null default now()
);

create index uploads_show_id_idx on uploads (show_id);

-- 회차는 누가 올렸는지와 무관한 사실이므로 업로드를 참조하지 않는다.
-- 같은 회차를 여러 업로드가 주장할 수 있고, 그 주장은 assignments에 쌓인다.
create table slots (
  id bigint generated always as identity primary key,
  show_id text not null,
  date date not null,
  time time not null,
  created_at timestamptz not null default now(),
  unique (show_id, date, time)
);

create index slots_show_id_date_idx on slots (show_id, date);

create table assignments (
  id bigint generated always as identity primary key,
  upload_id bigint not null references uploads(id) on delete cascade,
  slot_id bigint not null references slots(id) on delete cascade,
  role_name_raw text not null,
  actor_name_raw text not null,
  actor_id bigint references actors(id) on delete set null,
  unique (upload_id, slot_id, role_name_raw)
);

create index assignments_slot_id_idx on assignments (slot_id);
-- 배우 -> 회차 역조회
create index assignments_actor_id_idx on assignments (actor_id);

-- 신고 단위는 회차가 아니라 (업로드, 회차)다.
-- 회차 단위로 두면 신고가 회차에 박혀서 이후 업로드까지 따라붙고,
-- 업로드 단위로 두면 1회차 오류로 200회차가 통째로 내려간다.
create table vandal_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id bigint not null references uploads(id) on delete cascade,
  slot_id bigint not null references slots(id) on delete cascade,
  type text not null,
  context text,
  created_at timestamptz not null default now(),
  unique (user_id, upload_id, slot_id)
);

-- 신고 5건이 쌓여 목록에서 내려간 (업로드, 회차).
-- 신고자를 감추기 위해 vandal_reports 자체는 열지 않고 이 집계 뷰만 노출하므로
-- 의도적으로 security_invoker를 끈다.
create view hidden_castings
with (security_invoker = false) as
select upload_id, slot_id
from vandal_reports
group by upload_id, slot_id
having count(*) >= 5;

-- 회차별 채택 업로드: 내려가지 않은 것 중 가장 최신 1건.
-- 역할별로 섞지 않고 업로드 하나를 통째로 채택해야
-- A역은 구버전, B역은 신버전인 회차가 생기지 않는다.
create view current_castings
with (security_invoker = true) as
select distinct on (a.slot_id)
  a.slot_id,
  a.upload_id
from assignments a
where not exists (
  select 1
  from hidden_castings h
  where h.upload_id = a.upload_id
    and h.slot_id = a.slot_id
)
order by a.slot_id, a.upload_id desc;

-- 화면에서 읽는 최종 캐스팅
create view slot_castings
with (security_invoker = true) as
select
  s.id as slot_id,
  s.show_id,
  s.date,
  s.time,
  a.upload_id,
  a.role_name_raw,
  a.actor_name_raw,
  a.actor_id
from slots s
join current_castings c on c.slot_id = s.id
join assignments a on a.slot_id = s.id and a.upload_id = c.upload_id;

-- 쓰기는 전부 서버(service role)를 거치므로 읽기 정책만 연다.
alter table actors enable row level security;
alter table uploads enable row level security;
alter table slots enable row level security;
alter table assignments enable row level security;
alter table vandal_reports enable row level security;

create policy "actors are public" on actors for select using (true);
create policy "uploads are public" on uploads for select using (true);
create policy "slots are public" on slots for select using (true);
create policy "assignments are public" on assignments for select using (true);
