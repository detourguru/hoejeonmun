-- Manual merges and automatic KOPIS merges share one atomic operation.
create table show_redirects (
  from_show_id text primary key,
  to_show_id text not null,
  created_at timestamptz not null default now(),
  check (from_show_id <> to_show_id)
);
alter table show_redirects enable row level security;
grant select, insert, update on show_redirects to service_role;

create function merge_user_show(p_from text, p_to text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_slot slots;
  v_target bigint;
  v_moved int := 0;
  v_merged int := 0;
begin
  if p_from = p_to or p_from not like 'local-%' or p_to is null then raise exception 'invalid_merge'; end if;
  -- All merges take the same lock: prevent opposite merges/redirect cycles.
  perform pg_advisory_xact_lock(138);
  if exists (select 1 from show_redirects where from_show_id = p_to) then raise exception 'target_already_merged'; end if;
  perform id from user_shows where id = p_from for update;
  if not found then raise exception 'source_not_found'; end if;
  if p_to like 'local-%' and not exists (select 1 from user_shows where id = p_to) then raise exception 'target_not_found'; end if;
  for v_slot in select * from slots where show_id = p_from order by id for update loop
    select id into v_target from slots where show_id = p_to and date = v_slot.date and time = v_slot.time for update;
    if not found then
      update slots set show_id = p_to where id = v_slot.id;
      v_moved := v_moved + 1;
      continue;
    end if;
    -- Keep cancellation state from both records rather than silently reactivating a slot.
    update slots set cancelled_at = coalesce(cancelled_at, v_slot.cancelled_at) where id = v_target;
    insert into event_slots (event_id, slot_id)
      select event_id, v_target from event_slots where slot_id = v_slot.id on conflict do nothing;
    insert into my_slots (user_id, slot_id)
      select user_id, v_target from my_slots where slot_id = v_slot.id on conflict do nothing;
    -- Different upload IDs keep their own casting/variant/report records.
    update assignments set slot_id = v_target where slot_id = v_slot.id;
    update slot_variants set slot_id = v_target where slot_id = v_slot.id;
    update vandal_reports set slot_id = v_target where slot_id = v_slot.id;
    update casting_edits set target = jsonb_set(target, '{slot_id}', to_jsonb(v_target))
      where target->>'slot_id' = v_slot.id::text and show_id = p_from;
    update casting_edits set before = jsonb_set(before, '{slot_id}', to_jsonb(v_target))
      where before->>'slot_id' = v_slot.id::text and show_id = p_from;
    update casting_edits set after = jsonb_set(after, '{slot_id}', to_jsonb(v_target))
      where after->>'slot_id' = v_slot.id::text and show_id = p_from;
    delete from slots where id = v_slot.id;
    v_merged := v_merged + 1;
  end loop;
  -- Unique image hash conflicts deliberately abort the entire merge. No silent data loss.
  update upload_images set show_id = p_to where show_id = p_from;
  update uploads set show_id = p_to where show_id = p_from;
  update events set show_id = p_to where show_id = p_from;
  update parse_failures set show_id = p_to where show_id = p_from;
  update casting_parse_results set show_id = p_to where show_id = p_from;
  update casting_parse_consensus_logs set show_id = p_to where show_id = p_from;
  update casting_edits set show_id = p_to where show_id = p_from;
  update show_redirects set to_show_id = p_to where to_show_id = p_from;
  insert into show_redirects (from_show_id, to_show_id) values (p_from, p_to);
  delete from user_shows where id = p_from;
  return jsonb_build_object('moved', v_moved, 'merged', v_merged);
end;
$$;
revoke execute on function merge_user_show(text, text) from public, anon, authenticated;
grant execute on function merge_user_show(text, text) to service_role;
