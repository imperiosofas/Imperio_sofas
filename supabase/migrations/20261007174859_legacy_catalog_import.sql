-- Private idempotency ledger for the authorized legacy catalog import.
-- The import RPC is invoker-only and executable solely by service_role.
alter table public.product_media
  add column attributes jsonb not null default '{}'::jsonb
  check (jsonb_typeof(attributes) = 'object');

create table private.legacy_catalog_imports (
  source_product_id uuid primary key,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_payload jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  target_product_id uuid not null unique references public.products(id) on delete restrict,
  applied_snapshot jsonb not null check (jsonb_typeof(applied_snapshot) = 'object'),
  cleanup_storage_paths text[] not null default '{}',
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.legacy_catalog_imports enable row level security;
revoke all on table private.legacy_catalog_imports from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.legacy_catalog_imports to service_role;

create or replace function private.legacy_product_snapshot(p_product_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'product', (
      select jsonb_build_object(
        'id', p.id,
        'category_id', p.category_id,
        'name', p.name,
        'slug', p.slug,
        'description', p.description,
        'status', p.status,
        'free_shipping', p.free_shipping,
        'seo_title', p.seo_title,
        'seo_description', p.seo_description
      )
      from public.products p
      where p.id = p_product_id
    ),
    'variants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'sku', v.sku,
          'fabric', v.fabric,
          'color', v.color,
          'width_mm', v.width_mm,
          'depth_mm', v.depth_mm,
          'height_mm', v.height_mm,
          'attributes', v.attributes,
          'price_cents', v.price_cents,
          'is_active', v.is_active,
          'inventory', case when i.variant_id is null then null else jsonb_build_object(
            'on_hand', i.on_hand,
            'reserved', i.reserved,
            'low_stock_threshold', i.low_stock_threshold
          ) end
        ) order by v.sku, v.id
      )
      from public.product_variants v
      left join public.inventory i on i.variant_id = v.id
      where v.product_id = p_product_id
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'storage_path', m.storage_path,
          'alt_text', m.alt_text,
          'media_type', m.media_type,
          'position', m.position,
          'variant_id', m.variant_id,
          'attributes', m.attributes
        ) order by m.position, m.id
      )
      from public.product_media m
      where m.product_id = p_product_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function private.legacy_product_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.legacy_product_snapshot(uuid) to service_role;

create or replace function public.import_legacy_catalog_product(
  p_source_product_id uuid,
  p_source_hash text,
  p_source_payload jsonb,
  p_category_id uuid,
  p_product jsonb,
  p_variants jsonb,
  p_media jsonb,
  p_replace_test_fixture boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_import private.legacy_catalog_imports%rowtype;
  v_product_id uuid;
  v_fixture_variant_id uuid;
  v_variant_id uuid;
  v_variant jsonb;
  v_media jsonb;
  v_category_exists boolean;
  v_cleanup_paths text[] := '{}';
  v_snapshot jsonb;
  v_is_fixture boolean := false;
  v_variant_index integer := 0;
  v_fixture_variant public.product_variants%rowtype;
  v_fixture_inventory public.inventory%rowtype;
  v_fixture_media public.product_media%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_source_product_id::text));

  if p_source_hash is null
    or p_source_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_source_payload) is distinct from 'object'
    or jsonb_typeof(p_product) is distinct from 'object'
    or jsonb_typeof(p_variants) is distinct from 'array'
    or jsonb_array_length(p_variants) not between 1 and 30
    or jsonb_typeof(p_media) is distinct from 'array'
    or jsonb_array_length(p_media) not between 1 and 30 then
    raise exception 'invalid_legacy_import_payload' using errcode = '22023';
  end if;

  select exists(select 1 from public.categories c where c.id = p_category_id)
  into v_category_exists;
  if not v_category_exists then
    raise exception 'legacy_category_not_found' using errcode = '23503';
  end if;

  select * into v_import
  from private.legacy_catalog_imports i
  where i.source_product_id = p_source_product_id
  for update;

  if found then
    if v_import.source_hash <> p_source_hash then
      raise exception 'legacy_source_changed_review_required' using errcode = '22023';
    end if;
    v_snapshot := private.legacy_product_snapshot(v_import.target_product_id);
    if v_snapshot is distinct from v_import.applied_snapshot then
      raise exception 'legacy_import_target_modified_review_required' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'product_id', v_import.target_product_id,
      'already_imported', true,
      'cleanup_storage_paths', to_jsonb(v_import.cleanup_storage_paths)
    );
  end if;

  select p.id into v_product_id
  from public.products p
  where p.slug = p_product ->> 'slug'
  for update;

  if found then
    if not p_replace_test_fixture
      or p_source_product_id <> 'ca706444-d0fc-4960-985c-07b7a394705b'::uuid
      or v_product_id is distinct from '26b943bd-45f8-49c2-989c-0f1ddcbea356'::uuid
      or p_product ->> 'slug' is distinct from 'sofa-berlim'
      or p_product ->> 'name' is distinct from 'Sofá Berlim'
      or (select p.status from public.products p where p.id = v_product_id) is distinct from 'active'
      or (select p.description from public.products p where p.id = v_product_id) is distinct from 'Sofá Berlim'
      or (select count(*) from public.product_variants v where v.product_id = v_product_id) <> 1
      or (select count(*) from public.product_media m where m.product_id = v_product_id) <> 1 then
      raise exception 'legacy_product_slug_conflict' using errcode = '23505';
    end if;

    select * into v_fixture_variant
    from public.product_variants v
    where v.product_id = v_product_id;
    select * into v_fixture_inventory
    from public.inventory i
    where i.variant_id = v_fixture_variant.id;
    select * into v_fixture_media
    from public.product_media m
    where m.product_id = v_product_id;

    if v_fixture_variant.id is distinct from '270c295e-017f-44af-986c-0594c1f1eb0f'::uuid
      or v_fixture_variant.sku is distinct from 'TEST-PUB-20261005-01'
      or v_fixture_variant.price_cents is distinct from 100000
      or v_fixture_variant.width_mm is distinct from 10000
      or v_fixture_variant.depth_mm is distinct from 10000
      or v_fixture_variant.height_mm is distinct from 10000
      or v_fixture_variant.fabric is distinct from '10000'
      or v_fixture_variant.color is distinct from 'Branco Gelo'
      or v_fixture_inventory.on_hand is distinct from 10
      or v_fixture_inventory.reserved is distinct from 0
      or v_fixture_inventory.low_stock_threshold is distinct from 5
      or v_fixture_media.id is distinct from '327b1530-e384-4008-b6d0-5a9ae39e2d16'::uuid
      or v_fixture_media.storage_path is distinct from 'products/26b943bd-45f8-49c2-989c-0f1ddcbea356/2caec054-988c-4bd4-aba3-1c8bb3620b66.webp' then
      raise exception 'legacy_test_fixture_drifted_review_required' using errcode = '22023';
    end if;

    v_is_fixture := true;
    v_fixture_variant_id := v_fixture_variant.id;
    v_cleanup_paths := array[v_fixture_media.storage_path];
    -- Preserve the product and first variant IDs so references (including a
    -- customer's cart row) remain intact while replacing only fixture fields.
    update public.products
    set status = 'draft',
        category_id = p_category_id,
        name = p_product ->> 'name',
        slug = p_product ->> 'slug',
        description = coalesce(p_product ->> 'description', ''),
        free_shipping = coalesce((p_product ->> 'free_shipping')::boolean, false),
        seo_title = null,
        seo_description = null
    where id = v_product_id;
    delete from public.product_media where id = v_fixture_media.id;
  else
    insert into public.products(id, category_id, name, slug, description, status, free_shipping)
    values (
      coalesce(nullif(p_product ->> 'id', '')::uuid, gen_random_uuid()),
      p_category_id,
      p_product ->> 'name',
      p_product ->> 'slug',
      coalesce(p_product ->> 'description', ''),
      'draft',
      coalesce((p_product ->> 'free_shipping')::boolean, false)
    ) returning id into v_product_id;
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    if v_is_fixture and v_variant_index = 0 then
      update public.product_variants
      set sku = v_variant ->> 'sku',
          fabric = nullif(v_variant ->> 'fabric', ''),
          color = nullif(v_variant ->> 'color', ''),
          width_mm = nullif(v_variant ->> 'width_mm', '')::integer,
          depth_mm = nullif(v_variant ->> 'depth_mm', '')::integer,
          height_mm = nullif(v_variant ->> 'height_mm', '')::integer,
          attributes = coalesce(v_variant -> 'attributes', '{}'::jsonb),
          price_cents = (v_variant ->> 'price_cents')::integer,
          is_active = coalesce((v_variant ->> 'is_active')::boolean, false)
      where id = v_fixture_variant_id;
      v_variant_id := v_fixture_variant_id;
      update public.inventory
      set on_hand = (v_variant ->> 'on_hand')::integer,
          reserved = 0,
          low_stock_threshold = (v_variant ->> 'low_stock_threshold')::integer,
          version = version + 1
      where variant_id = v_variant_id;
      if not found then
        raise exception 'legacy_fixture_inventory_missing' using errcode = 'P0002';
      end if;
    else
      insert into public.product_variants(
        product_id, sku, fabric, color, width_mm, depth_mm, height_mm,
        attributes, price_cents, is_active
      ) values (
        v_product_id,
        v_variant ->> 'sku',
        nullif(v_variant ->> 'fabric', ''),
        nullif(v_variant ->> 'color', ''),
        nullif(v_variant ->> 'width_mm', '')::integer,
        nullif(v_variant ->> 'depth_mm', '')::integer,
        nullif(v_variant ->> 'height_mm', '')::integer,
        coalesce(v_variant -> 'attributes', '{}'::jsonb),
        (v_variant ->> 'price_cents')::integer,
        coalesce((v_variant ->> 'is_active')::boolean, false)
      ) returning id into v_variant_id;
      insert into public.inventory(variant_id, on_hand, reserved, low_stock_threshold)
      values (
        v_variant_id,
        (v_variant ->> 'on_hand')::integer,
        0,
        (v_variant ->> 'low_stock_threshold')::integer
      );
    end if;
    v_variant_index := v_variant_index + 1;
  end loop;

  for v_media in select value from jsonb_array_elements(p_media)
  loop
    insert into public.product_media(product_id, variant_id, storage_path, alt_text, media_type, position, attributes)
    values (
      v_product_id,
      nullif(v_media ->> 'variant_id', '')::uuid,
      v_media ->> 'storage_path',
      v_media ->> 'alt_text',
      'image',
      coalesce((v_media ->> 'position')::integer, 0),
      coalesce(v_media -> 'attributes', '{}'::jsonb)
    );
  end loop;

  v_snapshot := private.legacy_product_snapshot(v_product_id);
  insert into private.legacy_catalog_imports(
    source_product_id, source_hash, source_payload, target_product_id, applied_snapshot, cleanup_storage_paths
  ) values (
    p_source_product_id, p_source_hash, p_source_payload, v_product_id, v_snapshot, v_cleanup_paths
  );

  return jsonb_build_object(
    'product_id', v_product_id,
    'already_imported', false,
    'replaced_test_fixture', v_is_fixture,
    'reused_fixture_variant_id', v_fixture_variant_id,
    'cleanup_storage_paths', to_jsonb(v_cleanup_paths)
  );
end;
$$;

revoke all on function public.import_legacy_catalog_product(uuid, text, jsonb, uuid, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_legacy_catalog_product(uuid, text, jsonb, uuid, jsonb, jsonb, jsonb, boolean) to service_role;

create or replace function public.complete_legacy_catalog_cleanup(p_source_product_id uuid, p_paths text[])
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_remaining text[];
begin
  update private.legacy_catalog_imports i
  set cleanup_storage_paths = array(
    select unnest(i.cleanup_storage_paths)
    except
    select unnest(coalesce(p_paths, '{}'::text[]))
  ),
  updated_at = now()
  where i.source_product_id = p_source_product_id;
  if not found then
    raise exception 'legacy_import_not_found' using errcode = 'P0002';
  end if;
  select i.cleanup_storage_paths into v_remaining
  from private.legacy_catalog_imports i
  where i.source_product_id = p_source_product_id;
  return cardinality(v_remaining) = 0;
end;
$$;

revoke all on function public.complete_legacy_catalog_cleanup(uuid, text[]) from public, anon, authenticated;
grant execute on function public.complete_legacy_catalog_cleanup(uuid, text[]) to service_role;
