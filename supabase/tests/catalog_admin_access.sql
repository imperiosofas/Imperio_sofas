begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  null,
  'authenticated',
  'authenticated',
  'aal1-admin-test@example.invalid',
  '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
);
insert into public.catalog_admins(user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set local role anon;
select throws_ok(
  $$select * from public.catalog_admins$$,
  '42501',
  null,
  'anonymous users cannot inspect administrator membership'
);
select throws_ok(
  $$select private.is_catalog_admin()$$,
  '42501',
  null,
  'anonymous users cannot call the membership helper'
);
select throws_ok(
  $$select public.is_email_mfa_verified()$$,
  '42501', null,
  'anonymous users cannot inspect email MFA verification state'
);
select throws_ok(
  $$select * from private.email_mfa_challenges$$,
  '42501', null,
  'anonymous users cannot inspect email MFA challenges'
);
select throws_ok(
  $$select * from public.categories$$,
  '42501', null,
  'anonymous users cannot read categories directly'
);
select throws_ok(
  $$select * from public.products$$,
  '42501', null,
  'anonymous users cannot read products directly'
);
select throws_ok(
  $$select * from public.product_variants$$,
  '42501', null,
  'anonymous users cannot read variants directly'
);
select throws_ok(
  $$select * from public.inventory$$,
  '42501', null,
  'anonymous users cannot read inventory directly'
);
select throws_ok(
  $$select * from public.product_media$$,
  '42501', null,
  'anonymous users cannot read media metadata directly'
);

select throws_ok(
  $$select * from private.catalog_admin_audit$$,
  '42501',
  null,
  'anonymous users cannot inspect the private catalog audit log'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  private.is_catalog_admin(),
  false,
  'an authenticated user without explicit membership is not an administrator'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1","amr":[{"method":"oauth"}]}',
  true
);
select is(
  private.is_catalog_admin(),
  false,
  'an OAuth user without explicit membership is not an administrator'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  (select count(*)::integer from public.products),
  0,
  'a non-admin authenticated user cannot read catalog rows'
);
select throws_ok(
  $$select public.admin_save_catalog_product('{}'::jsonb, '[]'::jsonb)$$,
  '42501',
  null,
  'a non-admin cannot invoke the product mutation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  private.is_catalog_admin(),
  false,
  'AAL2 without explicit membership is not an administrator'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","aal":"aal1"}',
  true
);
select is(
  private.is_catalog_admin(),
  true,
  'an explicitly provisioned administrator has access at AAL1'
);
select throws_ok(
  $$select public.admin_save_catalog_product('{"status":"invalid"}'::jsonb, '[]'::jsonb)$$,
  '22023',
  null,
  'an AAL1 administrator passes the authorization gate for catalog mutations'
);

select throws_ok(
  $$select * from private.catalog_admin_audit$$,
  '42501',
  null,
  'authenticated users cannot inspect the private catalog audit log'
);
select throws_ok(
  $$select public.is_email_mfa_verified()$$,
  '42501',
  null,
  'authenticated users cannot inspect the disabled email MFA state'
);

select * from finish();
rollback;
