begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

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
  (select count(*)::integer from public.get_catalog_products(null, null)),
  0,
  'draft products are excluded from the public catalog'
);

select is(
  (select count(*)::integer from public.get_catalog_products(null, 'sofa-belize')),
  0,
  'draft product detail is not publicly addressable'
);

select is(
  (select count(*)::integer from public.get_catalog_categories()),
  1,
  'active category metadata is readable through the public projection'
);

select * from finish();
rollback;
