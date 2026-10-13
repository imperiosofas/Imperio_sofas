begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cart-atomic-a@example.invalid'),
  ('b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cart-atomic-b@example.invalid');
insert into public.catalog_admins (user_id)
values ('a1111111-1111-4111-8111-111111111111');

insert into public.products (id, category_id, name, slug)
select 'c3333333-3333-4333-8333-333333333333', id, 'TEST Atomic Cart Sofa', 'test-atomic-cart-sofa'
from public.categories where slug = 'sofas';
insert into public.product_variants (id, product_id, sku, width_mm, price_cents, is_active)
values
  ('e5555555-5555-4555-8555-555555555555', 'c3333333-3333-4333-8333-333333333333', 'TEST-CART-ATOMIC-4', 2200, 349000, true),
  ('f6666666-6666-4666-8666-666666666666', 'c3333333-3333-4333-8333-333333333333', 'TEST-CART-ATOMIC-120', 2400, 400000, true);
insert into public.inventory (variant_id, on_hand) values
  ('e5555555-5555-4555-8555-555555555555', 4),
  ('f6666666-6666-4666-8666-666666666666', 120);
insert into public.product_media (id, product_id, storage_path, alt_text)
values ('d4444444-4444-4444-8444-444444444444', 'c3333333-3333-4333-8333-333333333333',
  'TEST/cart-atomic/sofa.webp', 'Imagem de teste do sofá');
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
set local role authenticated;
update public.products set status = 'active' where id = 'c3333333-3333-4333-8333-333333333333';
reset role;

set local role anon;
select throws_ok(
  $$select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 1)$$,
  '42501', null, 'anonymous role cannot execute cart increment'
);
reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 1);
select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 1);
select is(
  (public.get_my_cart() #>> '{0,quantity}')::integer,
  2,
  'sequential increments accumulate instead of replacing quantity'
);
select is(
  (select reserved from public.inventory where variant_id = 'e5555555-5555-4555-8555-555555555555'),
  0,
  'adding to cart does not reserve stock'
);
select throws_ok(
  $$select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 3)$$,
  'P0001', 'item unavailable', 'accumulated quantity cannot exceed current stock'
);
select throws_ok(
  $$select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 100)$$,
  'P0001', 'invalid quantity', 'per-request quantity remains capped at 99'
);
select throws_ok(
  $$select public.add_cart_item('e5555555-5555-4555-8555-555555555555', 0)$$,
  'P0001', 'invalid quantity', 'add operation rejects zero quantity'
);
select public.set_cart_item('e5555555-5555-4555-8555-555555555555', 2);
select is(
  (public.get_my_cart() #>> '{0,quantity}')::integer,
  2,
  'absolute set operation remains available with its existing semantics'
);
select public.add_cart_item('f6666666-6666-4666-8666-666666666666', 99);
select throws_ok(
  $$select public.add_cart_item('f6666666-6666-4666-8666-666666666666', 1)$$,
  'P0001', 'quantity limit reached', 'combined quantity cannot exceed 99'
);
select is(
  (select quantity from public.cart_items
   where cart_id = (select id from public.carts where user_id = 'a1111111-1111-4111-8111-111111111111')
     and variant_id = 'f6666666-6666-4666-8666-666666666666'),
  99,
  'rejected increment leaves the stored quantity unchanged'
);
reset role;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(public.get_my_cart(), '[]'::jsonb, 'another customer cannot read the first customer cart');

reset role;
select ok(
  pg_get_functiondef('public.add_cart_item(uuid,integer)'::regprocedure) like '%quantity = ci.quantity + excluded.quantity%',
  'conflicting increments use an atomic database-side addition'
);
select ok(
  lower(pg_get_functiondef('public.add_cart_item(uuid,integer)'::regprocedure)) like '%for update of i%',
  'competing increments serialize through the inventory row lock'
);

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
