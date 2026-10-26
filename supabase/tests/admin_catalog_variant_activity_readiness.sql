begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.categories (id, name, slug, position, is_active)
values (
  'c9000000-0000-4000-8000-000000000001',
  'TEST Admin Readiness',
  'test-admin-readiness-20261015',
  990,
  true
);

insert into public.products (id, category_id, name, slug, status)
values
  ('a9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 'TEST inactive-only', 'test-readiness-inactive-only', 'draft'),
  ('a9000000-0000-4000-8000-000000000002', 'c9000000-0000-4000-8000-000000000001', 'TEST mixed variants', 'test-readiness-mixed', 'draft'),
  ('a9000000-0000-4000-8000-000000000003', 'c9000000-0000-4000-8000-000000000001', 'TEST active missing stock', 'test-readiness-active-incomplete', 'draft'),
  ('a9000000-0000-4000-8000-000000000004', 'c9000000-0000-4000-8000-000000000001', 'TEST publishable', 'test-readiness-publishable', 'draft');

insert into public.product_variants (id, product_id, sku, width_mm, price_cents, is_active)
values
  ('b9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'TEST-READ-INACTIVE', 2000, 250000, false),
  ('b9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000002', 'TEST-READ-MIX-ACTIVE', 2000, 250000, true),
  ('b9000000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-000000000002', 'TEST-READ-MIX-INACTIVE', 2200, 270000, false),
  ('b9000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000003', 'TEST-READ-NO-STOCK', 2000, 250000, true),
  ('b9000000-0000-4000-8000-000000000005', 'a9000000-0000-4000-8000-000000000004', 'TEST-READ-READY', 2000, 250000, true);

insert into public.inventory (variant_id, on_hand, reserved, low_stock_threshold)
values
  ('b9000000-0000-4000-8000-000000000001', 4, 0, 2),
  ('b9000000-0000-4000-8000-000000000003', 4, 0, 2),
  ('b9000000-0000-4000-8000-000000000005', 4, 0, 2);

insert into public.product_media (product_id, storage_path, alt_text, position)
values
  ('a9000000-0000-4000-8000-000000000001', 'test/admin-readiness/inactive-only.webp', 'TEST imagem inactive-only', 0),
  ('a9000000-0000-4000-8000-000000000002', 'test/admin-readiness/mixed.webp', 'TEST imagem mixed', 0),
  ('a9000000-0000-4000-8000-000000000003', 'test/admin-readiness/incomplete.webp', 'TEST imagem incomplete', 0),
  ('a9000000-0000-4000-8000-000000000004', 'test/admin-readiness/publishable.webp', 'TEST imagem publishable', 0);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values (
  'd9000000-0000-4000-8000-000000000001',
  null,
  'authenticated',
  'authenticated',
  'admin-readiness-test@example.invalid',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
);

insert into public.catalog_admins (user_id)
values ('d9000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-inactive-only', p_pending => 'pending')->>'total')::integer,
  1,
  'product with only inactive but otherwise sellable variants is pending'
);
select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-inactive-only', p_pending => 'ready')->>'total')::integer,
  0,
  'inactive-only product is not marked ready'
);

select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-mixed', p_pending => 'pending')->>'total')::integer,
  1,
  'inactive eligible variant cannot make a mixed product ready when active variant lacks stock'
);
select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-mixed', p_pending => 'ready')->>'total')::integer,
  0,
  'mixed product is not ready based only on its inactive variant'
);

select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-active-incomplete', p_pending => 'pending')->>'total')::integer,
  1,
  'active variant without available inventory does not satisfy publication readiness'
);
select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-active-incomplete', p_pending => 'ready')->>'total')::integer,
  0,
  'active but commercially incomplete product is not marked ready'
);

select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-publishable', p_pending => 'ready')->>'total')::integer,
  1,
  'active priced variant with stock, active category, and alt text is ready'
);
select is(
  (public.admin_list_catalog_products(p_query => 'test-readiness-publishable', p_pending => 'pending')->>'total')::integer,
  0,
  'publishable product is excluded from pending'
);

reset role;
select * from finish();
rollback;
