create table casting_parse_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  show_id text not null,
  storage_paths text[] not null check (cardinality(storage_paths) between 1 and 5),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  upload_id bigint references uploads(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index casting_parse_results_created_at_idx on casting_parse_results (created_at);
create index casting_parse_results_upload_id_idx on casting_parse_results (upload_id);

alter table casting_parse_results enable row level security;

grant select, insert, update, delete on casting_parse_results to service_role;
