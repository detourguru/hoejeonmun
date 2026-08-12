create table actors (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table uploads (
  id bigint generated always as identity primary key,
  url text not null,
  user_id uuid not null,
  show_id text not null
);

create table slots (
  id bigint generated always as identity primary key,
  upload_id bigint not null references uploads(id) on delete cascade,
  show_id text not null,
  date date not null,
  time time not null,
  unique (show_id, date, time)
);

create table assignments (
  id bigint generated always as identity primary key,
  slot_id bigint not null references slots(id) on delete cascade,
  role_name_raw text not null,
  actor_id bigint references actors(id) on delete set null,
  actor_name_raw text not null
);

create table vandal_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  slot_id bigint not null references slots(id) on delete cascade,
  type text not null,
  context text,

  unique (user_id, slot_id)
);
