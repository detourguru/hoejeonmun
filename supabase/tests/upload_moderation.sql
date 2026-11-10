\set ON_ERROR_STOP on
begin;
insert into auth.users (id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003');
insert into admins(user_id) values ('00000000-0000-4000-8000-000000000001');
insert into uploads(id, show_id, user_id) overriding system value values
 (101,'show1','00000000-0000-4000-8000-000000000002'),
 (102,'show2','00000000-0000-4000-8000-000000000002'),
 (103,'show1','00000000-0000-4000-8000-000000000003');
insert into upload_images(id,upload_id,storage_path,position) overriding system value values
 (101,101,'image1',0),(102,102,'image2',0),(103,103,'image3',0);
insert into slots(id,show_id,date,time) overriding system value values (101,'show1','2026-11-10','19:30');
insert into assignments(upload_id,slot_id,role_name_raw,actor_name_raw,upload_image_id) values
 (101,101,'role','actor',101),(103,101,'role','other',103);
insert into my_slots(user_id,slot_id) values ('00000000-0000-4000-8000-000000000003',101);

do $$ begin
  begin
    perform moderate_upload('00000000-0000-4000-8000-000000000003',101,false,false,'reason',array[101]::bigint[]);
    raise exception 'nonadmin unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform moderate_upload('00000000-0000-4000-8000-000000000001',101,true,true,'reason',array[101]::bigint[]);
    raise exception 'stale preview unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'preview_changed' then raise; end if;
  end;
  if (select count(*) from uploads) <> 3 or exists(select 1 from upload_bans) or exists(select 1 from upload_moderation_log) then
    raise exception 'failed transaction leaked changes';
  end if;
end $$;

select apply_casting_notices(101, '{}'::bigint[], '{}'::bigint[], '[{"upload_id":103,"slot_id":101,"role":"role","actor":"changed","actor_id":null}]'::jsonb);

select moderate_upload('00000000-0000-4000-8000-000000000001',101,false,true,'reason',array[101]::bigint[]);
do $$ begin
  if not exists(select 1 from uploads where id=102) or not exists(select 1 from assignments where upload_id=103)
     or not exists(select 1 from my_slots where slot_id=101) then raise exception 'unrelated data removed'; end if;
  if not exists(select 1 from assignments where upload_id=103 and actor_name_raw='other') then raise exception 'notice effect not restored'; end if;
  if (select count(*) from upload_storage_cleanup) <> 1 then raise exception 'cleanup not queued'; end if;
  begin
    insert into uploads(show_id,user_id) values('show','00000000-0000-4000-8000-000000000002');
    raise exception 'banned upload succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if not is_upload_banned() then raise exception 'self ban lookup failed'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('casting-boards','00000000-0000-4000-8000-000000000002/image');
    raise exception 'banned storage upload succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform moderate_upload('00000000-0000-4000-8000-000000000001',102,false,false,'reason',array[102]::bigint[]);
    raise exception 'direct authenticated RPC succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select unban_upload_user('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','unban reason');
insert into uploads(show_id,user_id) values('show','00000000-0000-4000-8000-000000000002');
do $$ begin
  if exists(select 1 from upload_bans) then raise exception 'unban failed'; end if;
  if (select count(*) from upload_moderation_log) <> 2 then raise exception 'audit missing'; end if;
end $$;

-- Simulate a failure halfway through deletion: ban, audit and cleanup must roll back too.
create function pg_temp.fail_delete() returns trigger language plpgsql as $$ begin raise exception 'test_failure'; end $$;
create trigger test_fail_delete before delete on uploads for each row execute function pg_temp.fail_delete();
do $$ begin
  begin
    perform moderate_upload('00000000-0000-4000-8000-000000000001',102,false,true,'reason',array[102]::bigint[]);
    raise exception 'expected failure missing';
  exception when raise_exception then if sqlerrm <> 'test_failure' then raise; end if; end;
  if exists(select 1 from upload_bans) or (select count(*) from upload_moderation_log) <> 2 then raise exception 'deletion failure leaked changes'; end if;
end $$;
drop trigger test_fail_delete on uploads;
select moderate_upload('00000000-0000-4000-8000-000000000001',102,true,false,'all uploads',
  array(select id from uploads where user_id='00000000-0000-4000-8000-000000000002' order by id));
do $$ begin
  if exists(select 1 from uploads where user_id='00000000-0000-4000-8000-000000000002') then raise exception 'bulk deletion incomplete'; end if;
  if exists(select 1 from upload_bans) then raise exception 'bulk deletion implicitly banned'; end if;
  if not exists(select 1 from uploads where id=103) then raise exception 'other user upload removed'; end if;
end $$;
rollback;

