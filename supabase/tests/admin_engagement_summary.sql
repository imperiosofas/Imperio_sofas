begin;
select plan(5);

select has_function(
  'public',
  'admin_get_engagement_summary',
  array[]::text[],
  'engagement summary function exists'
);

select is(
  (select p.prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_get_engagement_summary'),
  true,
  'engagement summary runs as definer so it can aggregate private favorites'
);

select is(
  has_function_privilege('anon', 'public.admin_get_engagement_summary()', 'execute'),
  false,
  'anonymous visitors cannot execute the engagement summary'
);

select is(
  has_function_privilege('authenticated', 'public.admin_get_engagement_summary()', 'execute'),
  true,
  'authenticated callers reach the admin check inside the function'
);

select is(
  (select p.proconfig::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_get_engagement_summary'),
  '{search_path=""}',
  'engagement summary pins an empty search_path'
);

select * from finish();
rollback;
