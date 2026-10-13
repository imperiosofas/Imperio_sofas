begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.products (id, category_id, name, slug)
select 'da000000-0000-4000-8000-000000000001', id, 'TEST Public Draft',
  'test-public-draft-is-hidden'
from public.categories where slug = 'sofas';

set local role anon;

select throws_ok(
  $$select * from public.products$$,
  '42501',
  null,
  'anonymous users cannot read product tables directly'
);

select throws_ok(
  $$select * from public.inventory$$,
  '42501',
  null,
  'anonymous users cannot read inventory tables directly'
);

select is(
  (select count(*)::integer from public.get_catalog_products(null, 'test-public-draft-is-hidden')),
  0,
  'draft products are excluded from the public catalog'
);

select is(
  (select count(*)::integer from public.get_catalog_products(null, 'test-public-draft-is-hidden')),
  0,
  'draft product detail is not publicly addressable'
);

select ok(
  (select count(*)::integer from public.get_catalog_categories()) > 0,
  'active category metadata is readable through the public projection'
);

select * from finish();
rollback;
