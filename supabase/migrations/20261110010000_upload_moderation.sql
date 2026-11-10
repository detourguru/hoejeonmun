-- #141: 업로드 밴은 로그인/정정/신고 권한과 별개다.
create table upload_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  moderator_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table upload_moderation_log (
  id bigint generated always as identity primary key,
  moderator_id uuid not null,
  target_user_id uuid not null,
  target_upload_id bigint,
  action text not null check (action in ('delete', 'unban')),
  all_uploads boolean not null default false,
  banned boolean not null default false,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  upload_ids bigint[] not null default '{}',
  show_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table upload_storage_cleanup (
  id bigint generated always as identity primary key,
  moderation_id bigint not null references upload_moderation_log(id),
  storage_paths text[] not null,
  last_error text,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table upload_bans enable row level security;
alter table upload_moderation_log enable row level security;
alter table upload_storage_cleanup enable row level security;
grant all on upload_bans, upload_moderation_log, upload_storage_cleanup to service_role;
grant usage, select on sequence upload_moderation_log_id_seq, upload_storage_cleanup_id_seq to service_role;

create function is_upload_banned() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from upload_bans where user_id = auth.uid()); $$;
revoke execute on function is_upload_banned() from public, anon;
grant execute on function is_upload_banned() to authenticated;

-- Restrictive policy keeps the existing path/owner rules in force too.
create policy "banned users cannot upload casting boards" on storage.objects
as restrictive for insert to authenticated
with check (bucket_id <> 'casting-boards' or not public.is_upload_banned());

-- DB enforcement also covers service-role upload paths and a ban/save race.
create function reject_banned_upload() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 141));
  if exists (select 1 from upload_bans where user_id = new.user_id) then
    raise exception 'upload_banned' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger uploads_check_ban before insert on uploads
for each row execute function reject_banned_upload();
revoke execute on function reject_banned_upload() from public, anon, authenticated;

-- Called only with the authenticated moderator ID verified by the server action.
create function moderate_upload(
  p_moderator_id uuid, p_upload_id bigint, p_all boolean, p_ban boolean,
  p_reason text, p_expected_ids bigint[]
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_ids bigint[];
  v_shows text[];
  v_paths text[];
  v_log_id bigint;
begin
  if not exists (select 1 from admins where user_id = p_moderator_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then
    raise exception 'reason_required';
  end if;
  select user_id into v_owner from uploads where id = p_upload_id;
  if not found then raise exception 'upload_not_found'; end if;
  if v_owner = p_moderator_id then raise exception 'use_own_upload_delete'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 141));
  perform id from uploads where user_id = v_owner and (p_all or id = p_upload_id)
    order by id for update;
  select array_agg(id order by id), array_agg(distinct show_id)
    into v_ids, v_shows from uploads
    where user_id = v_owner and (p_all or id = p_upload_id);
  if v_ids is null or p_expected_ids is null or
    v_ids <> array(select unnest(p_expected_ids) order by 1) then
    raise exception 'preview_changed';
  end if;
  select array_agg(distinct storage_path) into v_paths from upload_images
    where upload_id = any(v_ids);
  insert into upload_moderation_log
    (moderator_id, target_user_id, target_upload_id, action, all_uploads, banned, reason, upload_ids, show_ids)
  values (p_moderator_id, v_owner, p_upload_id, 'delete', p_all, p_ban, trim(p_reason), v_ids, v_shows)
  returning id into v_log_id;
  if p_ban then
    insert into upload_bans (user_id, moderator_id, reason)
    values (v_owner, p_moderator_id, trim(p_reason))
    on conflict (user_id) do update set moderator_id = excluded.moderator_id,
      reason = excluded.reason, created_at = now();
  end if;
  -- uploads_revert_notice_edits restores effects on other contributors first.
  -- Shared slots/event groups are deliberately retained (bookmarks/other uploads).
  delete from uploads where id = any(v_ids);
  if cardinality(v_paths) > 0 then
    insert into upload_storage_cleanup (moderation_id, storage_paths) values (v_log_id, v_paths);
  end if;
  return jsonb_build_object('id', v_log_id, 'showIds', v_shows, 'deleted', cardinality(v_ids));
end;
$$;
create function unban_upload_user(p_moderator_id uuid, p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = p_moderator_id) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 1000 then raise exception 'reason_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 141));
  delete from upload_bans where user_id = p_user_id;
  if found then
    insert into upload_moderation_log (moderator_id, target_user_id, action, reason)
    values (p_moderator_id, p_user_id, 'unban', trim(p_reason));
  end if;
end;
$$;
revoke execute on function moderate_upload(uuid, bigint, boolean, boolean, text, bigint[]),
  unban_upload_user(uuid, uuid, text) from public, anon, authenticated;
grant execute on function moderate_upload(uuid, bigint, boolean, boolean, text, bigint[]),
  unban_upload_user(uuid, uuid, text) to service_role;
