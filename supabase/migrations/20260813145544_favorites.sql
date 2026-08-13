-- 애정배우. 캐스팅과 달리 완전히 개인 데이터라 사용자 권한으로 직접 쓰고 읽는다.
create table favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id bigint not null references actors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, actor_id)
);

create index favorites_actor_id_idx on favorites (actor_id);

alter table favorites enable row level security;

create policy "read own favorites" on favorites
  for select to authenticated using (user_id = auth.uid());

create policy "add own favorites" on favorites
  for insert to authenticated with check (user_id = auth.uid());

create policy "remove own favorites" on favorites
  for delete to authenticated using (user_id = auth.uid());
