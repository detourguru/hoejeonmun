alter table assignments add column role_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by upload_id, slot_id
      order by id
    ) - 1 as rn
  from assignments
)
update assignments a
set role_order = ranked.rn
from ranked
where a.id = ranked.id;

alter table assignments alter column role_order set not null;
alter table assignments alter column role_order set default 0;

-- 화면에서 읽는 slot_castings에 role_order를 노출
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
  -- CREATE OR REPLACE VIEW는 기존 컬럼 순서/이름을 바꿀 수 없고 끝에만
  -- 추가할 수 있어서(42P16), role_order를 반드시 마지막에 둔다
  a.role_order
from slots s
join current_castings c on c.slot_id = s.id
join assignments a on a.slot_id = s.id and a.upload_id = c.upload_id
join uploads u on u.id = a.upload_id
where s.cancelled_at is null;
