-- Product measurements are descriptive data, not a universal sales prerequisite.
alter table public.product_variants drop constraint if exists product_variants_check;
alter table public.product_variants
  add constraint product_variants_sellable_fields_check
  check (not is_active or (sku is not null and price_cents > 0));

create or replace function private.guard_catalog_product_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    if not exists (
      select 1
      from public.categories c
      join public.product_variants pv on pv.product_id = new.id and pv.is_active
      join public.inventory i on i.variant_id = pv.id and i.on_hand > i.reserved
      where c.id = new.category_id and c.is_active
        and nullif(trim(pv.sku), '') is not null and pv.price_cents > 0
    ) then
      raise exception 'publish_requirements_not_met'
        using errcode = '23514', hint = 'Categoria ativa, SKU, preço e estoque disponível são obrigatórios.';
    end if;
    if not exists (
      select 1 from public.product_media pm
      where pm.product_id = new.id and length(trim(pm.alt_text)) > 0
    ) then
      raise exception 'publish_requires_media'
        using errcode = '23514', hint = 'Adicione ao menos uma imagem com texto alternativo.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_catalog_product_publication() from public, anon, authenticated;

create or replace function public.admin_save_catalog_product(
  p_product jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_variant jsonb;
  v_category_id uuid;
  v_status text;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_product_id := nullif(p_product ->> 'id', '')::uuid;
  v_category_id := (p_product ->> 'category_id')::uuid;
  v_status := coalesce(p_product ->> 'status', 'draft');
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if v_product_id is null then
    insert into public.products(category_id, name, slug, description, status, free_shipping)
    values (
      v_category_id,
      p_product ->> 'name',
      p_product ->> 'slug',
      coalesce(p_product ->> 'description', ''),
      'draft',
      coalesce((p_product ->> 'free_shipping')::boolean, false)
    ) returning id into v_product_id;
  else
    update public.products
    set category_id = v_category_id,
        name = p_product ->> 'name',
        slug = p_product ->> 'slug',
        description = coalesce(p_product ->> 'description', ''),
        free_shipping = coalesce((p_product ->> 'free_shipping')::boolean, false)
    where id = v_product_id;
    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;
  end if;

  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'at_least_one_variant_required' using errcode = '22023';
  end if;
  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_variant_id := nullif(v_variant ->> 'id', '')::uuid;
    if v_variant_id is null then
      insert into public.product_variants(
        product_id, sku, fabric, color, width_mm, depth_mm, height_mm,
        price_cents, is_active
      ) values (
        v_product_id, nullif(trim(v_variant ->> 'sku'), ''),
        nullif(trim(v_variant ->> 'fabric'), ''),
        nullif(trim(v_variant ->> 'color'), ''),
        nullif(v_variant ->> 'width_mm', '')::integer,
        nullif(v_variant ->> 'depth_mm', '')::integer,
        nullif(v_variant ->> 'height_mm', '')::integer,
        nullif(v_variant ->> 'price_cents', '')::integer,
        coalesce((v_variant ->> 'is_active')::boolean, true)
      ) returning id into v_variant_id;
      insert into public.inventory(variant_id, on_hand, low_stock_threshold)
      values (
        v_variant_id,
        coalesce(nullif(v_variant ->> 'on_hand', '')::integer, 0),
        coalesce(nullif(v_variant ->> 'low_stock_threshold', '')::integer, 0)
      );
    else
      update public.product_variants
      set sku = nullif(trim(v_variant ->> 'sku'), ''),
          fabric = nullif(trim(v_variant ->> 'fabric'), ''),
          color = nullif(trim(v_variant ->> 'color'), ''),
          width_mm = nullif(v_variant ->> 'width_mm', '')::integer,
          depth_mm = nullif(v_variant ->> 'depth_mm', '')::integer,
          height_mm = nullif(v_variant ->> 'height_mm', '')::integer,
          price_cents = nullif(v_variant ->> 'price_cents', '')::integer,
          is_active = coalesce((v_variant ->> 'is_active')::boolean, false)
      where id = v_variant_id and product_id = v_product_id;
      if not found then
        raise exception 'variant_not_found' using errcode = 'P0002';
      end if;
      update public.inventory
      set on_hand = coalesce(nullif(v_variant ->> 'on_hand', '')::integer, 0),
          low_stock_threshold = coalesce(nullif(v_variant ->> 'low_stock_threshold', '')::integer, 0),
          version = version + 1
      where variant_id = v_variant_id;
    end if;
  end loop;

  if v_status = 'active' then
    update public.product_variants pv set is_active = true
    where pv.product_id = v_product_id and nullif(trim(pv.sku), '') is not null
      and pv.price_cents > 0 and exists (
        select 1 from public.inventory i where i.variant_id = pv.id and i.on_hand > i.reserved
      );
  end if;

  if v_status = 'active' and not exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    join public.product_variants pv on pv.product_id = p.id and pv.is_active
    join public.inventory i on i.variant_id = pv.id and i.on_hand > i.reserved
    where p.id = v_product_id
      and nullif(trim(pv.sku), '') is not null and pv.price_cents > 0
  ) then
    raise exception 'publish_requirements_not_met'
      using errcode = '23514', hint = 'Ative a categoria e informe SKU, preço e estoque disponível.';
  end if;

  if v_status = 'active' and not exists (
    select 1 from public.product_media pm
    where pm.product_id = v_product_id and length(trim(pm.alt_text)) > 0
  ) then
    raise exception 'publish_requires_media'
      using errcode = '23514', hint = 'Adicione ao menos uma imagem com texto alternativo antes de publicar.';
  end if;

  update public.products set status = v_status where id = v_product_id;
  return v_product_id;
end;
$$;
revoke all on function public.admin_save_catalog_product(jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_catalog_product(jsonb, jsonb) to authenticated;

-- Keep measurements optional in the public PLP. Width facets include only known widths.
create or replace function public.get_catalog_listing(
  p_category_slug text default null,
  p_query text default null,
  p_min_price_cents integer default null,
  p_max_price_cents integer default null,
  p_widths_mm integer[] default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with sale as (
    select pv.product_id,
      min(pv.width_mm)::integer as width_mm,
      coalesce(array_agg(distinct pv.width_mm order by pv.width_mm)
        filter (where pv.width_mm is not null and pv.width_mm > 0), '{}'::integer[]) as widths_mm,
      min(pv.price_cents)::integer as price_cents,
      max(pv.price_cents)::integer as max_price_cents,
      count(distinct pv.price_cents)::integer as price_count,
      sum(i.on_hand - i.reserved)::integer as sellable_units
    from public.product_variants pv
    join public.inventory i on i.variant_id = pv.id
    where pv.is_active and nullif(trim(pv.sku), '') is not null
      and pv.price_cents > 0 and i.on_hand > i.reserved
    group by pv.product_id
  ), base as (
    select p.id, p.slug, p.name, p.description, p.created_at,
      c.slug as category_slug, sale.width_mm, sale.widths_mm,
      sale.price_cents, sale.max_price_cents, sale.price_count, sale.sellable_units
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    join sale on sale.product_id = p.id
    where p.status = 'active'
      and (p_category_slug is null or c.slug = p_category_slug)
      and (nullif(trim(p_query), '') is null
        or position(lower(left(trim(p_query), 100)) in lower(p.name)) > 0
        or exists (
          select 1 from public.product_variants search_variant
          join public.inventory search_stock on search_stock.variant_id = search_variant.id
          where search_variant.product_id = p.id and search_variant.is_active
            and nullif(trim(search_variant.sku), '') is not null
            and search_variant.price_cents > 0 and search_stock.on_hand > search_stock.reserved
            and (position(lower(left(trim(p_query), 100)) in lower(coalesce(search_variant.fabric, ''))) > 0
              or position(lower(left(trim(p_query), 100)) in lower(coalesce(search_variant.color, ''))) > 0
              or position(lower(left(trim(p_query), 100)) in lower(search_variant.sku)) > 0)
        ))
  ), filtered as (
    select * from base
    where (p_min_price_cents is null or max_price_cents >= p_min_price_cents)
      and (p_max_price_cents is null or price_cents <= p_max_price_cents)
      and (p_widths_mm is null or cardinality(p_widths_mm) = 0 or widths_mm && p_widths_mm)
  ), ordered as (
    select *, row_number() over (
      order by
        case when p_sort = 'price_asc' then price_cents end asc,
        case when p_sort = 'price_desc' then price_cents end desc,
        case when p_sort = 'name_asc' then name end asc,
        case when p_sort not in ('price_asc', 'price_desc', 'name_asc') then created_at end desc,
        id asc
    ) as ordinal
    from filtered
  ), paged as (
    select * from ordered
    where ordinal > (greatest(1, least(coalesce(p_page, 1), 100000)) - 1)
      * greatest(1, least(coalesce(p_page_size, 12), 24))
      and ordinal <= greatest(1, least(coalesce(p_page, 1), 100000))
      * greatest(1, least(coalesce(p_page_size, 12), 24))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'widths', coalesce((
      select jsonb_agg(jsonb_build_object('width_mm', width_mm, 'count', product_count) order by width_mm)
      from (
        select w.width_mm, count(*) as product_count
        from base b cross join lateral unnest(b.widths_mm) w(width_mm)
        group by w.width_mm
      ) facets
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'slug', pg.slug, 'name', pg.name,
        'description', pg.description, 'category_slug', pg.category_slug,
        'width_mm', pg.width_mm, 'widths_mm', pg.widths_mm,
        'price_cents', pg.price_cents, 'max_price_cents', pg.max_price_cents,
        'price_count', pg.price_count, 'sellable_units', pg.sellable_units,
        'media', coalesce(media.items, '[]'::jsonb)
      ) order by pg.ordinal)
      from paged pg
      left join lateral (
        select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'alt', m.alt_text) order by m.position, m.id) as items
        from public.product_media m
        where m.product_id = pg.id and (m.variant_id is null or exists (
          select 1 from public.product_variants mv
          join public.inventory mi on mi.variant_id = mv.id
          where mv.id = m.variant_id and mv.product_id = pg.id and mv.is_active
            and nullif(trim(mv.sku), '') is not null and mv.price_cents > 0
            and mi.on_hand > mi.reserved
        ))
      ) media on true
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.get_catalog_listing(text, text, integer, integer, integer[], text, integer, integer) from public;
grant execute on function public.get_catalog_listing(text, text, integer, integer, integer[], text, integer, integer) to anon, authenticated;

create or replace function public.get_catalog_products(p_category_slug text default null, p_product_slug text default null)
returns table (
  id uuid,
  slug text,
  name text,
  category_slug text,
  description text,
  width_mm integer,
  price_cents integer,
  sellable_units integer,
  media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.name, c.slug as category_slug, p.description,
    sale.width_mm, sale.price_cents, sale.sellable_units,
    coalesce(media.items, '[]'::jsonb) as media
  from public.products p
  join public.categories c on c.id = p.category_id and c.is_active
  join lateral (
    select min(pv.width_mm)::integer as width_mm,
      min(pv.price_cents)::integer as price_cents,
      sum(i.on_hand - i.reserved)::integer as sellable_units
    from public.product_variants pv
    join public.inventory i on i.variant_id = pv.id
    where pv.product_id = p.id and pv.is_active
      and nullif(trim(pv.sku), '') is not null and pv.price_cents > 0
      and i.on_hand > i.reserved
  ) sale on sale.sellable_units > 0
  left join lateral (
    select jsonb_agg(jsonb_build_object('storage_path', pm.storage_path, 'alt', pm.alt_text)
      order by pm.position, pm.id) as items
    from public.product_media pm
    where pm.product_id = p.id and (pm.variant_id is null or exists (
      select 1 from public.product_variants pv_media
      join public.inventory i_media on i_media.variant_id = pv_media.id
      where pv_media.id = pm.variant_id and pv_media.product_id = p.id and pv_media.is_active
        and nullif(trim(pv_media.sku), '') is not null and pv_media.price_cents > 0
        and i_media.on_hand > i_media.reserved
    ))
  ) media on true
  where p.status = 'active'
    and (p_category_slug is null or c.slug = p_category_slug)
    and (p_product_slug is null or p.slug = p_product_slug)
  order by p.name;
$$;
revoke execute on function public.get_catalog_products(text, text) from public;
grant execute on function public.get_catalog_products(text, text) to anon, authenticated;

create or replace function public.get_catalog_product_detail(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
    'category_slug', c.slug,
    'variants', (
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'width_mm', v.width_mm, 'depth_mm', v.depth_mm,
        'height_mm', v.height_mm, 'fabric', v.fabric, 'color', v.color,
        'price_cents', v.price_cents, 'available', i.on_hand - i.reserved
      ) order by v.width_mm nulls last, v.id)
      from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0 and i.on_hand > i.reserved
    ),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'alt', m.alt_text,
        'variant_id', m.variant_id) order by m.position, m.id)
      from public.product_media m where m.product_id = p.id and (m.variant_id is null or exists (
        select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
        where v.id = m.variant_id and v.product_id = p.id and v.is_active
          and nullif(trim(v.sku), '') is not null and v.price_cents > 0 and i.on_hand > i.reserved
      ))
    ), '[]'::jsonb)
  )
  from public.products p join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = p_slug and p.status = 'active'
    and exists (select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0 and i.on_hand > i.reserved);
$$;
revoke execute on function public.get_catalog_product_detail(text) from public;
grant execute on function public.get_catalog_product_detail(text) to anon, authenticated;

-- Administrative status operation: authorized session only; same DB readiness triggers.
create or replace function public.admin_set_catalog_product_status(p_product_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('active', 'draft', 'archived') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status = 'active' then
    update public.product_variants v set is_active = true
    where v.product_id = p_product_id and nullif(trim(v.sku), '') is not null and v.price_cents > 0
      and exists (select 1 from public.inventory i where i.variant_id = v.id and i.on_hand > i.reserved);
  end if;
  update public.products set status = p_status where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.admin_set_catalog_product_status(uuid, text) from public, anon;
grant execute on function public.admin_set_catalog_product_status(uuid, text) to authenticated;

-- Safe delete: retain products referenced by cart history, customer reviews or import lineage.
create or replace function public.admin_delete_catalog_product(p_product_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paths text[];
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.product_variants v join public.cart_items ci on ci.variant_id = v.id
    where v.product_id = p_product_id
  ) or exists (select 1 from public.product_reviews r where r.product_id = p_product_id)
  then
    update public.products set status = 'archived' where id = p_product_id;
    return jsonb_build_object('outcome', 'archived', 'paths', '[]'::jsonb);
  end if;

  select coalesce(array_agg(pm.storage_path), '{}'::text[]) into v_paths
  from public.product_media pm where pm.product_id = p_product_id
    and not exists (select 1 from public.product_media other
      where other.storage_path = pm.storage_path and other.product_id <> p_product_id);

  begin
    delete from public.product_media where product_id = p_product_id;
    delete from public.inventory where variant_id in (
      select id from public.product_variants where product_id = p_product_id
    );
    delete from public.product_variants where product_id = p_product_id;
    delete from public.products where id = p_product_id;
  exception when foreign_key_violation then
    update public.products set status = 'archived' where id = p_product_id;
    return jsonb_build_object('outcome', 'archived', 'paths', '[]'::jsonb);
  end;
  return jsonb_build_object('outcome', 'deleted', 'paths', to_jsonb(v_paths));
end;
$$;
revoke all on function public.admin_delete_catalog_product(uuid) from public, anon;
grant execute on function public.admin_delete_catalog_product(uuid) to authenticated;

create or replace function public.admin_quick_edit_catalog_product(
  p_product_id uuid,
  p_name text,
  p_category_id uuid,
  p_variants jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_variant jsonb;
  v_variant_id uuid;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(p_name)) not between 1 and 180
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) not between 1 and 30
  then raise exception 'invalid_quick_edit' using errcode = '22023'; end if;

  update public.products set name = trim(p_name), category_id = p_category_id
  where id = p_product_id;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_variant_id := (v_variant ->> 'id')::uuid;
    update public.product_variants
      set sku = nullif(trim(v_variant ->> 'sku'), ''),
          price_cents = nullif(v_variant ->> 'price_cents', '')::integer
      where id = v_variant_id and product_id = p_product_id;
    if not found then raise exception 'variant_not_found' using errcode = 'P0002'; end if;
    update public.inventory
      set on_hand = (v_variant ->> 'on_hand')::integer,
          low_stock_threshold = (v_variant ->> 'low_stock_threshold')::integer,
          version = version + 1
      where variant_id = v_variant_id;
    if not found then raise exception 'inventory_not_found' using errcode = 'P0002'; end if;
  end loop;
end;
$$;
revoke all on function public.admin_quick_edit_catalog_product(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.admin_quick_edit_catalog_product(uuid, text, uuid, jsonb) to authenticated;

create or replace function public.admin_adjust_catalog_inventory(
  p_product_ids uuid[],
  p_delta integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_changed integer;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cardinality(p_product_ids) not between 1 and 100
    or p_delta = 0 or abs(p_delta) > 1000
  then raise exception 'invalid_inventory_adjustment' using errcode = '22023'; end if;
  if exists (
    select 1 from public.inventory i
    join public.product_variants v on v.id = i.variant_id
    where v.product_id = any(p_product_ids) and i.on_hand + p_delta < i.reserved
  ) then raise exception 'inventory_below_reserved' using errcode = '23514'; end if;

  update public.inventory i
  set on_hand = i.on_hand + p_delta, version = i.version + 1
  from public.product_variants v
  where v.id = i.variant_id and v.product_id = any(p_product_ids);
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;
revoke all on function public.admin_adjust_catalog_inventory(uuid[], integer) from public, anon;
grant execute on function public.admin_adjust_catalog_inventory(uuid[], integer) to authenticated;
