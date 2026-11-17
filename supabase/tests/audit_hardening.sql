-- pgTAP checks for 20261117120000_audit_hardening_withdrawal_and_review.sql.
-- Run with `npm run db:test` (needs the local Supabase stack).
begin;
select plan(12);

select has_column('public', 'orders', 'withdrawal_requested_at', 'orders has withdrawal_requested_at');
select has_column('public', 'orders', 'withdrawal_reason', 'orders has withdrawal_reason');

select has_function('public', 'request_order_withdrawal', array['uuid', 'text']);
select has_function('public', 'admin_register_order_refund', array['uuid', 'text', 'boolean']);
select has_function('public', 'admin_close_needs_review_order', array['uuid', 'text', 'boolean']);

select ok(
  not has_function_privilege('anon', 'public.request_order_withdrawal(uuid, text)', 'execute'),
  'anon cannot request a withdrawal'
);
select ok(
  not has_function_privilege('anon', 'public.admin_register_order_refund(uuid, text, boolean)', 'execute'),
  'anon cannot register refunds'
);

-- Reviews are read through SECURITY DEFINER functions only.
select ok(
  not has_table_privilege('anon', 'public.product_reviews', 'select'),
  'anon cannot select product_reviews directly'
);
select policies_are(
  'public', 'product_reviews',
  array['customers can read own review', 'catalog admins can read reviews'],
  'published-reviews policy removed'
);

select ok(
  not has_table_privilege('authenticated', 'public.customer_profiles', 'delete'),
  'authenticated cannot delete customer_profiles'
);
select ok(
  not has_table_privilege('authenticated', 'public.customer_profiles', 'truncate'),
  'authenticated cannot truncate customer_profiles'
);

-- A non-admin calling the admin function is refused.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a0d1","role":"authenticated"}';
select throws_ok(
  $$select public.admin_register_order_refund(gen_random_uuid(), 'teste', false)$$,
  '42501',
  'forbidden',
  'non-admin cannot register a refund'
);
reset role;

select * from finish();
rollback;
