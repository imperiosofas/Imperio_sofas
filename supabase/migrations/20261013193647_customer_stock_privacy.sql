-- Keep exact inventory counts inside the database/admin boundary. Customer
-- projections expose only qualitative status; cart writes retain their
-- existing server-side exact-stock validation in set_cart_item.

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
language sql stable security definer set search_path = '' as $$
  with sale as (
    select pv.product_id,
      min(pv.width_mm)::integer as width_mm,
      coalesce(array_agg(distinct pv.width_mm order by pv.width_mm)
        filter (where pv.width_mm is not null and pv.width_mm > 0), '{}'::integer[]) as widths_mm,
      min(pv.price_cents)::integer as price_cents,
      max(pv.price_cents)::integer as max_price_cents,
      count(distinct pv.price_cents)::integer as price_count,
      bool_and(i.low_stock_threshold > 0
        and i.on_hand - i.reserved <= i.low_stock_threshold) as all_sellable_low_stock
    from public.product_variants pv
    join public.inventory i on i.variant_id = pv.id
    where pv.is_active and nullif(trim(pv.sku), '') is not null
      and pv.price_cents > 0 and i.on_hand > i.reserved
    group by pv.product_id
  ), base as (
    select p.id, p.slug, p.name, p.description, p.created_at,
      c.slug as category_slug, sale.width_mm, sale.widths_mm,
      sale.price_cents, sale.max_price_cents, sale.price_count,
      sale.all_sellable_low_stock
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
        'price_count', pg.price_count,
        'stock_status', case when pg.all_sellable_low_stock then 'low_stock' else 'available' end,
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

-- Recreate the favorite wrapper together with the changed table-returning RPC.
drop function public.get_my_favorite_products();
drop function public.get_catalog_products(text, text);
create function public.get_catalog_products(p_category_slug text default null, p_product_slug text default null)
returns table (
  id uuid,
  slug text,
  name text,
  category_slug text,
  description text,
  width_mm integer,
  price_cents integer,
  stock_status text,
  media jsonb
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.slug, p.name, c.slug as category_slug, p.description,
    sale.width_mm, sale.price_cents,
    case
      when not sale.has_stock then 'unavailable'
      when sale.all_sellable_low_stock then 'low_stock'
      else 'available'
    end::text as stock_status,
    coalesce(media.items, '[]'::jsonb) as media
  from public.products p
  join public.categories c on c.id = p.category_id and c.is_active
  join lateral (
    select coalesce(
        min(pv.width_mm) filter (where i.on_hand > i.reserved),
        min(pv.width_mm)
      )::integer as width_mm,
      coalesce(
        min(pv.price_cents) filter (where i.on_hand > i.reserved),
        min(pv.price_cents)
      )::integer as price_cents,
      coalesce(bool_or(i.on_hand > i.reserved), false) as has_stock,
      coalesce(bool_and(i.low_stock_threshold > 0
        and i.on_hand - i.reserved <= i.low_stock_threshold)
        filter (where i.on_hand > i.reserved), false) as all_sellable_low_stock
    from public.product_variants pv
    left join public.inventory i on i.variant_id = pv.id
    where pv.product_id = p.id and pv.is_active
      and nullif(trim(pv.sku), '') is not null and pv.price_cents > 0
  ) sale on sale.price_cents is not null
  left join lateral (
    select jsonb_agg(jsonb_build_object('storage_path', pm.storage_path, 'alt', pm.alt_text)
      order by pm.position, pm.id) as items
    from public.product_media pm
    where pm.product_id = p.id and (pm.variant_id is null or exists (
      select 1 from public.product_variants pv_media
      join public.inventory i_media on i_media.variant_id = pv_media.id
      where pv_media.id = pm.variant_id and pv_media.product_id = p.id and pv_media.is_active
        and nullif(trim(pv_media.sku), '') is not null and pv_media.price_cents > 0
    ))
  ) media on true
  where p.status = 'active'
    and (p_category_slug is null or c.slug = p_category_slug)
    and (p_product_slug is null or p.slug = p_product_slug)
  order by p.name;
$$;
revoke execute on function public.get_catalog_products(text, text) from public;
grant execute on function public.get_catalog_products(text, text) to anon, authenticated;

create function public.get_my_favorite_products()
returns jsonb language sql stable security definer set search_path = '' as $$
  with mine as (
    select product_id, created_at from public.product_favorites
    where user_id = auth.uid() order by created_at desc limit 100
  )
  select coalesce(jsonb_agg(to_jsonb(product) order by mine.created_at desc), '[]'::jsonb)
  from mine join public.get_catalog_products(null, null) product on product.id = mine.product_id;
$$;
revoke execute on function public.get_my_favorite_products() from public, anon;
grant execute on function public.get_my_favorite_products() to authenticated;

create or replace function public.get_catalog_product_detail(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
    'category_slug', c.slug,
    'variants', (
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'width_mm', v.width_mm, 'depth_mm', v.depth_mm,
        'height_mm', v.height_mm, 'fabric', v.fabric, 'color', v.color,
        'price_cents', v.price_cents,
        'stock_status', case
          when i.on_hand <= i.reserved then 'unavailable'
          when i.low_stock_threshold > 0 and i.on_hand - i.reserved <= i.low_stock_threshold then 'low_stock'
          else 'available'
        end
      ) order by v.width_mm nulls last, v.id)
      from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0
    ),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'alt', m.alt_text,
        'variant_id', m.variant_id) order by m.position, m.id)
      from public.product_media m where m.product_id = p.id and (m.variant_id is null or exists (
        select 1 from public.product_variants v
        where v.id = m.variant_id and v.product_id = p.id and v.is_active
          and nullif(trim(v.sku), '') is not null and v.price_cents > 0
      ))
    ), '[]'::jsonb)
  )
  from public.products p join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = p_slug and p.status = 'active'
    and exists (select 1 from public.product_variants v
      where v.product_id = p.id and v.is_active and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0);
$$;
revoke execute on function public.get_catalog_product_detail(text) from public;
grant execute on function public.get_catalog_product_detail(text) to anon, authenticated;

create or replace function public.get_my_cart()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', ci.variant_id, 'quantity', ci.quantity,
    'product_id', p.id, 'product_slug', p.slug, 'name', p.name,
    'width_mm', v.width_mm, 'price_cents', v.price_cents,
    'stock_status', case
      when p.status <> 'active' or not c.is_active or not v.is_active
        or v.sku is null or v.price_cents <= 0 or i.on_hand - i.reserved < ci.quantity
        or i.on_hand <= i.reserved then 'unavailable'
      when i.low_stock_threshold > 0 and i.on_hand - i.reserved <= i.low_stock_threshold then 'low_stock'
      else 'available'
    end,
    'storage_path', (select m.storage_path from public.product_media m
      where m.product_id = p.id and (m.variant_id is null or m.variant_id = v.id)
      order by m.position, m.id limit 1)
  ) order by ci.created_at), '[]'::jsonb)
  from public.carts ca join public.cart_items ci on ci.cart_id = ca.id
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  join public.categories c on c.id = p.category_id
  join public.inventory i on i.variant_id = v.id
  where ca.user_id = auth.uid();
$$;
revoke execute on function public.get_my_cart() from public, anon;
grant execute on function public.get_my_cart() to authenticated;
