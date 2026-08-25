create table actors (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table uploads (
  id bigint generated always as identity primary key,
  show_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 파싱 유사도 미달 시 원문을 보관한다
  raw_text text,
  created_at timestamptz not null default now()
);

create index uploads_show_id_idx on uploads (show_id);

create table upload_images (
  id bigint generated always as identity primary key,
  upload_id bigint not null references uploads(id) on delete cascade,
  url text not null,
  -- 같은 업로드 내 이미지 순서
  position smallint not null,
  created_at timestamptz not null default now(),
  unique (upload_id, position)
);

create index upload_images_upload_id_idx on upload_images (upload_id);

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
  upload_image_id bigint not null references upload_images(id) on delete cascade,
  unique (upload_id, slot_id, role_name_raw)
);

create index assignments_slot_id_idx on assignments (slot_id);
-- 배우 -> 회차 역조회
create index assignments_actor_id_idx on assignments (actor_id);
create index assignments_upload_image_id_idx on assignments (upload_image_id);

-- 신고 단위는 업로드 + 회차
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

create table event_groups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

create table events (
  id bigint generated always as identity primary key,
  group_id bigint not null references event_groups(id) on delete cascade,
  show_id text not null,
  upload_id bigint not null references uploads(id) on delete cascade,
  upload_image_id bigint not null references upload_images(id) on delete cascade,
  slot_id bigint references slots(id) on delete cascade,
  title text not null,
  -- 제목의 공백/문장부호를 지운 중복 판정용 키 ("스페셜커튼콜위크" = "스페셜 커튼콜 위크")
  title_key text generated always as (
    lower(
      regexp_replace(
        regexp_replace(title, '[[:space:]]+', '', 'g'),
        '[[:punct:]·・]+', '', 'g'
      )
    )
  ) stored,
  description text,
  period_start date not null,
  period_end date not null,
  -- badge: 캐스팅표 여백 라벨에서 파생 / notice: 이벤트 안내 이미지에서 읽음
  source text not null check (source in ('badge', 'notice')),
  -- 제보 확인 화면에서 기간이나 제목을 고친 사용자. 값은 화면에 노출하지 않는다
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_start <= period_end)
);

create index events_show_id_idx on events (show_id);
create index events_slot_id_idx on events (slot_id);
create index events_upload_image_id_idx on events (upload_image_id);

-- 이전 버전과 동일 값으로 버전 수정을 할 수도 있으므로 group_id + upload_id
create unique index events_dedupe_idx
  on events (group_id, upload_id, period_start, period_end);

-- 신고 단위는 이벤트 1건 
create table event_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id bigint not null references events(id) on delete cascade,
  type text not null,
  context text,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index event_reports_event_id_idx on event_reports (event_id);

-- 포스터에 인쇄된 제목과 KOPIS 공연명이 같은 공연을 가리키는지 한 번 판정한 결과
-- ("BROKEBACK MOUNTAIN" = "브로크백 마운틴"). 재연이나 타지역 공연에서도 재사용되도록
-- 키를 show_id가 아니라 정규화한 공연명으로 잡는다
create table show_title_aliases (
  show_title_key text not null,
  printed_title_key text not null,
  printed_title text not null,
  is_same boolean not null,
  created_at timestamptz not null default now(),
  primary key (show_title_key, printed_title_key)
);

-- 애정 배우
create table favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id bigint not null references actors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, actor_id)
);

create index favorites_actor_id_idx on favorites (actor_id);

-- Gemini 파싱 실패 사례 적재 (프롬프트 개선용, 내부 분석 전용이라 공개 정책 없음)
create table parse_failures (
  id bigint generated always as identity primary key,
  show_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  -- no_table_found: 표를 못 찾음 / cast_mismatch: 캐스팅이 안 겹침
  -- show_mismatch: 포스터 공연명이 다름 / exception: 그 외 오류
  type text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index parse_failures_show_id_idx on parse_failures (show_id);

alter table parse_failures enable row level security;
-- 직접 조회 없음, events/current_events를 통해서만 참조
alter table event_groups enable row level security;

-- 신고 5건이 쌓여 목록에서 내려간 업로드 + 회차
create view hidden_castings
with (security_invoker = false) as
select upload_id, slot_id
from vandal_reports
group by upload_id, slot_id
having count(*) >= 5;

-- 올라와있는 업로드 중 가장 최신 1건
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
  a.actor_id,
  a.id as assignment_id
from slots s
join current_castings c on c.slot_id = s.id
join assignments a on a.slot_id = s.id and a.upload_id = c.upload_id;

-- 신고 5건이 쌓여 목록에서 내려간 이벤트 (hidden_castings와 동일한 임계치, ADR-008)
create view hidden_events
with (security_invoker = false) as
select event_id
from event_reports
group by event_id
having count(*) >= 5;

-- 화면에서 읽는 최종 이벤트 목록.
-- edited_by를 읽어야 edited를 만들 수 있는데 그 열은 아래에서 막으므로 정의자 권한으로 돈다
create view visible_events
with (security_invoker = false) as
select
  e.id,
  e.group_id,
  e.show_id,
  e.upload_id,
  e.upload_image_id,
  e.slot_id,
  e.title,
  e.title_key,
  e.description,
  e.period_start,
  e.period_end,
  e.source,
  -- 누가 고쳤는지는 내보내지 않고 고쳐졌다는 사실만 내보낸다
  e.edited_by is not null as edited,
  e.created_at
from events e
where not exists (
  select 1
  from hidden_events h
  where h.event_id = e.id
);

create view current_events
with (security_invoker = true) as
select distinct on (group_id) *
from visible_events
order by group_id, id desc;


alter table actors enable row level security;
alter table uploads enable row level security;
alter table upload_images enable row level security;
alter table slots enable row level security;
alter table assignments enable row level security;
alter table vandal_reports enable row level security;
alter table favorites enable row level security;
alter table events enable row level security;
alter table event_reports enable row level security;
alter table show_title_aliases enable row level security;

create policy "actors are public" on actors for select using (true);
create policy "uploads are public" on uploads for select using (true);
create policy "upload_images are public" on upload_images for select using (true);
create policy "slots are public" on slots for select using (true);
create policy "assignments are public" on assignments for select using (true);
create policy "events are public" on events for select using (true);

-- edited_by는 내부 추적용이라 열 단위로 막는다. 밖으로는 visible_events.edited만 나간다
revoke select on events from anon, authenticated;
grant select (
  id, show_id, upload_id, upload_image_id, slot_id, title, title_key,
  description, period_start, period_end, source, created_at
) on events to anon, authenticated;

create policy "read own favorites" on favorites
  for select to authenticated using (user_id = auth.uid());

create policy "add own favorites" on favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "remove own favorites" on favorites
  for delete to authenticated using (user_id = auth.uid());

create policy "read own vandal reports" on vandal_reports
  for select to authenticated using (user_id = auth.uid());

create policy "add own vandal reports" on vandal_reports
  for insert to authenticated with check (user_id = auth.uid());

create policy "remove own vandal reports" on vandal_reports
  for delete to authenticated using (user_id = auth.uid());

alter table vandal_reports add constraint vandal_reports_context_required_check
  check (type <> 'other' or context is not null);

create policy "read own event reports" on event_reports
  for select to authenticated using (user_id = auth.uid());

create policy "add own event reports" on event_reports
  for insert to authenticated with check (user_id = auth.uid());

create policy "remove own event reports" on event_reports
  for delete to authenticated using (user_id = auth.uid());

alter table event_reports add constraint event_reports_context_required_check
  check (type <> 'other' or context is not null);

-- 원본 캡처는 회차 상세의 "원본 보기"로 누구나 봐야 하므로 공개
--
-- TODO: 실사용자 업로드가 시작되기 전에 private으로 전환할 것.
-- 캐스팅보드는 제작사 저작물이라 공개 버킷이면 우리가 무기한 공개 재배포하는 셈이라 숨겨야함
insert into storage.buckets (id, name, public)
values ('casting-boards', 'casting-boards', true)
on conflict (id) do nothing;

create policy "users upload own casting boards" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'casting-boards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

