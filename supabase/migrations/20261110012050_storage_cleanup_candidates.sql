-- Read Storage metadata only. Actual deletion must go through the Storage API.
create function public.storage_cleanup_candidates(p_limit integer default 500)
returns table(bucket_id text, name text, bytes bigint)
language sql stable security invoker set search_path = public, storage
as $$
  select o.bucket_id, o.name, coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where greatest(o.created_at, o.updated_at) < now() - interval '7 days'
    and (
      (o.bucket_id = 'casting-boards'
        and not exists (select 1 from public.upload_images i where i.storage_path = o.name)
        and not exists (select 1 from public.casting_parse_results p where o.name = any(p.storage_paths))
        and not exists (select 1 from public.parse_failures f where f.storage_path = o.name
          and f.image_purged_at is null and f.created_at > now() - interval '7 days'))
      or (o.bucket_id = 'show-posters'
        and not exists (select 1 from public.user_shows s where s.poster_path = o.name)
        and not exists (select 1 from public.poster_thumbnails t where t.source_url like '%/show-posters/' || o.name))
      or (o.bucket_id = 'poster-thumbnails'
        and not exists (select 1 from public.poster_thumbnails t where t.path = o.name))
    )
  order by o.created_at, o.bucket_id, o.name
  limit least(greatest(p_limit, 0), 1000);
$$;
revoke execute on function public.storage_cleanup_candidates(integer) from public, anon, authenticated;
grant execute on function public.storage_cleanup_candidates(integer) to service_role;
