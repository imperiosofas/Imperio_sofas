-- One bounded public listing projection. Keep the underlying tables closed to anon.
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
      array_agg(distinct pv.width_mm order by pv.width_mm) as widths_mm,
      min(pv.price_cents)::integer as price_cents,
      count(distinct pv.price_cents)::integer as price_count,
      sum(i.on_hand - i.reserved)::integer as sellable_units
    from public.product_variants pv
    join public.inventory i on i.variant_id = pv.id
    where pv.is_active and pv.sku is not null and pv.price_cents > 0
      and pv.width_mm > 0 and i.on_hand > i.reserved
    group by pv.product_id
  ), base as (
    select p.id, p.slug, p.name, p.description, p.created_at,
      c.slug as category_slug, sale.width_mm, sale.widths_mm,
      sale.price_cents, sale.price_count, sale.sellable_units
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    join sale on sale.product_id = p.id
    where p.status = 'active'
      and (p_category_slug is null or c.slug = p_category_slug)
      and (nullif(trim(p_query), '') is null
        or position(lower(left(trim(p_query), 100)) in lower(p.name)) > 0)
  ), filtered as (
    select * from base
    where (p_min_price_cents is null or price_cents >= p_min_price_cents)
      and (p_max_price_cents is null or price_cents <= p_max_price_cents)
      and (p_widths_mm is null or cardinality(p_widths_mm) = 0
        or widths_mm && p_widths_mm)
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
      select jsonb_agg(jsonb_build_object('width_mm', width_mm, 'count', product_count)
        order by width_mm)
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
        'price_cents', pg.price_cents, 'price_count', pg.price_count,
        'sellable_units', pg.sellable_units,
        'media', coalesce(media.items, '[]'::jsonb)
      ) order by pg.ordinal)
      from paged pg
      left join lateral (
        select jsonb_agg(jsonb_build_object('storage_path', m.storage_path,
          'alt', m.alt_text) order by m.position, m.id) as items
        from public.product_media m
        where m.product_id = pg.id
          and (m.variant_id is null or exists (
            select 1 from public.product_variants mv
            join public.inventory mi on mi.variant_id = mv.id
            where mv.id = m.variant_id and mv.product_id = pg.id
              and mv.is_active and mv.sku is not null and mv.price_cents > 0
              and mi.on_hand > mi.reserved
          ))
      ) media on true
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_catalog_listing(text, text, integer, integer, integer[], text, integer, integer) from public;
grant execute on function public.get_catalog_listing(text, text, integer, integer, integer[], text, integer, integer) to anon, authenticated;
comment on function public.get_catalog_listing(text, text, integer, integer, integer[], text, integer, integer) is
  'Bounded public PLP projection of active products with sellable variants and positive inventory.';
