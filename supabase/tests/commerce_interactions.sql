begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-commerce-a@example.invalid', '{"full_name":"Cliente A"}'),
  ('b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-commerce-b@example.invalid', '{"full_name":"Cliente B"}');
insert into public.products (id, category_id, name, slug)
select 'c3333333-3333-4333-8333-333333333333', id, 'TEST Commerce Sofa', 'test-commerce-sofa'
from public.categories where slug = 'sofas';
insert into public.products (id, category_id, name, slug)
select 'd4444444-4444-4444-8444-444444444444', id, 'TEST Commerce Draft', 'test-commerce-draft'
from public.categories where slug = 'sofas';
insert into public.product_variants (id, product_id, sku, width_mm, price_cents, is_active)
values
  ('e5555555-5555-4555-8555-555555555555', 'c3333333-3333-4333-8333-333333333333', 'TEST-COMMERCE-A', 2200, 349000, true),
  ('f6666666-6666-4666-8666-666666666666', 'd4444444-4444-4444-8444-444444444444', 'TEST-COMMERCE-D', 2400, 400000, true);
insert into public.inventory (variant_id, on_hand) values
  ('e5555555-5555-4555-8555-555555555555', 4),
  ('f6666666-6666-4666-8666-666666666666', 4);
insert into public.product_media (product_id, storage_path, alt_text)
values ('c3333333-3333-4333-8333-333333333333', 'test/commerce.webp', 'TEST Sofa');
update public.products set status = 'active' where slug = 'test-commerce-sofa';

set local role anon;
select ok(public.get_catalog_product_detail('test-commerce-sofa') is not null, 'published detail is visible');
select is(public.get_catalog_product_detail('test-commerce-draft'), null::jsonb, 'draft detail is hidden');
select throws_ok($$select * from public.product_favorites$$, '42501', null, 'anon cannot read favorites');
select throws_ok($$select public.get_my_cart()$$, '42501', null, 'anon cannot read a cart');
select throws_ok($$select public.save_product_review('c3333333-3333-4333-8333-333333333333', 5, null)$$, '42501', null, 'anon cannot write a review');

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
set local role authenticated;
insert into public.product_favorites(user_id, product_id)
values ('a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333');
select is((select count(*)::integer from public.product_favorites), 1, 'owner sees own favorite');
select is(jsonb_array_length(public.get_my_favorite_products()), 1, 'favorite listing includes saved product');
select throws_ok($$insert into public.product_favorites(user_id, product_id)
  values ('b2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333')$$,
  '42501', null, 'owner cannot create another users favorite');
select public.save_product_review('c3333333-3333-4333-8333-333333333333', 5, null);
select public.set_cart_item('e5555555-5555-4555-8555-555555555555', 2);
select is((public.get_my_cart() #>> '{0,quantity}')::integer, 2, 'cart quantity persists');
select is((public.get_my_cart() #>> '{0,price_cents}')::integer, 349000, 'cart price comes from variant');
select throws_ok($$select public.set_cart_item('f6666666-6666-4666-8666-666666666666', 1)$$,
  'P0001', 'item unavailable', 'draft variant cannot be added');
select throws_ok($$select public.set_cart_item('e5555555-5555-4555-8555-555555555555', 5)$$,
  'P0001', 'item unavailable', 'quantity cannot exceed stock');
reset role;
select is((select reserved from public.inventory where variant_id = 'e5555555-5555-4555-8555-555555555555'), 0,
  'cart does not reserve inventory');
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is((select count(*)::integer from public.product_favorites), 0, 'other user cannot read favorite');
select is(public.get_my_favorite_products(), '[]'::jsonb, 'other user cannot read favorite listing');
select is(public.get_my_cart(), '[]'::jsonb, 'other user cannot read cart');
select public.save_product_review('c3333333-3333-4333-8333-333333333333', 3, 'Bom');
select is((select average_rating from public.get_product_review_summary(array['c3333333-3333-4333-8333-333333333333'::uuid])), 4.0::numeric, 'real aggregate is 4.0');
select is((select review_count from public.get_product_review_summary(array['c3333333-3333-4333-8333-333333333333'::uuid])), 2::bigint, 'real review count is two');
select throws_ok($$update public.product_reviews set rating = 1
  where user_id = 'a1111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'other user cannot edit a review');
select throws_ok($$select public.moderate_product_review(
  (select id from public.product_reviews where user_id = 'a1111111-1111-4111-8111-111111111111'), 'hidden')$$,
  'P0001', 'not authorized', 'non-admin cannot moderate');

reset role;
insert into public.catalog_admins(user_id) values ('b2222222-2222-4222-8222-222222222222');
set local role authenticated;
select public.moderate_product_review(
  (select id from public.product_reviews where user_id = 'a1111111-1111-4111-8111-111111111111'), 'hidden');
select is((select review_count from public.get_product_review_summary(array['c3333333-3333-4333-8333-333333333333'::uuid])), 1::bigint, 'hidden review leaves public aggregate');
select is((select count(*)::integer from public.product_reviews where status = 'hidden'), 1, 'admin can read hidden review');

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select public.save_product_review('c3333333-3333-4333-8333-333333333333', 5, null);
select is((select review_count from public.get_product_review_summary(array['c3333333-3333-4333-8333-333333333333'::uuid])), 1::bigint, 'editing does not republish hidden review');
select is((select count(*)::integer from public.product_reviews where status = 'hidden'), 1, 'owner can still see own hidden review');
select public.delete_my_product_review('c3333333-3333-4333-8333-333333333333');
select is((select count(*)::integer from public.product_reviews where status = 'hidden'), 1, 'hidden review keeps moderation key after removal');
select is((select comment from public.product_reviews where user_id = 'a1111111-1111-4111-8111-111111111111'), null::text, 'removal clears hidden review text');

reset role;
update public.products set status = 'draft' where slug = 'test-commerce-sofa';
set local role anon;
select is(public.get_catalog_product_detail('test-commerce-sofa'), null::jsonb, 'unpublished product disappears');

do $$
declare line text;
begin
  for line in select * from finish() loop
    if line like 'not ok%' or line like '# Looks like%' then
      raise exception 'pgtap failure: %', line;
    end if;
  end loop;
end;
$$;
rollback;
