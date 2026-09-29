create table calendar_shares (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table calendar_shares enable row level security;

create policy "read own calendar share" on calendar_shares
  for select to authenticated using (user_id = auth.uid());

create policy "add own calendar share" on calendar_shares
  for insert to authenticated with check (user_id = auth.uid());

create policy "update own calendar share" on calendar_shares
  for update to authenticated using (user_id = auth.uid());

-- 공유 링크 조회는 토큰을 아는 서버 코드가 service_role로 직접 조회한다 (anon select 정책 없음)
grant select, insert, update on calendar_shares to authenticated;
grant select, insert, update, delete on calendar_shares to service_role;
