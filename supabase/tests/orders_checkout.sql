begin;
select plan(1);

create function pg_temp.chk(p_ok boolean, p_message text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_message;
  end if;
end;
$$;

-- One scenario covering: kill switch, pickup-only checkout, idempotency,
-- cancellation, delivery quote contract, totals, multi-delivery policy, stock
-- reservation, payment events (mismatch, approval, duplicate, late), expiry,
-- row-level security, and function grants. Everything rolls back.
select lives_ok($lives$
do $test$
declare
  v_n integer := 0;
  v_admin uuid := (select user_id from public.catalog_admins order by enabled_at limit 1);
  v_c1 uuid := gen_random_uuid();
  v_c2 uuid := gen_random_uuid();
  v_vale_variant uuid;
  v_vale_price integer;
  v_mund_variant uuid;
  v_mund_price integer;
  v_pickup_location uuid;
  v_cart uuid;
  v_order uuid;
  v_order2 uuid;
  v_group uuid;
  v_quote uuid;
  v_err text;
  v_res jsonb;
  v_reserved_before integer;
  v_reserved integer;
  v_onhand_before integer;
  v_onhand integer;
  v_total integer;
  v_address jsonb := jsonb_build_object(
    'postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text,
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP',
    'street', 'Rua de Teste', 'number', '100', 'neighborhood', 'Centro', 'floor_number', 5);
begin
  perform pg_temp.chk(v_admin is not null, 'an admin exists'); v_n := v_n + 1;

  select v.id, v.price_cents into v_vale_variant, v_vale_price
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join public.logistics_suppliers s on s.id = p.supplier_id and s.code = 'VALE'
  join public.inventory i on i.variant_id = v.id
  where v.is_active and p.status = 'active' and v.sku is not null and v.price_cents > 0
  order by v.id limit 1;
  select v.id, v.price_cents into v_mund_variant, v_mund_price
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join public.logistics_suppliers s on s.id = p.supplier_id and s.code = 'MUNDIAL'
  join public.inventory i on i.variant_id = v.id
  where v.is_active and p.status = 'active' and v.sku is not null and v.price_cents > 0
  order by v.id limit 1;
  perform pg_temp.chk(v_vale_variant is not null and v_mund_variant is not null, 'a Vale and a Mundial variant exist'); v_n := v_n + 1;
  select l.id into v_pickup_location from public.logistics_pickup_locations l
  join public.logistics_suppliers s on s.id = l.supplier_id and s.code = 'VALE'
  where l.is_active limit 1;
  perform pg_temp.chk(v_pickup_location is not null, 'an active Vale pickup location exists'); v_n := v_n + 1;

  update public.inventory set on_hand = greatest(on_hand, reserved + 20)
  where variant_id in (v_vale_variant, v_mund_variant);

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values
    (v_c1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkout-test-1@example.invalid', now(), '{}', now(), now()),
    (v_c2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkout-test-2@example.invalid', now(), '{}', now(), now());
  insert into public.carts (user_id) values (v_c1) returning id into v_cart;

  -- Grants: payment RPCs are not callable by customers or anonymous visitors.
  perform pg_temp.chk(not has_function_privilege('authenticated', 'public.order_apply_payment_event(text,text,uuid,text,text,integer)', 'execute'), 'authenticated cannot apply payment events'); v_n := v_n + 1;
  perform pg_temp.chk(not has_function_privilege('anon', 'public.create_checkout_order(uuid,uuid,jsonb)', 'execute'), 'anon cannot create orders'); v_n := v_n + 1;
  perform pg_temp.chk(not has_function_privilege('authenticated', 'public.expire_pending_orders()', 'execute'), 'authenticated cannot expire orders'); v_n := v_n + 1;
  perform pg_temp.chk(has_function_privilege('service_role', 'public.order_register_payment(uuid,text,uuid,text,text)', 'execute'), 'service role can register payments'); v_n := v_n + 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_c1::text, true);
  execute 'set local role authenticated';

  -- Kill switch.
  begin
    perform public.create_checkout_order(gen_random_uuid(), null, '[]'::jsonb);
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'checkout disabled', 'checkout is disabled by default, got: ' || coalesce(v_err, 'no error')); v_n := v_n + 1;

  execute 'reset role';
  update public.commerce_settings set checkout_enabled = true;
  execute 'set local role authenticated';

  -- Empty cart.
  begin
    perform public.create_checkout_order(gen_random_uuid(), null, '[]'::jsonb);
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'cart empty', 'empty cart is refused, got: ' || coalesce(v_err, 'no error')); v_n := v_n + 1;

  -- Pickup-only cart (Vale), no quote needed.
  execute 'reset role';
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart, v_vale_variant, 2);
  select reserved, on_hand into v_reserved_before, v_onhand_before from public.inventory where variant_id = v_vale_variant;
  execute 'set local role authenticated';

  v_order := public.create_checkout_order(
    '11111111-1111-4111-8111-111111111111', null,
    jsonb_build_array(jsonb_build_object('supplier_code', 'VALE', 'pickup_location_id', v_pickup_location)));
  execute 'reset role';
  perform pg_temp.chk(v_order is not null, 'pickup order created'); v_n := v_n + 1;
  select total_cents into v_total from public.orders where id = v_order;
  perform pg_temp.chk(v_total = v_vale_price * 2, 'total equals items for pickup, got ' || v_total); v_n := v_n + 1;
  perform pg_temp.chk((select freight_cents + floor_charge_cents from public.orders where id = v_order) = 0, 'pickup has no freight or floor charge'); v_n := v_n + 1;
  perform pg_temp.chk((select status from public.orders where id = v_order) = 'pending_payment', 'order starts pending'); v_n := v_n + 1;
  perform pg_temp.chk((select fulfillment_mode from public.order_groups where order_id = v_order) = 'pickup', 'group is pickup'); v_n := v_n + 1;
  select reserved into v_reserved from public.inventory where variant_id = v_vale_variant;
  perform pg_temp.chk(v_reserved = v_reserved_before + 2, 'stock reserved'); v_n := v_n + 1;
  perform pg_temp.chk((select unit_price_cents from public.order_items where order_id = v_order) = v_vale_price, 'item price is the database price'); v_n := v_n + 1;

  -- Idempotent replay returns the same order without reserving again.
  execute 'set local role authenticated';
  perform pg_temp.chk(public.create_checkout_order(
    '11111111-1111-4111-8111-111111111111', null,
    jsonb_build_array(jsonb_build_object('supplier_code', 'VALE', 'pickup_location_id', v_pickup_location))) = v_order, 'replay returns the same order'); v_n := v_n + 1;
  execute 'reset role';
  select reserved into v_reserved from public.inventory where variant_id = v_vale_variant;
  perform pg_temp.chk(v_reserved = v_reserved_before + 2, 'replay did not reserve again'); v_n := v_n + 1;

  -- Row level security: the other customer sees nothing; the owner sees the order.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_c2::text, true);
  execute 'set local role authenticated';
  perform pg_temp.chk((select count(*) from public.orders) = 0, 'customer 2 cannot read customer 1 orders'); v_n := v_n + 1;
  begin
    perform public.cancel_my_order(v_order);
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'order not found', 'customer 2 cannot cancel customer 1 order'); v_n := v_n + 1;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_c1::text, true);
  execute 'set local role authenticated';
  perform pg_temp.chk((select count(*) from public.orders) = 1, 'customer 1 reads own order'); v_n := v_n + 1;

  -- Cancellation releases stock and is idempotent.
  perform pg_temp.chk(public.cancel_my_order(v_order) is true, 'customer cancels pending order'); v_n := v_n + 1;
  perform pg_temp.chk(public.cancel_my_order(v_order) is false, 'second cancel does nothing'); v_n := v_n + 1;
  execute 'reset role';
  select reserved into v_reserved from public.inventory where variant_id = v_vale_variant;
  perform pg_temp.chk(v_reserved = v_reserved_before, 'cancel released the reservation'); v_n := v_n + 1;

  -- Mundial (delivery only) without a quote is refused.
  delete from public.cart_items where cart_id = v_cart;
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart, v_mund_variant, 1);
  execute 'set local role authenticated';
  begin
    perform public.create_checkout_order(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('supplier_code', 'MUNDIAL', 'pickup_location_id', v_pickup_location)));
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'delivery quote required', 'delivery-only supplier needs a quote, got: ' || coalesce(v_err, 'no error')); v_n := v_n + 1;
  execute 'reset role';

  -- Delivery: quote -> vendor prices it -> customer accepts -> checkout.
  v_quote := public.logistics_create_quote_server(v_c1, gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('supplier_code', 'MUNDIAL', 'fulfillment_mode', 'delivery',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_mund_variant, 'quantity', 1)))),
    v_address);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  execute 'set local role authenticated';
  perform public.admin_set_logistics_group_freight(v_quote, 'MUNDIAL', 30000);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_c1::text, true);
  execute 'set local role authenticated';

  begin
    perform public.create_checkout_order(gen_random_uuid(), v_quote, '[]'::jsonb);
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'accepted quote required', 'a quote that is not accepted is refused, got: ' || coalesce(v_err, 'no error')); v_n := v_n + 1;

  perform public.customer_respond_logistics_quote(v_quote, true);
  execute 'reset role';
  select reserved, on_hand into v_reserved_before, v_onhand_before from public.inventory where variant_id = v_mund_variant;
  execute 'set local role authenticated';
  v_order2 := public.create_checkout_order(gen_random_uuid(), v_quote, '[]'::jsonb);
  execute 'reset role';
  select total_cents into v_total from public.orders where id = v_order2;
  perform pg_temp.chk(v_total = v_mund_price + 30000 + 1000, 'total = item + freight + floor charge (5th floor), got ' || v_total); v_n := v_n + 1;
  perform pg_temp.chk((select delivery_city from public.orders where id = v_order2) = 'Taubaté', 'delivery address snapshot copied'); v_n := v_n + 1;
  perform pg_temp.chk((select quote_id from public.orders where id = v_order2) = v_quote, 'order references its quote'); v_n := v_n + 1;
  select reserved into v_reserved from public.inventory where variant_id = v_mund_variant;
  perform pg_temp.chk(v_reserved = v_reserved_before + 1, 'delivery order reserved stock'); v_n := v_n + 1;

  -- Payment: wrong amount is flagged, never marked paid.
  perform public.order_register_payment(v_order2, 'mock', gen_random_uuid(), null, null);
  v_res := public.order_apply_payment_event('mock', 'evt-1', v_order2, 'pay-1', 'approved', v_total - 1);
  perform pg_temp.chk(v_res ->> 'outcome' = 'amount_mismatch', 'wrong amount is not accepted'); v_n := v_n + 1;
  perform pg_temp.chk((select status from public.orders where id = v_order2) = 'needs_review', 'wrong amount flags the order'); v_n := v_n + 1;
  select on_hand into v_onhand from public.inventory where variant_id = v_mund_variant;
  perform pg_temp.chk(v_onhand = v_onhand_before, 'wrong amount did not consume stock'); v_n := v_n + 1;

  -- The same order, now with the correct amount (a person cleared the review).
  update public.orders set status = 'pending_payment' where id = v_order2;
  v_res := public.order_apply_payment_event('mock', 'evt-2', v_order2, 'pay-1', 'approved', v_total);
  perform pg_temp.chk(v_res ->> 'outcome' = 'paid', 'correct amount marks the order paid, got ' || (v_res ->> 'outcome')); v_n := v_n + 1;
  select reserved, on_hand into v_reserved, v_onhand from public.inventory where variant_id = v_mund_variant;
  perform pg_temp.chk(v_onhand = v_onhand_before - 1 and v_reserved = v_reserved_before, 'payment moved reserved stock to a sale'); v_n := v_n + 1;
  perform pg_temp.chk((select status from public.order_groups where order_id = v_order2) = 'preparing', 'paid order group starts preparing'); v_n := v_n + 1;
  perform pg_temp.chk(not exists (select 1 from public.cart_items where cart_id = v_cart and variant_id = v_mund_variant), 'paid items leave the cart'); v_n := v_n + 1;
  perform pg_temp.chk((public.order_apply_payment_event('mock', 'evt-2', v_order2, 'pay-1', 'approved', v_total)) ->> 'outcome' = 'duplicate', 'same event id is a duplicate'); v_n := v_n + 1;
  perform pg_temp.chk((public.order_apply_payment_event('mock', 'evt-3', v_order2, 'pay-1', 'approved', v_total)) ->> 'outcome' = 'already_paid', 'a new event for a paid order is a no-op'); v_n := v_n + 1;
  select on_hand into v_onhand from public.inventory where variant_id = v_mund_variant;
  perform pg_temp.chk(v_onhand = v_onhand_before - 1, 'repeated approvals consume stock once'); v_n := v_n + 1;

  -- Admin: summary and fulfillment transitions.
  select id into v_group from public.order_groups where order_id = v_order2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  execute 'set local role authenticated';
  perform pg_temp.chk((public.admin_get_orders_summary() ->> 'paid')::integer >= 1, 'admin summary counts paid orders'); v_n := v_n + 1;
  perform pg_temp.chk(jsonb_array_length(public.admin_get_order(v_order2) -> 'groups') = 1, 'admin can read the order'); v_n := v_n + 1;
  begin
    perform public.admin_set_order_group_status(v_group, 'ready_for_pickup');
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'invalid fulfillment transition', 'a delivery group cannot be marked ready for pickup, got: ' || coalesce(v_err,'no error')); v_n := v_n + 1;
  perform public.admin_set_order_group_status(v_group, 'out_for_delivery');
  perform public.admin_set_order_group_status(v_group, 'completed');
  execute 'reset role';
  perform pg_temp.chk((select status from public.order_groups where order_id = v_order2) = 'completed', 'fulfillment reaches completed'); v_n := v_n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_c1::text, true);
  execute 'set local role authenticated';
  begin
    perform public.admin_get_orders_summary();
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  perform pg_temp.chk(v_err = 'forbidden', 'customers cannot use admin order summary'); v_n := v_n + 1;
  execute 'reset role';

  -- Expiry releases stock; a late approval is recovered when stock remains.
  delete from public.cart_items where cart_id = v_cart;
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart, v_vale_variant, 1);
  select reserved, on_hand into v_reserved_before, v_onhand_before from public.inventory where variant_id = v_vale_variant;
  execute 'set local role authenticated';
  v_order := public.create_checkout_order(gen_random_uuid(), null,
    jsonb_build_array(jsonb_build_object('supplier_code', 'VALE', 'pickup_location_id', v_pickup_location)));
  execute 'reset role';
  update public.orders set payment_expires_at = now() - interval '1 minute' where id = v_order;
  perform pg_temp.chk(public.expire_pending_orders() >= 1, 'expiry job closes overdue orders'); v_n := v_n + 1;
  perform pg_temp.chk((select status from public.orders where id = v_order) = 'expired', 'order is expired'); v_n := v_n + 1;
  select reserved into v_reserved from public.inventory where variant_id = v_vale_variant;
  perform pg_temp.chk(v_reserved = v_reserved_before, 'expiry released the reservation'); v_n := v_n + 1;
  select total_cents into v_total from public.orders where id = v_order;
  v_res := public.order_apply_payment_event('mock', 'evt-late', v_order, 'pay-late', 'approved', v_total);
  perform pg_temp.chk(v_res ->> 'outcome' = 'paid_late', 'late payment with stock is recovered, got ' || (v_res ->> 'outcome')); v_n := v_n + 1;
  select on_hand into v_onhand from public.inventory where variant_id = v_vale_variant;
  perform pg_temp.chk(v_onhand = v_onhand_before - 1, 'late payment consumed stock once'); v_n := v_n + 1;

  -- Out of stock: the order is refused and nothing is reserved.
  update public.inventory set on_hand = reserved where variant_id = v_vale_variant;
  delete from public.cart_items where cart_id = v_cart;
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart, v_vale_variant, 1);
  execute 'set local role authenticated';
  begin
    perform public.create_checkout_order(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('supplier_code', 'VALE', 'pickup_location_id', v_pickup_location)));
    v_err := null;
  exception when others then v_err := sqlerrm; end;
  execute 'reset role';
  perform pg_temp.chk(v_err in ('insufficient stock', 'cart has unavailable items'), 'out of stock is refused, got: ' || coalesce(v_err, 'no error')); v_n := v_n + 1;

  raise notice 'ORDERS CHECKS PASSED: %', v_n;
end;
$test$
$lives$, 'orders and checkout flow behaves as designed');

select * from finish();
rollback;
