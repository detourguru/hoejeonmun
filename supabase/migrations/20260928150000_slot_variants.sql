create table slot_variants (
  upload_id bigint not null references uploads(id) on delete cascade,
  slot_id bigint not null references slots(id) on delete cascade,
  label text not null check (length(label) between 1 and 50),
  primary key (upload_id, slot_id)
);

create index slot_variants_slot_id_idx on slot_variants (slot_id);

alter table slot_variants enable row level security;

create policy "slot variants are public" on slot_variants
  for select using (true);

grant select on slot_variants to anon, authenticated;
grant select, insert, update, delete on slot_variants to service_role;

-- 파서가 EPISODE 열을 배역으로 읽어 들인 기존 행을 회차 구분으로 복사한다
insert into slot_variants (upload_id, slot_id, label)
select distinct on (upload_id, slot_id)
  upload_id,
  slot_id,
  case
    when actor_name_raw ~ '^ROOM\S' then 'ROOM ' || substr(actor_name_raw, 5)
    else actor_name_raw
  end
from assignments
where upper(role_name_raw) = 'EPISODE'
order by upload_id, slot_id, id
on conflict do nothing;

create or replace view slot_castings
with (security_invoker = false) as
select
  s.id as slot_id,
  s.show_id,
  s.date,
  s.time,
  a.upload_id,
  a.role_name_raw,
  a.actor_name_raw,
  a.actor_id,
  a.verified,
  a.id as assignment_id,
  u.source as upload_source,
  exists (
    select 1
    from hidden_castings h
    where h.slot_id = s.id
      and h.upload_id > c.upload_id
  ) as fallback,
  a.role_order,
  v.label as variant
from slots s
join current_castings c on c.slot_id = s.id
join assignments a on a.slot_id = s.id and a.upload_id = c.upload_id
join uploads u on u.id = a.upload_id
left join slot_variants v on v.upload_id = c.upload_id and v.slot_id = s.id
where s.cancelled_at is null;
