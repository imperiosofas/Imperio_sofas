begin;

create extension if not exists pgtap
with
  schema extensions;

select
  plan (63);

insert into
  public.categories (id, name, slug, position, is_active)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'ANALYTICS Main',
    'analytics-main',
    910,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'ANALYTICS Other',
    'analytics-other',
    920,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'ANALYTICS Empty',
    'analytics-empty',
    930,
    true
  ),
  (
    'c0000000-0000-4000-8000-000000000004',
    'ANALYTICS Limits',
    'analytics-limits',
    940,
    true
  );

insert into
  public.products (id, category_id, name, slug, status)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'ANALYTICS Main Active',
    'analytics-main-active',
    'draft'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'ANALYTICS Main Draft',
    'analytics-main-draft',
    'draft'
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001',
    'ANALYTICS Main Archived',
    'analytics-main-archived',
    'archived'
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000002',
    'ANALYTICS Other Active',
    'analytics-other-active',
    'draft'
  );

insert into
  public.product_variants (
    id,
    product_id,
    sku,
    width_mm,
    price_cents,
    is_active
  )
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'ANL-MAIN-AVAILABLE',
    2000,
    100000,
    true
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'ANL-MAIN-LOW',
    2200,
    110000,
    true
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000001',
    'ANL-MAIN-OOS',
    2400,
    120000,
    true
  ),
  (
    'b0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000001',
    'ANL-MAIN-INACTIVE',
    2600,
    130000,
    false
  ),
  (
    'b0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000002',
    'ANL-DRAFT-AVAILABLE',
    2000,
    140000,
    true
  ),
  (
    'b0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000003',
    'ANL-ARCHIVED-INACTIVE',
    2000,
    150000,
    false
  ),
  (
    'b0000000-0000-4000-8000-000000000007',
    'a0000000-0000-4000-8000-000000000004',
    'ANL-OTHER-AVAILABLE',
    2000,
    160000,
    true
  );

insert into
  public.inventory (
    variant_id,
    on_hand,
    reserved,
    low_stock_threshold
  )
values
  ('b0000000-0000-4000-8000-000000000001', 8, 1, 5),
  ('b0000000-0000-4000-8000-000000000002', 4, 0, 5),
  ('b0000000-0000-4000-8000-000000000003', 2, 2, 5),
  ('b0000000-0000-4000-8000-000000000004', 100, 0, 5),
  ('b0000000-0000-4000-8000-000000000005', 10, 1, 0),
  ('b0000000-0000-4000-8000-000000000006', 50, 0, 5),
  ('b0000000-0000-4000-8000-000000000007', 30, 0, 10);

insert into
  public.products (id, category_id, name, slug, status)
select
  (
    'f1000000-0000-4000-8000-' || lpad(series.n::text, 12, '0')
  )::uuid,
  'c0000000-0000-4000-8000-000000000004'::uuid,
  'ANALYTICS Limit Product ' || lpad(series.n::text, 3, '0'),
  'analytics-limit-product-' || series.n,
  'draft'
from
  generate_series(1, 101) as series (n);

insert into
  public.product_variants (
    id,
    product_id,
    sku,
    width_mm,
    price_cents,
    is_active
  )
select
  (
    'f2000000-0000-4000-8000-' || lpad(series.n::text, 12, '0')
  )::uuid,
  (
    'f1000000-0000-4000-8000-' || lpad(series.n::text, 12, '0')
  )::uuid,
  'ANL-LIMIT-' || lpad(series.n::text, 3, '0'),
  2000,
  100000,
  true
from
  generate_series(1, 101) as series (n);

insert into
  public.inventory (
    variant_id,
    on_hand,
    reserved,
    low_stock_threshold
  )
select
  (
    'f2000000-0000-4000-8000-' || lpad(series.n::text, 12, '0')
  )::uuid,
  10,
  0,
  5
from
  generate_series(1, 101) as series (n);

insert into
  public.product_media (product_id, storage_path, alt_text, position)
select
  id,
  'analytics-test/' || id::text || '.webp',
  'Imagem de fixture Analytics',
  0
from public.products
where slug in ('analytics-main-active', 'analytics-other-active')
  or slug like 'analytics-limit-product-%';

-- Publish only after each fixture has a valid category, priced active SKU,
-- and available inventory. Then zero the limit variants to model later sell-out.
update public.products
set status = 'active'
where slug in ('analytics-main-active', 'analytics-other-active')
  or slug like 'analytics-limit-product-%';

update public.inventory as inventory
set on_hand = 0
from public.product_variants as variant
where variant.id = inventory.variant_id
  and variant.sku like 'ANL-LIMIT-%';

insert into
  auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
values
  (
    'd0000000-0000-4000-8000-000000000001',
    null,
    'authenticated',
    'authenticated',
    'analytics-admin-test@example.invalid',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}'
  );

insert into
  public.catalog_admins (user_id)
values
  ('d0000000-0000-4000-8000-000000000001');

select
  is (
    has_function_privilege (
      'anon',
      'public.admin_get_analytics_snapshot(uuid)',
      'execute'
    ),
    false,
    'anonymous role, including inherited PUBLIC grants, cannot execute the snapshot RPC'
  );

select
  is (
    has_function_privilege (
      'authenticated',
      'public.admin_get_analytics_snapshot(uuid)',
      'execute'
    ),
    true,
    'authenticated role has the grant needed for membership-checked RPC execution'
  );

set
  local role anon;

select
  throws_ok (
    $$select public.admin_get_analytics_snapshot()$$,
    '42501',
    null,
    'anonymous clients cannot execute the admin analytics RPC'
  );

select
  throws_ok (
    $$select * from public.inventory$$,
    '42501',
    null,
    'anonymous clients cannot read exact inventory rows'
  );

select
  ok (
    coalesce(
      (
        select
          item ? 'stock_status'
          and not (
            item ?| array[
              'on_hand',
              'reserved',
              'available_units',
              'sellable_units'
            ]
          )
        from
          jsonb_array_elements(
            public.get_catalog_listing (null, 'ANALYTICS') -> 'products'
          ) as listing (item)
        where
          item ->> 'slug' = 'analytics-main-active'
      ),
      false
    ),
    'the public storefront exposes qualitative stock status but no exact inventory counts'
  );

set
  local role authenticated;

select
  set_config(
    'request.jwt.claims',
    '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
    true
  );

select
  is (
    private.is_catalog_admin (),
    false,
    'an authenticated client without catalog membership is not an administrator'
  );

select
  throws_ok (
    $$select public.admin_get_analytics_snapshot()$$,
    '42501',
    null,
    'an authenticated non-admin cannot execute the analytics snapshot'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.inventory
    ),
    0,
    'an authenticated non-admin cannot read exact inventory rows through existing RLS'
  );

select
  set_config(
    'request.jwt.claims',
    '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
    true
  );

select
  is (
    private.is_catalog_admin (),
    true,
    'an explicitly provisioned admin passes the existing membership helper'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.inventory as i
        join public.product_variants as pv on pv.id = i.variant_id
      where
        pv.sku like 'ANL-%'
    ),
    108,
    'an admin retains existing direct access to exact inventory rows'
  );

select
  ok (
    public.admin_get_analytics_snapshot () ?& array[
      'snapshot_at',
      'summary',
      'categories',
      'attention',
      'top_inventory_products'
    ],
    'the admin snapshot includes every top-level contract field'
  );

select
  ok (
    public.admin_get_analytics_snapshot () -> 'summary' ?& array[
      'products_total',
      'active_products',
      'draft_products',
      'archived_products',
      'categories_total',
      'active_variants',
      'low_stock_variants',
      'out_of_stock_variants',
      'available_units_total'
    ],
    'the summary includes every contract metric'
  );

select
  ok (
    public.admin_get_analytics_snapshot () #> '{categories,0}' ?& array[
      'category_id',
      'category_name',
      'product_count',
      'variants_total',
      'variants_in_stock',
      'low_stock_variants',
      'out_of_stock_variants',
      'available_units'
    ],
    'category groups include every contract field'
  );

select
  ok (
    public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #> '{attention,0}' ?& array[
      'product_id',
      'product_name',
      'slug',
      'category_name',
      'variant_id',
      'sku',
      'available_units',
      'low_stock_threshold',
      'is_low_stock'
    ],
    'attention entries include every contract field'
  );

select
  ok (
    public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #> '{top_inventory_products,0}' ?& array[
      'product_id',
      'product_name',
      'slug',
      'category_name',
      'available_units',
      'active_variant_count'
    ],
    'top inventory entries include every contract field'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) ->> 'snapshot_at'
    ) is not null,
    true,
    'the admin snapshot includes its capture timestamp'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,products_total}'
    )::integer,
    3,
    'the selected category includes active, draft, and archived products'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,active_products}'
    )::integer,
    1,
    'the selected category counts active products'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,draft_products}'
    )::integer,
    1,
    'the selected category counts draft products'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,archived_products}'
    )::integer,
    1,
    'the selected category counts archived products'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,categories_total}'
    )::integer,
    1,
    'the category filter scopes category totals'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,active_variants}'
    )::integer,
    4,
    'active variant totals exclude inactive variants across product states'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,low_stock_variants}'
    )::integer,
    1,
    'low stock counts positive availability at or below a positive threshold'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,out_of_stock_variants}'
    )::integer,
    1,
    'out of stock counts active variants whose available units are zero'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{summary,available_units_total}'
    )::integer,
    20,
    'available units subtract reserved stock and exclude inactive variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,product_count}'
    )::integer,
    3,
    'category aggregates include all product states'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,variants_total}'
    )::integer,
    6,
    'category variants_total includes active and inactive variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,variants_in_stock}'
    )::integer,
    3,
    'category in-stock count includes active variants with positive availability'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,low_stock_variants}'
    )::integer,
    1,
    'category low-stock count follows the positive-threshold rule'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,out_of_stock_variants}'
    )::integer,
    1,
    'category out-of-stock count uses available rather than on-hand stock'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{categories,0,available_units}'
    )::integer,
    20,
    'category available units exclude reserved and inactive stock'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) -> 'top_inventory_products'
    ),
    2,
    'top inventory contains products with active variants'
  );

select
  is (
    public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{top_inventory_products,0,product_id}',
    'a0000000-0000-4000-8000-000000000001',
    'top inventory orders by available units'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{top_inventory_products,0,active_variant_count}'
    )::integer,
    3,
    'top inventory reports active variant count'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{top_inventory_products,0,available_units}'
    )::integer,
    11,
    'top inventory reports exact available units to the admin'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) -> 'attention'
    ),
    2,
    'attention contains low-stock and out-of-stock active variants'
  );

select
  is (
    public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{attention,0,sku}',
    'ANL-MAIN-OOS',
    'out-of-stock variants sort before low-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{attention,0,is_low_stock}'
    )::boolean,
    false,
    'out-of-stock attention is not mislabeled as low stock'
  );

select
  is (
    public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{attention,1,sku}',
    'ANL-MAIN-LOW',
    'the low-stock variant is included in attention'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000001'::uuid) #>> '{attention,1,is_low_stock}'
    )::boolean,
    true,
    'positive availability at the threshold is flagged as low stock'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000002'::uuid) #>> '{summary,products_total}'
    )::integer,
    1,
    'category filter excludes products in other categories'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000002'::uuid) #>> '{summary,active_variants}'
    )::integer,
    1,
    'category filter scopes active variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000002'::uuid) #>> '{summary,available_units_total}'
    )::integer,
    30,
    'category filter scopes available units'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000002'::uuid) -> 'categories'
    ),
    1,
    'category filter returns only its category group'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,products_total}'
    )::integer,
    0,
    'an empty category has no products'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,categories_total}'
    )::integer,
    1,
    'an empty selected category remains in the category total'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,active_variants}'
    )::integer,
    0,
    'an empty category has no active variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,low_stock_variants}'
    )::integer,
    0,
    'an empty category has no low-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,out_of_stock_variants}'
    )::integer,
    0,
    'an empty category has no out-of-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{summary,available_units_total}'
    )::integer,
    0,
    'an empty category has no available inventory units'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) -> 'categories'
    ),
    1,
    'empty category groups are retained in the response'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,product_count}'
    )::integer,
    0,
    'empty category group has a zero product count'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,variants_total}'
    )::integer,
    0,
    'empty category group has zero variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,variants_in_stock}'
    )::integer,
    0,
    'empty category group has zero in-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,low_stock_variants}'
    )::integer,
    0,
    'empty category group has zero low-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,out_of_stock_variants}'
    )::integer,
    0,
    'empty category group has zero out-of-stock variants'
  );

select
  is (
    (
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) #>> '{categories,0,available_units}'
    )::integer,
    0,
    'empty category group has zero available units'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) -> 'attention'
    ),
    0,
    'empty category has no inventory attention items'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000003'::uuid) -> 'top_inventory_products'
    ),
    0,
    'empty category has no top inventory products'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000004'::uuid) -> 'attention'
    ),
    100,
    'attention is capped at 100 variants'
  );

select
  is (
    jsonb_array_length(
      public.admin_get_analytics_snapshot ('c0000000-0000-4000-8000-000000000004'::uuid) -> 'top_inventory_products'
    ),
    20,
    'top inventory is capped at 20 products'
  );

select
  ok (
    jsonb_typeof(public.admin_get_analytics_snapshot ()) = 'object',
    'the unfiltered admin snapshot is available'
  );

select
  ok (
    public.admin_get_analytics_snapshot () -> 'categories' @> '[{"category_id":"c0000000-0000-4000-8000-000000000003"}]'::jsonb,
    'the unfiltered category list retains empty category groups'
  );

do $$
declare
  line text;
begin
  for line in select * from finish() loop
    if line like 'not ok%' or line like '# Looks like%' then
      raise exception 'pgtap failure: %', line;
    end if;
  end loop;
end;
$$;

rollback;

