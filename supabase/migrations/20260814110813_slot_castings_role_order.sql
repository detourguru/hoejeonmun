-- 배역 순서가 뷰에 없어서 화면마다 배역이 뒤죽박죽 나온다.
-- assignments는 캐스팅보드 헤더 순서대로 한 번에 insert되므로 id 오름차순이 곧
-- 원본 표의 열 순서다. 그 순서를 쓸 수 있게 id를 뷰에 노출한다.
-- (create or replace view라 기존 컬럼 순서는 그대로 두고 뒤에만 추가한다)
create or replace view slot_castings
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
