create table casting_edits (
  id bigint generated always as identity primary key,
  show_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('notice', 'correction')),
  cause_upload_id bigint,
  action text not null check (action in ('cancel_slot', 'cancel_event', 'change_actor')),
  target jsonb not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id) on delete set null
);

create index casting_edits_show_id_created_at_idx on casting_edits (show_id, created_at desc);
create index casting_edits_cause_upload_id_idx on casting_edits (cause_upload_id)
  where reverted_at is null;

alter table casting_edits enable row level security;

grant select, insert, update, delete on casting_edits to service_role;

create function apply_casting_notices(
  p_upload_id bigint,
  p_slot_ids bigint[],
  p_event_ids bigint[],
  p_casting_changes jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_show_id text;
  v_user_id uuid;
  v_slot_count int;
  v_event_count int;
  v_change_count int := 0;
  v_change jsonb;
  v_after jsonb;
  v_before jsonb;
  v_updated int;
begin
  select show_id, user_id into v_show_id, v_user_id from uploads where id = p_upload_id;

  if v_show_id is null then
    raise exception 'upload % not found', p_upload_id;
  end if;

  with cancelled as (
    update slots set cancelled_at = now()
    where id = any(p_slot_ids) and show_id = v_show_id and cancelled_at is null
    returning id
  )
  insert into casting_edits (show_id, user_id, source, cause_upload_id, action, target)
  select v_show_id, v_user_id, 'notice', p_upload_id, 'cancel_slot', jsonb_build_object('slot_id', id)
  from cancelled;

  get diagnostics v_slot_count = row_count;

  with cancelled as (
    update events set cancelled_at = now()
    where id = any(p_event_ids) and show_id = v_show_id and cancelled_at is null
    returning id
  )
  insert into casting_edits (show_id, user_id, source, cause_upload_id, action, target)
  select v_show_id, v_user_id, 'notice', p_upload_id, 'cancel_event', jsonb_build_object('event_id', id)
  from cancelled;

  get diagnostics v_event_count = row_count;

  for v_change in select value from jsonb_array_elements(coalesce(p_casting_changes, '[]')) loop
    v_after := jsonb_build_object(
      'actor_name_raw', v_change->>'actor',
      'actor_id', (v_change->>'actor_id')::bigint
    );

    select jsonb_agg(
      jsonb_build_object('actor_name_raw', a.actor_name_raw, 'actor_id', a.actor_id)
      order by a.id
    )
    into v_before
    from assignments a
    join slots s on s.id = a.slot_id
    where a.upload_id = (v_change->>'upload_id')::bigint
      and a.slot_id = (v_change->>'slot_id')::bigint
      and a.role_name_raw = v_change->>'role'
      and s.show_id = v_show_id;

    continue when v_before is null or v_before = jsonb_build_array(v_after);

    update assignments
    set actor_name_raw = v_change->>'actor',
        actor_id = (v_change->>'actor_id')::bigint,
        verified = false
    where upload_id = (v_change->>'upload_id')::bigint
      and slot_id = (v_change->>'slot_id')::bigint
      and role_name_raw = v_change->>'role';

    get diagnostics v_updated = row_count;
    v_change_count := v_change_count + v_updated;

    insert into casting_edits (show_id, user_id, source, cause_upload_id, action, target, before, after)
    values (
      v_show_id, v_user_id, 'notice', p_upload_id, 'change_actor',
      jsonb_build_object(
        'upload_id', (v_change->>'upload_id')::bigint,
        'slot_id', (v_change->>'slot_id')::bigint,
        'role', v_change->>'role'
      ),
      v_before,
      v_after
    );
  end loop;

  return jsonb_build_object(
    'cancelled_slots', v_slot_count,
    'cancelled_events', v_event_count,
    'casting_changes', v_change_count
  );
end;
$$;

create function revert_casting_edit(p_edit_id bigint, p_reverted_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edit casting_edits;
  v_restored int;
begin
  select * into v_edit from casting_edits
  where id = p_edit_id and reverted_at is null
  for update;

  if not found then
    return false;
  end if;

  if v_edit.action = 'cancel_slot' then
    update slots set cancelled_at = null where id = (v_edit.target->>'slot_id')::bigint;
  elsif v_edit.action = 'cancel_event' then
    update events set cancelled_at = null where id = (v_edit.target->>'event_id')::bigint;
  elsif v_edit.action = 'change_actor' then
    update assignments
    set actor_name_raw = v_edit.before->0->>'actor_name_raw',
        actor_id = (v_edit.before->0->>'actor_id')::bigint
    where upload_id = (v_edit.target->>'upload_id')::bigint
      and slot_id = (v_edit.target->>'slot_id')::bigint
      and role_name_raw = v_edit.target->>'role'
      and actor_name_raw = v_edit.after->>'actor_name_raw';

    get diagnostics v_restored = row_count;

    if v_restored = 0 then
      return false;
    end if;
  end if;

  update casting_edits set reverted_at = now(), reverted_by = p_reverted_by
  where id = p_edit_id;

  return true;
end;
$$;

create function revert_notice_edits_of_upload() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform revert_casting_edit(id, null)
  from casting_edits
  where cause_upload_id = old.id and reverted_at is null
  order by id desc;

  return old;
end;
$$;

create trigger uploads_revert_notice_edits
before delete on uploads
for each row execute function revert_notice_edits_of_upload();

revoke execute on function apply_casting_notices(bigint, bigint[], bigint[], jsonb)
  from public, anon, authenticated;
grant execute on function apply_casting_notices(bigint, bigint[], bigint[], jsonb)
  to service_role;

revoke execute on function revert_casting_edit(bigint, uuid)
  from public, anon, authenticated;
grant execute on function revert_casting_edit(bigint, uuid) to service_role;

revoke execute on function revert_notice_edits_of_upload()
  from public, anon, authenticated;
