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

-- 애정 배우
create table favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id bigint not null references actors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, actor_id)
);

create index favorites_actor_id_idx on favorites (actor_id);

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

alter table actors enable row level security;
alter table uploads enable row level security;
alter table upload_images enable row level security;
alter table slots enable row level security;
alter table assignments enable row level security;
alter table vandal_reports enable row level security;
alter table favorites enable row level security;

create policy "actors are public" on actors for select using (true);
create policy "uploads are public" on uploads for select using (true);
create policy "upload_images are public" on upload_images for select using (true);
create policy "slots are public" on slots for select using (true);
create policy "assignments are public" on assignments for select using (true);

create policy "read own favorites" on favorites
  for select to authenticated using (user_id = auth.uid());

create policy "add own favorites" on favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "remove own favorites" on favorites
  for delete to authenticated using (user_id = auth.uid());

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
