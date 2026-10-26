begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, raw_user_meta_data
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-admin@example.invalid', '{}'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-customer@example.invalid', '{}'),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-other@example.invalid', '{}'),
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-multi@example.invalid', '{}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics-pickup@example.invalid', '{}');
insert into public.catalog_admins (user_id)
values ('11111111-1111-4111-8111-111111111111');

update public.categories set is_active = true where slug = 'sofas';
insert into public.products (id, category_id, name, slug, status, supplier_id)
select '44444444-4444-4444-8444-444444444444', c.id,
  'TEST Logistics Vale Sofa', 'test-logistics-vale-sofa', 'draft', s.id
from public.categories c cross join public.logistics_suppliers s
where c.slug = 'sofas' and s.code = 'VALE';
insert into public.products (id, category_id, name, slug, status, supplier_id)
select '55555555-5555-4555-8555-555555555555', c.id,
  'TEST Logistics Mundial Sofa', 'test-logistics-mundial-sofa', 'draft', s.id
from public.categories c cross join public.logistics_suppliers s
where c.slug = 'sofas' and s.code = 'MUNDIAL';
insert into public.products (id, category_id, name, slug, status)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', c.id,
  'TEST Logistics Unassigned Sofa', 'test-logistics-unassigned-sofa', 'draft'
from public.categories c where c.slug = 'sofas';
insert into public.products (id, category_id, name, slug, status)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', c.id,
  'TEST Logistics Bulk Sofa', 'test-logistics-bulk-sofa', 'draft'
from public.categories c where c.slug = 'sofas';

insert into public.product_variants (
  id, product_id, sku, width_mm, price_cents, is_active
) values
  ('66666666-6666-4666-8666-666666666666', '44444444-4444-4444-8444-444444444444', 'TEST-LOG-VALE', 2200, 382800, true),
  ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', 'TEST-LOG-MUNDIAL', 2400, 394800, true);
insert into public.inventory (variant_id, on_hand, reserved, low_stock_threshold) values
  ('66666666-6666-4666-8666-666666666666', 10, 0, 5),
  ('77777777-7777-4777-8777-777777777777', 10, 0, 5);
insert into public.product_media (product_id, storage_path, alt_text) values
  ('44444444-4444-4444-8444-444444444444', 'test/logistics-vale.jpg', 'Fixture de teste logístico Vale'),
  ('55555555-5555-4555-8555-555555555555', 'test/logistics-mundial.jpg', 'Fixture de teste logístico Mundial');
update public.products set status = 'active'
where id in ('44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555');
insert into public.carts (id, user_id)
values
  ('88888888-8888-4888-8888-888888888888', '22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999999', '33333333-3333-4333-8333-333333333333'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.cart_items (cart_id, variant_id, quantity)
values
  ('88888888-8888-4888-8888-888888888888', '66666666-6666-4666-8666-666666666666', 1),
  ('99999999-9999-4999-8999-999999999999', '66666666-6666-4666-8666-666666666666', 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666', 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '77777777-7777-4777-8777-777777777777', 2),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '66666666-6666-4666-8666-666666666666', 1);

create temporary table logistics_test_quotes (
  name text primary key,
  quote_id uuid not null
);
grant select, insert on logistics_test_quotes to service_role, authenticated;
create temporary table logistics_test_supplier_ids as
select code, id from public.logistics_suppliers;
grant select on logistics_test_supplier_ids to authenticated;
create temporary table logistics_test_pickup_ids as
select id from public.logistics_pickup_locations
where supplier_id = (select id from logistics_test_supplier_ids where code = 'VALE');
grant select on logistics_test_pickup_ids to service_role, authenticated;
create temporary table logistics_test_pickup_mutations (
  name text primary key,
  pickup_location_id uuid not null
);
grant select, insert on logistics_test_pickup_mutations to authenticated;

select is((select count(*)::integer from public.logistics_suppliers), 2, 'exactly Vale and Mundial are seeded');
select is((select count(*)::integer from public.logistics_areas), 12, 'only the twelve confirmed municipalities are seeded');
select is((select city_name from public.logistics_areas where ibge_code = '3554102'), 'Taubaté', 'Taubaté is keyed by IBGE code 3554102');
select is((select postal_code from public.logistics_pickup_locations l join public.logistics_suppliers s on s.id = l.supplier_id where s.code = 'VALE'), '12081-670', 'Vale pickup uses the supplied CEP');
select is((select floor_charge_cents from public.logistics_settings where singleton), 1000, 'floor fee defaults to R$10.00');
select is((select included_through_floor from public.logistics_settings where singleton), 4, 'floors through four are included');
select is((select quote_expiration_minutes from public.logistics_settings where singleton), null::integer, 'quote expiry stays unconfigured');
select is((select whatsapp_phone_e164 from public.logistics_settings where singleton), null::text, 'WhatsApp stays unconfigured');
select ok((select supplier_id is null from public.products where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'products are not automatically classified');
select ok((select relrowsecurity from pg_class where oid = 'public.logistics_quotes'::regclass), 'quote table has RLS enabled');
select ok(not has_table_privilege('anon', 'public.logistics_quotes', 'select'), 'anon has no direct quote-table access');
select ok(not has_table_privilege('authenticated', 'public.logistics_quotes', 'select'), 'authenticated has no direct quote-table access');
select ok(has_function_privilege('service_role', 'public.logistics_create_quote_server(uuid,uuid,jsonb,jsonb)', 'execute'), 'server quote RPC is executable by service_role');
select ok(not has_function_privilege('authenticated', 'public.logistics_create_quote_server(uuid,uuid,jsonb,jsonb)', 'execute'), 'authenticated cannot execute server quote RPC');
select ok(not has_function_privilege('anon', 'public.logistics_create_quote_server(uuid,uuid,jsonb,jsonb)', 'execute'), 'anon cannot execute server quote RPC');
select ok(has_function_privilege('authenticated', 'public.admin_assign_products_supplier(uuid[],uuid)', 'execute'), 'authenticated can reach the bulk supplier RPC guarded by admin membership');
select ok(not has_function_privilege('anon', 'public.admin_assign_products_supplier(uuid[],uuid)', 'execute'), 'anon cannot execute the bulk supplier RPC');
select ok(not has_function_privilege('service_role', 'public.admin_assign_products_supplier(uuid[],uuid)', 'execute'), 'service_role has no bulk supplier RPC grant');
select ok(has_function_privilege('authenticated', 'public.admin_update_logistics_supplier(uuid,text,boolean,boolean,boolean,integer,integer,boolean,text)', 'execute'), 'admin supplier RPC signature includes display_name');
select ok(not has_function_privilege('service_role', 'public.admin_update_logistics_supplier(uuid,text,boolean,boolean,boolean,integer,integer,boolean,text)', 'execute'), 'service_role has no supplier admin RPC grant');
select ok(not has_function_privilege('anon', 'public.admin_update_logistics_supplier(uuid,text,boolean,boolean,boolean,integer,integer,boolean,text)', 'execute'), 'anon has no supplier admin RPC grant');
select ok(has_function_privilege('authenticated', 'public.admin_save_logistics_pickup_location(uuid,uuid,text,text,text,text,text,text,text,boolean)', 'execute'), 'pickup management RPC is callable only through its admin membership guard');
select ok(not has_function_privilege('service_role', 'public.admin_save_logistics_pickup_location(uuid,uuid,text,text,text,text,text,text,text,boolean)', 'execute'), 'service_role has no pickup admin RPC grant');
select ok(not has_function_privilege('anon', 'public.admin_save_logistics_pickup_location(uuid,uuid,text,text,text,text,text,text,text,boolean)', 'execute'), 'anon has no pickup admin RPC grant');
select ok(has_function_privilege('authenticated', 'public.customer_list_my_logistics_quotes()', 'execute'), 'authenticated can list own quotes through RPC');
select ok((
  select count(*) = 10
  from (values
    ('public.logistics_admin_events_actor_id_idx'),
    ('public.logistics_pickup_locations_ibge_code_idx'),
    ('public.logistics_quote_events_actor_id_idx'),
    ('public.logistics_quote_events_quote_group_id_idx'),
    ('public.logistics_quote_groups_pickup_location_id_idx'),
    ('public.logistics_quote_groups_quoted_by_idx'),
    ('public.logistics_quote_groups_supplier_id_idx'),
    ('public.logistics_quote_items_product_id_idx'),
    ('public.logistics_quotes_delivery_ibge_code_idx'),
    ('public.logistics_settings_updated_by_idx')
  ) as expected_indexes(index_name)
  where to_regclass(expected_indexes.index_name) is not null
), 'all logistics foreign keys flagged by the performance advisor have indexes');

set local role anon;
select throws_ok($$select * from public.logistics_quotes$$, '42501', null, 'anon cannot query quote table directly');
select throws_ok($$select public.customer_list_my_logistics_quotes()$$, '42501', null, 'anon cannot list customer quotes');
select ok(public.get_public_product_logistics('test-logistics-vale-sofa') is not null, 'public logistics projection resolves a published sellable product');
select is(public.get_public_product_logistics('test-logistics-unassigned-sofa'), null::jsonb, 'draft product logistics remain hidden');
reset role;

-- Exercise settings mutation before quote snapshots exist, so invalidation
-- behavior does not make the baseline quote fixtures stale before pricing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.admin_update_logistics_settings(1000,4,null,'not-a-phone')$$,
  '22023', null, 'settings reject malformed optional WhatsApp numbers');
select is(public.admin_update_logistics_settings(1250,4,60,'+5512999999999')->>'quote_expiration_minutes',
  '60', 'admin can set floor, quote-expiry and optional WhatsApp configuration');
select is(public.admin_update_logistics_settings(1000,4,null,null)->>'whatsapp_phone_e164',
  null::text, 'admin can clear optional expiry and WhatsApp settings');
select is(public.admin_update_logistics_settings(1000,2147483647,null,null)->>'included_through_floor',
  '2147483647', 'included floor accepts the full non-negative integer range without an invented cap');
select is(public.admin_update_logistics_settings(1000,4,null,null)->>'included_through_floor',
  '4', 'included floor fixture is restored after the maximum-boundary check');
reset role;

-- Create quote fixtures only through the service-role trust boundary.
-- Model sb_secret transport correctly: the key is supplied as apikey, not as
-- Authorization: Bearer, so there is intentionally no service_role JWT claim.
set local role service_role;
select set_config('request.jwt.claims', '{}', true);
select is(auth.jwt() ->> 'role', null::text,
  'server-only quote RPC does not treat a secret API key as a JWT role claim');
insert into logistics_test_quotes(name, quote_id)
select 'floor4', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000004',
  jsonb_build_array(jsonb_build_object(
    'supplier_code', 'VALE', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
    'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1))
  )),
  jsonb_build_object('postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'street', 'Rua Agostinho Abifadel', 'number', '35', 'neighborhood', 'Terra Nova',
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP', 'floor_number', 4,
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'floor5', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000005',
  jsonb_build_array(jsonb_build_object(
    'supplier_code', 'VALE', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
    'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1))
  )),
  jsonb_build_object('postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'street', 'Rua Agostinho Abifadel', 'number', '35', 'neighborhood', 'Terra Nova',
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP', 'floor_number', 5,
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text)
);
select throws_ok($$select public.logistics_create_quote_server(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '90000000-0000-4000-8000-000000000061',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',2)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',4,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'quote creation rejects a stale subset that omits a current cart supplier group');
select throws_ok($$select public.logistics_create_quote_server(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '90000000-0000-4000-8000-000000000062',
  jsonb_build_array(
    jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
      'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))),
    jsonb_build_object('supplier_code','MUNDIAL','fulfillment_mode','delivery','pickup_location_id',null,
      'items',jsonb_build_array(jsonb_build_object('variant_id','77777777-7777-4777-8777-777777777777','quantity',2)))
  ),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',4,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'quote creation rejects a submitted quantity that differs from the locked current cart');
insert into logistics_test_quotes(name, quote_id)
select 'floor6_multi', public.logistics_create_quote_server(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '90000000-0000-4000-8000-000000000006',
  jsonb_build_array(
    jsonb_build_object('supplier_code', 'VALE', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
      'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 2))),
    jsonb_build_object('supplier_code', 'MUNDIAL', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
      'items', jsonb_build_array(jsonb_build_object('variant_id', '77777777-7777-4777-8777-777777777777', 'quantity', 2)))
  ),
  jsonb_build_object('postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'street', 'Rua Agostinho Abifadel', 'number', '35', 'neighborhood', 'Terra Nova',
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP', 'floor_number', 6,
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'floor101', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000101',
  jsonb_build_array(jsonb_build_object(
    'supplier_code', 'VALE', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
    'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1))
  )),
  jsonb_build_object('postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'street', 'Rua Agostinho Abifadel', 'number', '35', 'neighborhood', 'Terra Nova',
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP', 'floor_number', 101,
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'pickup', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000007',
  jsonb_build_array(jsonb_build_object(
    'supplier_code', 'VALE', 'fulfillment_mode', 'pickup',
    'pickup_location_id', (select id from logistics_test_pickup_ids),
    'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1))
  )), '{}'::jsonb
);

select is(public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000005',
  jsonb_build_array(jsonb_build_object(
    'supplier_code', 'VALE', 'fulfillment_mode', 'delivery', 'pickup_location_id', null,
    'items', jsonb_build_array(jsonb_build_object('variant_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1))
  )),
  jsonb_build_object('postal_code', '12081670', 'cep_verified_postal_code', '12081670',
    'street', 'Rua Agostinho Abifadel', 'number', '35', 'neighborhood', 'Terra Nova',
    'ibge_code', '3554102', 'city_name', 'Taubaté', 'state_code', 'SP', 'floor_number', 5,
    'cep_verification_source', 'viacep', 'cep_verified_at', now()::text)
), (select quote_id from logistics_test_quotes where name = 'floor5'), 'same idempotency input returns the original quote');
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000005',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',6,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'idempotency key cannot be reused with changed address');
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000099',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',2147483647,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'fee beyond integer cents range is rejected without overflow');
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000098',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',4.5,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'fractional floor is rejected instead of rounded');
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000097',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554101','city_name','Taubaté','state_code','SP',
    'floor_number',5,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'unlisted or mismatched municipality is rejected');
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000096',
  jsonb_build_array(jsonb_build_object('supplier_code','MUNDIAL','fulfillment_mode','pickup',
    'pickup_location_id','00000000-0000-4000-8000-000000000001',
    'items',jsonb_build_array(jsonb_build_object('variant_id','77777777-7777-4777-8777-777777777777','quantity',1)))),
  '{}'::jsonb)$$,
  '22023', null, 'Mundial pickup is rejected');
reset role;

select ok((
  select q.request_fingerprint ->> 'version' = '1'
    and q.request_fingerprint ->> 'sha256' ~ '^[a-f0-9]{64}$'
    and not (q.request_fingerprint ? 'address')
    and q.request_fingerprint::text not like '%Rua Agostinho Abifadel%'
  from public.logistics_quotes q
  where q.id = (select quote_id from logistics_test_quotes where name = 'floor4')
), 'quote fingerprint is a versioned digest and does not duplicate address fields');

select is((select count(*)::integer from public.logistics_quotes
  where customer_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
    and idempotency_key in ('90000000-0000-4000-8000-000000000061','90000000-0000-4000-8000-000000000062')), 0,
  'rejected partial and quantity-mismatched snapshots persist no quote');
select is((select floor_charge_cents from public.logistics_quotes where id = (select quote_id from logistics_test_quotes where name='floor4')), 0, 'floor four incurs no charge');
select is((select floor_charge_cents from public.logistics_quotes where id = (select quote_id from logistics_test_quotes where name='floor5')), 1000, 'floor five incurs one R$10 fee');
select is((select floor_charge_cents from public.logistics_quotes where id = (select quote_id from logistics_test_quotes where name='floor6_multi')), 2000, 'floor six fee is applied once across two supplier groups');
select is((select floor_charge_cents from public.logistics_quotes where id = (select quote_id from logistics_test_quotes where name='floor101')), 97000, 'floor above 100 is accepted and follows max(0, floor minus four)');
select is((select count(*)::integer from public.logistics_quotes where customer_id='22222222-2222-4222-8222-222222222222'), 4, 'only valid, unique quote requests persist');
select is((select count(*)::integer from public.logistics_quote_items), 6, 'quote items snapshot every requested variant without changing cart rows');
select is((select floor_charge_cents from public.logistics_quotes where id = (select quote_id from logistics_test_quotes where name='pickup')), 0, 'pickup quote has no delivery floor charge');
select is((select quantity from public.cart_items where cart_id='88888888-8888-4888-8888-888888888888' and variant_id='66666666-6666-4666-8666-666666666666'), 1, 'quote request preserves cart quantity');
select is((select reserved from public.inventory where variant_id='66666666-6666-4666-8666-666666666666'), 0, 'quote request does not reserve stock');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.admin_logistics_overview()$$, '42501', null, 'non-admin membership cannot access admin overview');
select is((public.customer_get_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'))->>'status'), 'invalidated', 'customer can read the status of an earlier quote after requesting a changed delivery setup');
select is(jsonb_array_length(public.customer_list_my_logistics_quotes()), 4, 'customer list is scoped to owned quotes');
select ok((
  select bool_and((item->>'available_for_quote')::boolean)
  from jsonb_array_elements(public.get_my_cart_logistics()->'items') as items(item)
), 'cart logistics projection reports eligibility without exact stock');
select ok(not (public.get_my_cart_logistics()->'items'->0 ? 'on_hand'), 'customer cart logistics never exposes internal inventory counts');
select throws_ok($$select public.customer_respond_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'), true)$$,
  '22023', null, 'customer cannot respond before all freight groups are priced');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), 'Unauthorized name', true, true, true, 7, 7, true, null)$$,
  '42501', null, 'non-admin cannot edit supplier configuration');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='VALE'), 'TEST_NONADMIN',
  'Unauthorized location', 'Rua de teste', '1', 'Centro', '12081-670', '3554102', false)$$,
  '42501', null, 'non-admin cannot manage pickup locations');
select throws_ok($$select public.admin_assign_products_supplier(
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
  (select id from logistics_test_supplier_ids where code='VALE'))$$,
  '42501', null, 'non-admin cannot bulk assign product suppliers');
select is((select supplier_id from public.products where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  null::uuid, 'unauthorized bulk assignment changes no product');
select is(public.customer_get_logistics_quote((select quote_id from logistics_test_quotes where name='floor4')), null::jsonb, 'another customer cannot read quote details');
select throws_ok($$select public.customer_respond_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'), true)$$,
  '42501', null, 'another customer cannot respond to this quote');
select throws_ok($$select public.customer_cancel_logistics_quote((select quote_id from logistics_test_quotes where name='floor5'))$$,
  '42501', null, 'another customer cannot cancel this quote');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(jsonb_array_length(public.admin_list_logistics_suppliers()), 2, 'admin supplier list returns the two configured suppliers');
select ok(jsonb_array_length(public.admin_list_logistics_products('TEST Logistics')) >= 2, 'admin product list filters by product data');
select is(jsonb_array_length(public.admin_list_logistics_areas()), 12, 'admin area list contains only configured municipalities');
select ok((public.admin_logistics_overview() ? 'quote_counts'), 'admin overview includes quote status counts');
select is(public.admin_assign_product_supplier(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select id from logistics_test_supplier_ids where code='VALE')
)->>'supplier_code', 'VALE', 'admin can explicitly assign a supplier to a product');
select is(public.admin_assign_products_supplier(
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid],
  (select id from logistics_test_supplier_ids where code='VALE')),
  2, 'admin can bulk assign only the explicitly selected products');
select throws_ok($$select public.admin_assign_products_supplier(
  array['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid, 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid],
  (select id from logistics_test_supplier_ids where code='MUNDIAL'))$$,
  'P0002', null, 'bulk assignment with a missing product fails atomically');
select is((select supplier_id from public.products where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  (select id from logistics_test_supplier_ids where code='VALE'),
  'failed bulk assignment rolls back preceding product updates');
select throws_ok($$select public.admin_assign_products_supplier(
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
  (select id from logistics_test_supplier_ids where code='VALE'))$$,
  '22023', null, 'bulk assignment rejects duplicate product IDs');
select throws_ok($$select public.admin_assign_products_supplier(
  array_fill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, array[101]),
  (select id from logistics_test_supplier_ids where code='VALE'))$$,
  '22023', null, 'bulk assignment rejects more than one hundred products');
select is((
  select product->>'supplier_code'
  from jsonb_array_elements(public.admin_list_logistics_products('test-logistics-unassigned')) as products(product)
  where product->>'product_id' = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
), 'VALE', 'assignment updates only the requested test product');
select throws_ok($$select public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='MUNDIAL'), 'Mundial', true, true, true, 30, 45, true, null)$$,
  '22023', null, 'admin cannot enable pickup for delivery-only Mundial');
select throws_ok($$select public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), '   ', true, true, true, 7, 7, true, null)$$,
  '22023', null, 'supplier display name cannot be blank');
select throws_ok($$select public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), 'Vale', true, true, true, 7, 7, false, null)$$,
  '22023', null, 'supplier RPC rejects delivery enabled without a required delivery quote');
select is(public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), 'Vale', true, true, true, 7, 7, true, null
)->>'display_name', 'Vale', 'admin supplier RPC accepts the display_name argument');
select is(public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), 'Vale', true, true, true, 7, 7, true, null
)->>'code', 'VALE', 'supplier code remains fixed while display name is editable');
insert into logistics_test_pickup_mutations(name, pickup_location_id)
select 'created', (public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='VALE'), 'TEST_VALE_MANUAL',
  'Ponto manual de teste', 'Rua Agostinho Abifadel', '35', 'Terra Nova',
  '12081670', '3554102', true
)->>'pickup_location_id')::uuid;
select ok((
  select (location->>'is_active')::boolean
  from jsonb_array_elements(public.admin_list_logistics_suppliers()) as suppliers(supplier)
  cross join lateral jsonb_array_elements(supplier->'pickup_locations') as locations(location)
  where location->>'pickup_location_id' = (select pickup_location_id::text from logistics_test_pickup_mutations where name='created')
),
  'admin can create a pickup location using explicitly entered address fields');
select is((
  select location->>'city_name'
  from jsonb_array_elements(public.admin_list_logistics_suppliers()) as suppliers(supplier)
  cross join lateral jsonb_array_elements(supplier->'pickup_locations') as locations(location)
  where location->>'pickup_location_id' = (select pickup_location_id::text from logistics_test_pickup_mutations where name='created')
), 'Taubaté', 'pickup municipality is derived from the approved IBGE area row');
select is((public.admin_save_logistics_pickup_location(
  (select pickup_location_id from logistics_test_pickup_mutations where name='created'),
  (select id from logistics_test_supplier_ids where code='VALE'), 'TEST_VALE_MANUAL',
  'Ponto manual revisado', 'Rua Agostinho Abifadel', '35', 'Terra Nova',
  '12081-670', '3554102', false
)->>'is_active'), 'false', 'admin can update and deactivate a manually managed pickup location');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  (select pickup_location_id from logistics_test_pickup_mutations where name='created'),
  (select id from logistics_test_supplier_ids where code='MUNDIAL'), 'TEST_VALE_MANUAL',
  'Ponto transferido', 'Rua Agostinho Abifadel', '35', 'Terra Nova',
  '12081-670', '3554102', false)$$,
  '22023', null, 'pickup location ownership cannot be reassigned to another supplier');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='MUNDIAL'), 'TEST_MUNDIAL_PICKUP',
  'Retirada não permitida', 'Rua de teste', '1', 'Centro',
  '12081-670', '3554102', true)$$,
  '22023', null, 'delivery-only supplier cannot activate a pickup location');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='MUNDIAL'), 'TEST_MUNDIAL_INACTIVE',
  'Retirada inativa', 'Rua de teste', '1', 'Centro',
  '12081-670', '3554102', false)$$,
  '22023', null, 'delivery-only supplier cannot own even an inactive pickup location');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='VALE'), 'TEST_UNLISTED_CITY',
  'Cidade fora da lista', 'Rua de teste', '1', 'Centro',
  '12081-670', '3550308', false)$$,
  '22023', null, 'pickup location cannot introduce a municipality outside the twelve-area allowlist');
select throws_ok($$select public.admin_save_logistics_pickup_location(
  null, (select id from logistics_test_supplier_ids where code='VALE'), 'TEST_BAD_CEP',
  'CEP inválido', 'Rua de teste', '1', 'Centro',
  '12A', '3554102', false)$$,
  '22023', null, 'pickup location requires a manually entered valid CEP format');
select ok((
  select (location->>'is_active')::boolean
    and location->>'postal_code' = '12081-670'
    and location->>'street' = 'Rua Agostinho Abifadel'
  from jsonb_array_elements(public.admin_list_logistics_suppliers()) as suppliers(supplier)
  cross join lateral jsonb_array_elements(supplier->'pickup_locations') as locations(location)
  where location->>'location_code' = 'VALE_GALPAO'
),
  'admin CRUD leaves the sole confirmed pickup address unchanged unless explicitly edited');
select is(public.admin_set_logistics_area('3544301','Roseira',false)->>'is_enabled', 'false', 'admin can disable an allowlisted city');
select is((
  select (area->>'is_enabled')::boolean
  from jsonb_array_elements(public.admin_list_logistics_areas()) as areas(area)
  where area->>'ibge_code' = '3544301'
), false, 'area setting persists only on configured row');
reset role;
select throws_ok($$update public.logistics_suppliers
  set delivery_quote_required=false where code='VALE'$$,
  '23514', null, 'supplier table constraint rejects delivery without mandatory quote');
set local role service_role;
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$select public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000095',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3544301','city_name','Roseira','state_code','SP',
    'floor_number',5,'cep_verification_source','viacep','cep_verified_at',now()::text))$$,
  '22023', null, 'disabled allowlisted city cannot receive a quote');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_area('3544301','Roseira',true)->>'is_enabled', 'true', 'admin can re-enable an existing area');
select throws_ok($$select public.admin_set_logistics_area('3550308','São Paulo',true)$$,
  '22023', null, 'admin cannot add an unapproved city through the area RPC');
select throws_ok($$select public.admin_list_logistics_quotes('unknown')$$,
  '22023', null, 'quote status filter rejects unsupported states');

-- Earlier admin supplier/location tests intentionally mutate operational
-- configuration and invalidate existing snapshots. Replace only the named
-- quote fixtures after those changes so pricing/acceptance tests start fresh.
reset role;
delete from logistics_test_quotes where name in ('floor4', 'floor5', 'floor6_multi', 'pickup');
set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'floor4', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '91000000-0000-4000-8000-000000000004',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))
  )),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua Agostinho Abifadel','number','35','neighborhood','Terra Nova',
    'ibge_code','3554102','city_name','Taubaté','state_code','SP','floor_number',4,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'floor5', public.logistics_create_quote_server(
  '33333333-3333-4333-8333-333333333333', '91000000-0000-4000-8000-000000000005',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))
  )),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua Agostinho Abifadel','number','35','neighborhood','Terra Nova',
    'ibge_code','3554102','city_name','Taubaté','state_code','SP','floor_number',5,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'floor6_multi', public.logistics_create_quote_server(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', '91000000-0000-4000-8000-000000000006',
  jsonb_build_array(
    jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
      'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',2))),
    jsonb_build_object('supplier_code','MUNDIAL','fulfillment_mode','delivery','pickup_location_id',null,
      'items',jsonb_build_array(jsonb_build_object('variant_id','77777777-7777-4777-8777-777777777777','quantity',2)))
  ),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua Agostinho Abifadel','number','35','neighborhood','Terra Nova',
    'ibge_code','3554102','city_name','Taubaté','state_code','SP','floor_number',6,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
insert into logistics_test_quotes(name, quote_id)
select 'pickup', public.logistics_create_quote_server(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '91000000-0000-4000-8000-000000000007',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','pickup',
    'pickup_location_id',(select id from logistics_test_pickup_ids),
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))
  )), '{}'::jsonb
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is((public.customer_get_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'))->>'status'),
  'awaiting_quote', 'customer reads the current quote after replacing stale fixture snapshots');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);

select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='floor4'), 'VALE', 12345
)->>'quote_status', 'quoted', 'pricing the only group advances quote to quoted');
select ok(jsonb_array_length(public.admin_list_logistics_quotes('quoted')) >= 1, 'admin quote filter returns quoted requests');
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='floor6_multi'), 'VALE', 10000
)->>'quote_status', 'awaiting_quote', 'multi-supplier request remains pending until all groups have freight');
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='floor6_multi'), 'MUNDIAL', 20000
)->>'quote_status', 'quoted', 'multi-supplier request advances after final group is priced');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='floor4')),
  'quoted', 'freight entry persists quoted status');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'), true)->>'status',
  'accepted', 'customer can accept an active quoted request');
select throws_ok($$select public.customer_cancel_logistics_quote((select quote_id from logistics_test_quotes where name='floor4'))$$,
  '22023', null, 'accepted request cannot be cancelled through quote-cancel RPC');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_cancel_logistics_quote((select quote_id from logistics_test_quotes where name='floor5'))->>'status',
  'cancelled', 'customer can cancel their own open quote');
reset role;

-- Force expiry inside this rollback-only fixture, then exercise the real owner RPC.
update public.logistics_quotes set quote_expires_at = now() - interval '1 second'
where id = (select quote_id from logistics_test_quotes where name='floor6_multi');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote((select quote_id from logistics_test_quotes where name='floor6_multi'), true)->>'status',
  'expired', 'expired quote cannot be accepted and transitions to expired');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='floor6_multi')),
  'expired', 'expired status is persisted');

-- Request/address fingerprint changes invalidate accepted snapshots. A cart
-- edit invalidates the subsequent snapshot, and disabling its municipality
-- invalidates a later accepted quote. These records are rollback-only fixtures.
set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'other_change_before', public.logistics_create_quote_server(
  '33333333-3333-4333-8333-333333333333', '90000000-0000-4000-8000-000000000201',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))
  )),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua Agostinho Abifadel','number','35','neighborhood','Terra Nova',
    'ibge_code','3554102','city_name','Taubaté','state_code','SP','floor_number',4,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='other_change_before'), 'VALE', 5000
)->>'quote_status', 'quoted', 'test customer quote becomes answerable before request change');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='other_change_before'), true
)->>'status', 'accepted', 'test customer accepts a quote before changing address');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'other_change_after', public.logistics_create_quote_server(
  '33333333-3333-4333-8333-333333333333', '90000000-0000-4000-8000-000000000202',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',1))
  )),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua Agostinho Abifadel','number','36','neighborhood','Terra Nova',
    'ibge_code','3554102','city_name','Taubaté','state_code','SP','floor_number',4,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='other_change_before')),
  'invalidated', 'material address change invalidates a previously accepted quote');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='other_change_before') and event_type='quote_invalidated'),
  '{"reason":"request_changed"}'::jsonb, 'address invalidation event contains only a non-PII reason');
select is((select actor_type from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='other_change_before') and event_type='quote_invalidated'),
  'server', 'request invalidation is recorded as a server event');
update public.cart_items set quantity=2
where cart_id='99999999-9999-4999-8999-999999999999'
  and variant_id='66666666-6666-4666-8666-666666666666';
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='other_change_after')),
  'invalidated', 'cart mutation invalidates the current customer quote');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='other_change_after') and event_type='quote_invalidated'),
  '{"reason":"cart_changed"}'::jsonb, 'cart invalidation event contains only a non-PII reason');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'area_accepted', public.logistics_create_quote_server(
  '33333333-3333-4333-8333-333333333333', '90000000-0000-4000-8000-000000000203',
  jsonb_build_array(jsonb_build_object(
    'supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',2))
  )),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670',
    'street','Rua de teste rollback-only','number','1','neighborhood','Centro',
    'ibge_code','3544301','city_name','Roseira','state_code','SP','floor_number',5,
    'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='area_accepted'), 'VALE', 6000
)->>'quote_status', 'quoted', 'area invalidation fixture is priced by admin');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='area_accepted'), true
)->>'status', 'accepted', 'customer can accept the area invalidation fixture');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_area('3544301','Roseira',false)->>'is_enabled', 'false',
  'disabling an approved city succeeds and triggers transactional quote invalidation');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='area_accepted')),
  'invalidated', 'disabling delivery coverage invalidates an accepted quote in that city');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='area_accepted') and event_type='quote_invalidated'),
  '{"reason":"area_disabled"}'::jsonb, 'area invalidation event contains only a non-PII reason');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='area_accepted')),
  'invalidated', 'area disable also invalidates its active supplier groups');
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='floor4')),
  'accepted', 'disabling another city does not rewrite a quote for Taubaté');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_area('3544301','Roseira',true)->>'is_enabled', 'true',
  'admin can re-enable the already allowlisted city');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='area_accepted')),
  'invalidated', 're-enabling coverage does not rewrite an older stale quote');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select ok(coalesce((
  select bool_and((select count(*) = 4 from jsonb_object_keys(history.event_data))
    and history.event_data ?& array['event_type','status','timestamp','actor_type']
    and not (history.event_data ? 'payload') and not (history.event_data ? 'actor_id'))
  from jsonb_array_elements((
    select quote.value->'events'
    from jsonb_array_elements(public.admin_list_logistics_quotes('invalidated')) as quote(value)
    where quote.value->>'quote_id' = (select quote_id::text from logistics_test_quotes where name='area_accepted')
  )) as history(event_data)
), false), 'admin quote history exposes only event_type/status/timestamp/actor_type');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='area_accepted'), false)$$,
  '22023', null, 'customer cannot respond after area coverage made an accepted quote stale');
reset role;
update public.cart_items set quantity=3
where cart_id='88888888-8888-4888-8888-888888888888'
  and variant_id='66666666-6666-4666-8666-666666666666';
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='floor4')),
  'invalidated', 'cart edit also invalidates a previously accepted quote');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='floor4') and event_type='quote_invalidated'),
  '{"reason":"cart_changed"}'::jsonb, 'accepted quote cart invalidation event has no PII');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'supplier_change_before', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000204',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',3)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',4,'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='supplier_change_before'), 'VALE', 13500
)->>'quote_status', 'quoted', 'supplier invalidation fixture is priced before configuration change');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='supplier_change_before'), true
)->>'status', 'accepted', 'customer accepts a quote before supplier configuration changes');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_update_logistics_supplier(
  (select id from logistics_test_supplier_ids where code='VALE'), 'Vale atualizado', true, true, true, 8, 8, true, null
)->>'display_name', 'Vale atualizado', 'admin supplier configuration update succeeds with revised display_name signature');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='supplier_change_before')),
  'invalidated', 'supplier configuration change invalidates its previously accepted quote');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='supplier_change_before')),
  'invalidated', 'supplier change invalidates the quote group');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='supplier_change_before') and event_type='quote_invalidated'),
  '{"reason":"supplier_changed"}'::jsonb, 'supplier invalidation records only the non-PII reason');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'pickup_change_before', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000205',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','pickup',
    'pickup_location_id',(select id from logistics_test_pickup_ids),
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',3)))),
  '{}'::jsonb
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='pickup_change_before'), 'VALE', 2500
)->>'quote_status', 'quoted', 'pickup invalidation fixture is priced before location change');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='pickup_change_before'), true
)->>'status', 'accepted', 'customer accepts pickup quote before pickup location changes');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_save_logistics_pickup_location(
  (select id from logistics_test_pickup_ids),
  (select id from logistics_test_supplier_ids where code='VALE'), 'VALE_GALPAO',
  'Galpão Vale', 'Rua Agostinho Abifadel', '36', 'Terra Nova', '12081-670', '3554102', true
)->>'street_number', '36', 'admin pickup RPC updates manually supplied location fields');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='pickup_change_before')),
  'invalidated', 'pickup location update invalidates its previously accepted quote');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='pickup_change_before')),
  'invalidated', 'pickup location update invalidates the quote group');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='pickup_change_before') and event_type='quote_invalidated'),
  '{"reason":"pickup_location_changed"}'::jsonb, 'pickup invalidation records only the non-PII reason');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'product_supplier_change_before', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000206',
  jsonb_build_array(jsonb_build_object('supplier_code','VALE','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',3)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',4,'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='product_supplier_change_before'), 'VALE', 3000
)->>'quote_status', 'quoted', 'product supplier assignment fixture is priced before reassignment');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='product_supplier_change_before'), true
)->>'status', 'accepted', 'customer accepts quote before product supplier reassignment');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
-- Supabase TEST has the owner-authorized 20261002175919 migration applied:
-- admin MFA is intentionally optional, and membership remains the authorization gate.
select ok(private.is_catalog_admin(), 'AAL1 catalog admin remains authorized while optional MFA is active');
with supplier_changed as (
  update public.products
  set supplier_id = (select id from logistics_test_supplier_ids where code='MUNDIAL')
  where id = '44444444-4444-4444-8444-444444444444'
  returning id
)
select is((select count(*)::integer from supplier_changed), 1,
  'catalog admin can directly edit a test product supplier under the existing RLS policy');
reset role;
select is((select supplier_id from public.products where id='44444444-4444-4444-8444-444444444444'),
  (select id from logistics_test_supplier_ids where code='MUNDIAL'),
  'direct product edit changes only the selected test product supplier');
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='product_supplier_change_before')),
  'invalidated', 'supplier reassignment invalidates an accepted quote for that product');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='product_supplier_change_before')),
  'invalidated', 'supplier reassignment invalidates the accepted quote group');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='product_supplier_change_before') and event_type='quote_invalidated'),
  '{"reason":"product_supplier_changed"}'::jsonb, 'supplier reassignment event contains only a non-PII reason');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'delivery_terms_change_before', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000207',
  jsonb_build_array(jsonb_build_object('supplier_code','MUNDIAL','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',3)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',5,'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='delivery_terms_change_before'), 'MUNDIAL', 3500
)->>'quote_status', 'quoted', 'delivery terms fixture is priced before settings change');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is(public.customer_respond_logistics_quote(
  (select quote_id from logistics_test_quotes where name='delivery_terms_change_before'), true
)->>'status', 'accepted', 'customer accepts quote before delivery terms change');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_update_logistics_settings(1250,4,60,null)->>'floor_charge_cents',
  '1250', 'admin can update the per-floor charge');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='delivery_terms_change_before')),
  'invalidated', 'floor charge or included floor update invalidates an accepted delivery quote');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='delivery_terms_change_before')),
  'invalidated', 'delivery terms change invalidates the accepted quote group');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='delivery_terms_change_before') and event_type='quote_invalidated'),
  '{"reason":"delivery_terms_changed"}'::jsonb, 'delivery terms invalidation event contains only a non-PII reason');

set local role service_role;
select set_config('request.jwt.claims', '{}', true);
insert into logistics_test_quotes(name, quote_id)
select 'quote_expiry_change_before', public.logistics_create_quote_server(
  '22222222-2222-4222-8222-222222222222', '90000000-0000-4000-8000-000000000208',
  jsonb_build_array(jsonb_build_object('supplier_code','MUNDIAL','fulfillment_mode','delivery','pickup_location_id',null,
    'items',jsonb_build_array(jsonb_build_object('variant_id','66666666-6666-4666-8666-666666666666','quantity',3)))),
  jsonb_build_object('postal_code','12081670','cep_verified_postal_code','12081670','street','Rua Agostinho Abifadel',
    'number','35','neighborhood','Terra Nova','ibge_code','3554102','city_name','Taubaté','state_code','SP',
    'floor_number',5,'cep_verification_source','viacep','cep_verified_at',now()::text)
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select is(public.admin_set_logistics_group_freight(
  (select quote_id from logistics_test_quotes where name='quote_expiry_change_before'), 'MUNDIAL', 3500
)->>'quote_status', 'quoted', 'expiry fixture is priced before expiry setting changes');
select is(public.admin_update_logistics_settings(1250,4,30,null)->>'quote_expiration_minutes',
  '30', 'admin can update the quote expiry setting');
reset role;
select is((select status from public.logistics_quotes where id=(select quote_id from logistics_test_quotes where name='quote_expiry_change_before')),
  'invalidated', 'expiry setting update invalidates a quote awaiting customer response');
select is((select status from public.logistics_quote_groups where quote_id=(select quote_id from logistics_test_quotes where name='quote_expiry_change_before')),
  'invalidated', 'expiry setting update invalidates its quote group');
select is((select payload from public.logistics_quote_events where quote_id=(select quote_id from logistics_test_quotes where name='quote_expiry_change_before') and event_type='quote_invalidated'),
  '{"reason":"quote_expiry_changed"}'::jsonb, 'expiry invalidation event contains only a non-PII reason');

select ok((select count(*) > 0 from public.logistics_quote_events), 'quote lifecycle emits audit events');
select ok((select count(*) > 0 from public.logistics_admin_events), 'admin changes emit audit events');

select * from finish();
rollback;
