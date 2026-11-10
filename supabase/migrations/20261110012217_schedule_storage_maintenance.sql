-- Requires the dedicated token to be provisioned in Vault and the authenticated
-- storage-maintenance function to be deployed first. No token is stored in SQL.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'storage_maintenance_token') then
    raise exception 'Provision storage_maintenance_token in Vault before scheduling';
  end if;
  perform cron.schedule(
    'storage-orphan-cleanup-daily',
    '45 19 * * *', -- UTC 19:45, KST 04:45
    $job$
      select net.http_post(
        url := 'https://aiifhuwfhiwtsnjenlae.supabase.co/functions/v1/storage-maintenance',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'storage_maintenance_token')
        ),
        body := '{"action":"cleanup"}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$
  );
end;
$$;
