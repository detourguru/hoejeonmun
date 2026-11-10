\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000004');
insert into user_shows(id,title,poster_path,period_start,period_end,genre,created_by) values
 ('local-active','공연','active-poster','2026-11-01','2026-12-01','뮤지컬','00000000-0000-4000-8000-000000000004');
insert into uploads(id,show_id,user_id) overriding system value values (401,'show','00000000-0000-4000-8000-000000000004');
insert into upload_images(upload_id,storage_path,position) values (401,'saved-cast',0);
insert into casting_parse_results(user_id,show_id,storage_paths,result) values
 ('00000000-0000-4000-8000-000000000004','show',array['pending-cast'],'{}');
insert into parse_failures(show_id,user_id,storage_path,type) values
 ('show','00000000-0000-4000-8000-000000000004','recent-failure','exception');
insert into storage.objects(bucket_id,name,created_at,updated_at,metadata) values
 ('casting-boards','orphan-cast',now()-interval '8 days',now()-interval '8 days','{"size":123}'),
 ('casting-boards','saved-cast',now()-interval '8 days',now()-interval '8 days','{}'),
 ('casting-boards','pending-cast',now()-interval '8 days',now()-interval '8 days','{}'),
 ('casting-boards','recent-failure',now()-interval '8 days',now()-interval '8 days','{}'),
 ('casting-boards','new-cast',now(),now(),'{}'),
 ('casting-boards','recently-replaced',now()-interval '8 days',now(),'{}'),
 ('show-posters','orphan-poster',now()-interval '8 days',now()-interval '8 days','{}'),
 ('show-posters','active-poster',now()-interval '8 days',now()-interval '8 days','{}'),
 ('poster-thumbnails','orphan-thumb',now()-interval '8 days',now()-interval '8 days','{}'),
 ('bug-report-images','report',now()-interval '8 days',now()-interval '8 days','{}');
do $$ begin
 if (select count(*) from storage_cleanup_candidates(1000)) <> 3 then raise exception 'protected object selected or orphan missed'; end if;
 if not exists(select 1 from storage_cleanup_candidates(1000) where name='orphan-cast' and bytes=123) then raise exception 'orphan not selected'; end if;
 if has_function_privilege('authenticated','public.storage_cleanup_candidates(integer)','execute') or has_function_privilege('anon','public.storage_cleanup_candidates(integer)','execute') then raise exception 'public cleanup access'; end if;
end $$;
rollback;
