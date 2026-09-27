-- غَرْسة — scheduled jobs (replaces scheduledCleanup + leaderboardRefresh).
-- Storage objects can't be deleted from SQL: the daily job calls the
-- `storage-cleanup` Edge Function through pg_net with a shared secret kept in
-- Vault (`project_url`, `cron_secret` — set once per project, see docs/supabase-migration.md).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('gharsah-leaderboard', '*/30 * * * *', $$select public.refresh_leaderboard()$$);

-- 03:00 Riyadh = 00:00 UTC.
select cron.schedule('gharsah-daily-cleanup', '0 0 * * *', $$select public.daily_cleanup()$$);

select cron.schedule('gharsah-storage-cleanup', '15 0 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
$$);
