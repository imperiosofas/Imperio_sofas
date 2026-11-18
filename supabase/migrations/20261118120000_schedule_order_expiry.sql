-- Releases stock held by unpaid orders every 5 minutes, inside the database.
-- Independent of the Vercel plan (Hobby crons run once a day) and of CRON_SECRET.
-- expire_pending_orders() is idempotent and uses skip locked.
create extension if not exists pg_cron with schema pg_catalog;

do $schedule$
begin
  if exists (select 1 from cron.job where jobname = 'expire-pending-orders') then
    perform cron.unschedule('expire-pending-orders');
  end if;
  perform cron.schedule(
    'expire-pending-orders',
    '*/5 * * * *',
    'select public.expire_pending_orders();'
  );
end;
$schedule$;
