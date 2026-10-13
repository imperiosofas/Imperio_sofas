begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.products (id, category_id, name, slug, created_at)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', id, 'TEST PLP Alpha',
  'test-plp-alpha', now() - interval '2 days'
from public.categories where slug = 'sofas';
insert into public.products (id, category_id, name, slug, created_at)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', id, 'TEST PLP Beta',
  'test-plp-beta', now() - interval '1 day'
from public.categories where slug = 'sofas';
insert into public.products (id, category_id, name, slug)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', id, 'TEST PLP Draft',
  'test-plp-draft'
from public.categories where slug = 'sofas';

insert into public.product_variants (id, product_id, sku, width_mm, price_cents, is_active, fabric)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'TEST-PLP-A1', 2000, 200000, true, 'TEST-Veludo'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'TEST-PLP-A2', 2400, 250000, true, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'TEST-PLP-B', 2200, 300000, true, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'TEST-PLP-D', 2600, 400000, true, null);
insert into public.inventory (variant_id, on_hand)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 5);
insert into public.product_media (product_id, storage_path, alt_text)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'test/plp-alpha.webp', 'TEST Alpha'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'test/plp-beta.webp', 'TEST Beta');
update public.products set status = 'active'
where slug in ('test-plp-alpha', 'test-plp-beta');

set local role anon;
select throws_ok($$select * from public.products$$, '42501', null,
  'anon cannot read the products table');
select is((public.get_catalog_listing(null, 'TEST PLP')->>'total')::integer, 2,
  'only the two published fixtures are visible');
select is((public.get_catalog_listing(null, 'TEST PLP Draft')->>'total')::integer, 0,
  'draft is invisible');
select is(public.get_catalog_listing(null, 'TEST PLP', null, null, null, 'price_asc')
  #>> '{products,0,slug}', 'test-plp-alpha', 'minimum sellable price sorts ascending');
select is(public.get_catalog_listing(null, 'TEST PLP', null, null, null, 'price_desc')
  #>> '{products,0,slug}', 'test-plp-beta', 'maximum price sorts descending');
select is(public.get_catalog_listing(null, 'TEST PLP')
  #>> '{products,0,slug}', 'test-plp-beta', 'newest uses product creation date');
select is((public.get_catalog_listing(null, 'TEST PLP', null, 220000)->>'total')::integer,
  1, 'price filter uses the minimum sellable variant price');
select is((public.get_catalog_listing(null, 'TEST PLP', null, null, array[2400])->>'total')::integer,
  1, 'width filter sees every sellable variant');
select is((public.get_catalog_listing(null, 'TEST PLP', null, null, array[2000, 2200])->>'total')::integer,
  2, 'multiple widths combine with OR');
select is((public.get_catalog_listing(null, 'TEST PLP', null, 220000, array[2200])->>'total')::integer,
  0, 'price and width combine with AND');
select is(public.get_catalog_listing(null, 'TEST PLP', null, null, null, 'price_asc', 2, 1)
  #>> '{products,0,slug}', 'test-plp-beta', 'pagination follows global sort');
select is((public.get_catalog_listing(null, 'TEST PLP') #>> '{products,1,price_count}')::integer,
  2, 'card can distinguish multiple real sellable prices');
select is((public.get_catalog_listing(null, 'veludo')->>'total')::integer,
  1, 'search includes public fabric of a sellable variant');

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
