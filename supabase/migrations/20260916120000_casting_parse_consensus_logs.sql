-- 3회 병렬 파싱 결과 집계용
create table casting_parse_consensus_logs (
  id bigint generated always as identity primary key,
  show_id text not null,
  runs_requested smallint not null,
  runs_succeeded smallint not null,
  performances_count integer not null,
  performances_unsure_count integer not null,
  roles_count integer not null,
  roles_unsure_count integer not null,
  created_at timestamptz not null default now()
);

create index casting_parse_consensus_logs_created_at_idx on casting_parse_consensus_logs (created_at);
create index casting_parse_consensus_logs_show_id_idx on casting_parse_consensus_logs (show_id);

alter table casting_parse_consensus_logs enable row level security;
