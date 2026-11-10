\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000003');
insert into user_shows(id,title,poster_path,period_start,period_end,genre,venue,created_by) values
 ('local-from','페이티드','p','2026-11-01','2026-12-01','뮤지컬','venue','00000000-0000-4000-8000-000000000003'),
 ('local-to','FATED','p','2026-11-01','2026-12-01','뮤지컬','venue','00000000-0000-4000-8000-000000000003');
insert into uploads(id,show_id,user_id) overriding system value values
 (201,'local-from','00000000-0000-4000-8000-000000000003'),(202,'local-to','00000000-0000-4000-8000-000000000003');
insert into upload_images(id,upload_id,show_id,storage_path,image_hash,position) overriding system value values
 (201,201,'local-from','image1','same-hash',0),(202,202,'local-to','image2','same-hash',0);
insert into slots(id,show_id,date,time) overriding system value values
 (201,'local-from','2026-11-10','19:30'),(202,'local-to','2026-11-10','19:30');
insert into assignments(upload_id,slot_id,role_name_raw,actor_name_raw,upload_image_id,role_order) values
 (201,201,'role','actor',201,0),(202,202,'role','other',202,0);
insert into slot_variants(upload_id,slot_id,label) values (201,201,'ROOM 서울');
insert into my_slots(user_id,slot_id) values ('00000000-0000-4000-8000-000000000003',201),('00000000-0000-4000-8000-000000000003',202);
insert into casting_edits(show_id,user_id,source,action,target) values ('local-from','00000000-0000-4000-8000-000000000003','notice','cancel_slot','{"slot_id":201}');

do $$ begin
  begin
    perform merge_user_show('local-from','local-to');
    raise exception 'duplicate image hash should abort';
  exception when unique_violation then null; end;
  if not exists(select 1 from slots where id=201) or not exists(select 1 from slot_variants where slot_id=201) then raise exception 'merge failure lost data'; end if;
  if exists(select 1 from show_redirects) then raise exception 'merge failure leaked redirect'; end if;
end $$;
update upload_images set image_hash='different' where id=201;
select merge_user_show('local-from','local-to');
do $$ begin
  if exists(select 1 from user_shows where id='local-from') then raise exception 'source still exists'; end if;
  if not exists(select 1 from slot_variants where slot_id=202 and label='ROOM 서울') then raise exception 'variant lost'; end if;
  if (select count(*) from assignments where slot_id=202) <> 2 then raise exception 'cast lost'; end if;
  if (select count(*) from my_slots where slot_id=202) <> 1 then raise exception 'bookmark lost'; end if;
  if not exists(select 1 from casting_edits where show_id='local-to' and target->>'slot_id'='202') then raise exception 'history lost'; end if;
  if not exists(select 1 from show_redirects where from_show_id='local-from' and to_show_id='local-to') then raise exception 'redirect missing'; end if;
end $$;
rollback;
