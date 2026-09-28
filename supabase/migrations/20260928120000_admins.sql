create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

create policy "read own admin row" on admins
  for select to authenticated
  using (user_id = auth.uid());

grant select on admins to anon, authenticated;
grant select, insert, update, delete on admins to service_role;
