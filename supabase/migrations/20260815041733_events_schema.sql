-- 공연별 특전/이벤트 (ADR-018)
-- 소스는 두 갈래: (a) 이벤트 안내 이미지 전체, (b) 캐스팅표 행 배지(프리뷰/막공/커튼콜데이 등)에서 파생
-- (b)의 경우 slot_id를 채우고 period_start = period_end = 해당 회차 날짜로 저장한다
create table events (
  id bigint generated always as identity primary key,
  show_id text not null,
  upload_id bigint not null references uploads(id) on delete cascade,
  upload_image_id bigint not null references upload_images(id) on delete cascade,
  slot_id bigint references slots(id) on delete cascade,
  title text not null,
  description text,
  -- 이벤트를 확인할 수 있는 외부 링크(선택)
  url text check (url is null or url ~ '^https?://'),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  check (period_start <= period_end)
);

create index events_show_id_idx on events (show_id);
create index events_slot_id_idx on events (slot_id);
create index events_upload_image_id_idx on events (upload_image_id);

-- 신고 단위는 이벤트 1건 (캐스팅과 달리 "최신 업로드가 이전 걸 대체"하는 버저닝이 없음)
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

-- 신고 5건이 쌓여 목록에서 내려간 이벤트 (vandal_reports/hidden_castings와 동일한 임계치, ADR-008)
create view hidden_events
with (security_invoker = false) as
select event_id
from event_reports
group by event_id
having count(*) >= 5;

-- 화면에서 읽는 최종 이벤트 목록
create view visible_events
with (security_invoker = true) as
select e.*
from events e
where not exists (
  select 1
  from hidden_events h
  where h.event_id = e.id
);

alter table events enable row level security;
alter table event_reports enable row level security;

create policy "events are public" on events for select using (true);

create policy "authenticated users can set event url" on events
  for update
  to authenticated
  using (true)
  with check (true);

revoke update on events from authenticated;
grant update (url) on events to authenticated;
