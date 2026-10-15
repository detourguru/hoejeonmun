alter table casting_edits
  drop constraint casting_edits_action_check,
  add constraint casting_edits_action_check check (action in (
    'cancel_slot', 'cancel_event', 'change_actor',
    'update_casting', 'add_casting', 'delete_casting',
    'move_slot', 'update_variant', 'update_event'
  ));

create function current_upload_of_slot(p_show_id text, p_slot_id bigint)
returns bigint
language sql
stable
set search_path = public
as $$
  select c.upload_id
  from current_castings c
  join slots s on s.id = c.slot_id
  where c.slot_id = p_slot_id and s.show_id = p_show_id;
$$;

create function correct_casting(
  p_user_id uuid,
  p_show_id text,
  p_slot_id bigint,
  p_all_slots boolean,
  p_role text,
  p_actor text,
  p_new_role text,
  p_new_actor text,
  p_new_actor_id bigint
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_upload_id bigint := current_upload_of_slot(p_show_id, p_slot_id);
  v_before_actor_id bigint;
  v_slot_ids bigint[];
begin
  if v_upload_id is null then
    return jsonb_build_object('status', 'slot_not_found');
  end if;

  select actor_id into v_before_actor_id
  from assignments
  where upload_id = v_upload_id and role_name_raw = p_role and actor_name_raw = p_actor
    and (p_all_slots or slot_id = p_slot_id)
  limit 1;

  with updated as (
    update assignments
    set role_name_raw = p_new_role,
        actor_name_raw = p_new_actor,
        actor_id = p_new_actor_id,
        verified = false
    where upload_id = v_upload_id and role_name_raw = p_role and actor_name_raw = p_actor
      and (p_all_slots or slot_id = p_slot_id)
    returning slot_id
  )
  select array_agg(slot_id order by slot_id) into v_slot_ids from updated;

  if v_slot_ids is null then
    return jsonb_build_object('status', 'role_not_found');
  end if;

  insert into casting_edits (show_id, user_id, source, action, target, before, after)
  values (
    p_show_id, p_user_id, 'correction', 'update_casting',
    jsonb_build_object('upload_id', v_upload_id, 'slot_ids', to_jsonb(v_slot_ids)),
    jsonb_build_object('role', p_role, 'actor_name_raw', p_actor, 'actor_id', v_before_actor_id),
    jsonb_build_object('role', p_new_role, 'actor_name_raw', p_new_actor, 'actor_id', p_new_actor_id)
  );

  return jsonb_build_object('status', 'ok', 'count', cardinality(v_slot_ids));
end;
$$;

create function add_casting(
  p_user_id uuid,
  p_show_id text,
  p_slot_id bigint,
  p_all_slots boolean,
  p_role text,
  p_actor text,
  p_actor_id bigint
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_upload_id bigint := current_upload_of_slot(p_show_id, p_slot_id);
  v_slot_ids bigint[];
begin
  if v_upload_id is null then
    return jsonb_build_object('status', 'slot_not_found');
  end if;

  with targets as (
    select slot_id, max(role_order) as max_order
    from assignments
    where upload_id = v_upload_id and (p_all_slots or slot_id = p_slot_id)
    group by slot_id
  ), inserted as (
    insert into assignments (
      upload_id, slot_id, role_name_raw, actor_name_raw, actor_id,
      upload_image_id, verified, role_order
    )
    select v_upload_id, slot_id, p_role, p_actor, p_actor_id, null, false, max_order + 1
    from targets
    on conflict (upload_id, slot_id, role_name_raw, actor_name_raw) do nothing
    returning slot_id
  )
  select array_agg(slot_id order by slot_id) into v_slot_ids from inserted;

  if v_slot_ids is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into casting_edits (show_id, user_id, source, action, target, after)
  values (
    p_show_id, p_user_id, 'correction', 'add_casting',
    jsonb_build_object('upload_id', v_upload_id, 'slot_ids', to_jsonb(v_slot_ids)),
    jsonb_build_object('role', p_role, 'actor_name_raw', p_actor, 'actor_id', p_actor_id)
  );

  return jsonb_build_object('status', 'ok', 'count', cardinality(v_slot_ids));
end;
$$;

create function delete_casting(
  p_user_id uuid,
  p_show_id text,
  p_slot_id bigint,
  p_all_slots boolean,
  p_role text,
  p_actor text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_upload_id bigint := current_upload_of_slot(p_show_id, p_slot_id);
  v_rows jsonb;
begin
  if v_upload_id is null then
    return jsonb_build_object('status', 'slot_not_found');
  end if;

  with deleted as (
    delete from assignments
    where upload_id = v_upload_id and role_name_raw = p_role and actor_name_raw = p_actor
      and (p_all_slots or slot_id = p_slot_id)
    returning slot_id, role_name_raw, actor_name_raw, actor_id, upload_image_id, verified, role_order
  )
  select jsonb_agg(to_jsonb(d) order by d.slot_id) into v_rows from deleted d;

  if v_rows is null then
    return jsonb_build_object('status', 'role_not_found');
  end if;

  insert into casting_edits (show_id, user_id, source, action, target, before)
  values (
    p_show_id, p_user_id, 'correction', 'delete_casting',
    jsonb_build_object(
      'upload_id', v_upload_id,
      'slot_ids', (select jsonb_agg(distinct r->'slot_id') from jsonb_array_elements(v_rows) r)
    ),
    jsonb_build_object('rows', v_rows)
  );

  return jsonb_build_object(
    'status', 'ok',
    'count', jsonb_array_length(v_rows),
    'upload_id', v_upload_id
  );
end;
$$;

create function move_slot_casting(
  p_user_id uuid,
  p_show_id text,
  p_slot_id bigint,
  p_date date,
  p_time time
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_upload_id bigint := current_upload_of_slot(p_show_id, p_slot_id);
  v_new_slot_id bigint;
begin
  if v_upload_id is null then
    return jsonb_build_object('status', 'slot_not_found');
  end if;

  insert into slots (show_id, date, time) values (p_show_id, p_date, p_time)
  on conflict (show_id, date, time) do nothing;

  select id into v_new_slot_id from slots
  where show_id = p_show_id and date = p_date and time = p_time;

  if v_new_slot_id = p_slot_id then
    return jsonb_build_object('status', 'ok');
  end if;

  update assignments set slot_id = v_new_slot_id
  where upload_id = v_upload_id and slot_id = p_slot_id;

  update slot_variants set slot_id = v_new_slot_id
  where upload_id = v_upload_id and slot_id = p_slot_id
    and not exists (
      select 1 from slot_variants where upload_id = v_upload_id and slot_id = v_new_slot_id
    );

  insert into casting_edits (show_id, user_id, source, action, target, before, after)
  values (
    p_show_id, p_user_id, 'correction', 'move_slot',
    jsonb_build_object('upload_id', v_upload_id),
    jsonb_build_object('slot_id', p_slot_id),
    jsonb_build_object('slot_id', v_new_slot_id)
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

create function set_slot_variant(
  p_user_id uuid,
  p_show_id text,
  p_slot_id bigint,
  p_label text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_upload_id bigint := current_upload_of_slot(p_show_id, p_slot_id);
  v_before text;
begin
  if v_upload_id is null then
    return jsonb_build_object('status', 'slot_not_found');
  end if;

  select label into v_before from slot_variants
  where upload_id = v_upload_id and slot_id = p_slot_id;

  if v_before is not distinct from p_label then
    return jsonb_build_object('status', 'ok');
  end if;

  insert into slot_variants (upload_id, slot_id, label)
  values (v_upload_id, p_slot_id, p_label)
  on conflict (upload_id, slot_id) do update set label = excluded.label;

  insert into casting_edits (show_id, user_id, source, action, target, before, after)
  values (
    p_show_id, p_user_id, 'correction', 'update_variant',
    jsonb_build_object('upload_id', v_upload_id, 'slot_id', p_slot_id),
    jsonb_build_object('label', v_before),
    jsonb_build_object('label', p_label)
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

create function update_event_text(
  p_user_id uuid,
  p_show_id text,
  p_event_id bigint,
  p_title text,
  p_description text,
  p_period_start date,
  p_period_end date,
  p_slot_ids bigint[]
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_event events;
  v_before_slot_ids bigint[];
  v_after_slot_ids bigint[];
begin
  select * into v_event from events where id = p_event_id and show_id = p_show_id;

  if not found then
    return jsonb_build_object('status', 'event_not_found');
  end if;

  select coalesce(array_agg(slot_id order by slot_id), '{}') into v_before_slot_ids
  from event_slots where event_id = p_event_id;

  select coalesce(array_agg(id order by id), '{}') into v_after_slot_ids
  from slots where id = any(p_slot_ids) and show_id = p_show_id;

  update events
  set title = p_title,
      description = p_description,
      period_start = p_period_start,
      period_end = p_period_end,
      edited_by = p_user_id
  where id = p_event_id;

  delete from event_slots where event_id = p_event_id;

  insert into event_slots (event_id, slot_id)
  select p_event_id, unnest(v_after_slot_ids);

  insert into casting_edits (show_id, user_id, source, action, target, before, after)
  values (
    p_show_id, p_user_id, 'correction', 'update_event',
    jsonb_build_object('event_id', p_event_id),
    jsonb_build_object(
      'title', v_event.title,
      'description', v_event.description,
      'period_start', v_event.period_start,
      'period_end', v_event.period_end,
      'slot_ids', to_jsonb(v_before_slot_ids)
    ),
    jsonb_build_object(
      'title', p_title,
      'description', p_description,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'slot_ids', to_jsonb(v_after_slot_ids)
    )
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function revert_casting_edit(p_edit_id bigint, p_reverted_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edit casting_edits;
  v_slot_ids bigint[];
  v_restored int := 1;
begin
  select * into v_edit from casting_edits
  where id = p_edit_id and reverted_at is null
  for update;

  if not found then
    return false;
  end if;

  select array_agg(value::bigint) into v_slot_ids
  from jsonb_array_elements_text(coalesce(v_edit.target->'slot_ids', '[]'));

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
  elsif v_edit.action = 'update_casting' then
    update assignments
    set role_name_raw = v_edit.before->>'role',
        actor_name_raw = v_edit.before->>'actor_name_raw',
        actor_id = (v_edit.before->>'actor_id')::bigint
    where upload_id = (v_edit.target->>'upload_id')::bigint
      and slot_id = any(v_slot_ids)
      and role_name_raw = v_edit.after->>'role'
      and actor_name_raw = v_edit.after->>'actor_name_raw';

    get diagnostics v_restored = row_count;
  elsif v_edit.action = 'add_casting' then
    delete from assignments
    where upload_id = (v_edit.target->>'upload_id')::bigint
      and slot_id = any(v_slot_ids)
      and role_name_raw = v_edit.after->>'role'
      and actor_name_raw = v_edit.after->>'actor_name_raw';

    get diagnostics v_restored = row_count;
  elsif v_edit.action = 'delete_casting' then
    insert into assignments (
      upload_id, slot_id, role_name_raw, actor_name_raw, actor_id,
      upload_image_id, verified, role_order
    )
    select (v_edit.target->>'upload_id')::bigint, r.slot_id, r.role_name_raw, r.actor_name_raw,
      r.actor_id, r.upload_image_id, r.verified, r.role_order
    from jsonb_to_recordset(v_edit.before->'rows') as r(
      slot_id bigint, role_name_raw text, actor_name_raw text, actor_id bigint,
      upload_image_id bigint, verified boolean, role_order integer
    )
    where exists (select 1 from uploads where id = (v_edit.target->>'upload_id')::bigint)
      and exists (select 1 from slots where id = r.slot_id)
    on conflict (upload_id, slot_id, role_name_raw, actor_name_raw) do nothing;

    get diagnostics v_restored = row_count;
  elsif v_edit.action = 'move_slot' then
    update assignments set slot_id = (v_edit.before->>'slot_id')::bigint
    where upload_id = (v_edit.target->>'upload_id')::bigint
      and slot_id = (v_edit.after->>'slot_id')::bigint;

    get diagnostics v_restored = row_count;

    update slot_variants set slot_id = (v_edit.before->>'slot_id')::bigint
    where upload_id = (v_edit.target->>'upload_id')::bigint
      and slot_id = (v_edit.after->>'slot_id')::bigint
      and not exists (
        select 1 from slot_variants
        where upload_id = (v_edit.target->>'upload_id')::bigint
          and slot_id = (v_edit.before->>'slot_id')::bigint
      );
  elsif v_edit.action = 'update_variant' then
    if v_edit.before->>'label' is null then
      delete from slot_variants
      where upload_id = (v_edit.target->>'upload_id')::bigint
        and slot_id = (v_edit.target->>'slot_id')::bigint
        and label = v_edit.after->>'label';
    else
      update slot_variants set label = v_edit.before->>'label'
      where upload_id = (v_edit.target->>'upload_id')::bigint
        and slot_id = (v_edit.target->>'slot_id')::bigint
        and label = v_edit.after->>'label';
    end if;

    get diagnostics v_restored = row_count;
  elsif v_edit.action = 'update_event' then
    update events
    set title = v_edit.before->>'title',
        description = v_edit.before->>'description',
        period_start = (v_edit.before->>'period_start')::date,
        period_end = (v_edit.before->>'period_end')::date
    where id = (v_edit.target->>'event_id')::bigint
      and title = v_edit.after->>'title'
      and description is not distinct from v_edit.after->>'description'
      and period_start = (v_edit.after->>'period_start')::date
      and period_end = (v_edit.after->>'period_end')::date;

    get diagnostics v_restored = row_count;

    if v_restored > 0 then
      delete from event_slots where event_id = (v_edit.target->>'event_id')::bigint;

      insert into event_slots (event_id, slot_id)
      select (v_edit.target->>'event_id')::bigint, s.id
      from slots s
      where s.id in (
        select value::bigint from jsonb_array_elements_text(v_edit.before->'slot_ids')
      );
    end if;
  end if;

  if v_restored = 0 then
    return false;
  end if;

  update casting_edits set reverted_at = now(), reverted_by = p_reverted_by
  where id = p_edit_id;

  return true;
end;
$$;

revoke execute on function current_upload_of_slot(text, bigint) from public, anon, authenticated;
revoke execute on function correct_casting(uuid, text, bigint, boolean, text, text, text, text, bigint)
  from public, anon, authenticated;
revoke execute on function add_casting(uuid, text, bigint, boolean, text, text, bigint)
  from public, anon, authenticated;
revoke execute on function delete_casting(uuid, text, bigint, boolean, text, text)
  from public, anon, authenticated;
revoke execute on function move_slot_casting(uuid, text, bigint, date, time)
  from public, anon, authenticated;
revoke execute on function set_slot_variant(uuid, text, bigint, text)
  from public, anon, authenticated;
revoke execute on function update_event_text(uuid, text, bigint, text, text, date, date, bigint[])
  from public, anon, authenticated;

grant execute on function current_upload_of_slot(text, bigint) to service_role;
grant execute on function correct_casting(uuid, text, bigint, boolean, text, text, text, text, bigint)
  to service_role;
grant execute on function add_casting(uuid, text, bigint, boolean, text, text, bigint)
  to service_role;
grant execute on function delete_casting(uuid, text, bigint, boolean, text, text)
  to service_role;
grant execute on function move_slot_casting(uuid, text, bigint, date, time) to service_role;
grant execute on function set_slot_variant(uuid, text, bigint, text) to service_role;
grant execute on function update_event_text(uuid, text, bigint, text, text, date, date, bigint[])
  to service_role;
