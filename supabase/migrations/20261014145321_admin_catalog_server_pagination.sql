create or replace function public.admin_list_catalog_products(
  p_query text default null,
  p_category_id uuid default null,
  p_status text default 'all',
  p_stock text default 'all',
  p_pending text default 'all',
  p_sort text default 'recent',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_status text := case when p_status in ('draft', 'active', 'archived') then p_status else 'all' end;
  v_stock text := case when p_stock in ('available', 'low', 'out') then p_stock else 'all' end;
  v_pending text := case when p_pending in ('pending', 'ready') then p_pending else 'all' end;
  v_sort text := case
    when p_sort in ('oldest', 'name-asc', 'name-desc', 'price-asc', 'price-desc', 'stock-asc', 'stock-desc') then p_sort
    else 'recent'
  end;
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 100000);
  v_page_size integer := case when p_page_size in (25, 50, 100) then p_page_size else 25 end;
  v_result jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with base as materialized (
    select
      p.id,
      p.category_id,
      p.name,
      p.slug,
      p.description,
      p.status,
      p.free_shipping,
      p.updated_at,
      c.name as category_name,
      c.slug as category_slug,
      c.is_active as category_is_active,
      coalesce(vm.available_stock, 0)::integer as available_stock,
      coalesce(vm.low_stock, false) as low_stock,
      coalesce(vm.sellable, false) as sellable,
      vm.minimum_price,
      coalesce(mm.has_alt_text, false) as has_alt_text,
      coalesce(vm.search_skus, '') as search_skus
    from public.products p
    join public.categories c on c.id = p.category_id
    left join lateral (
      select
        sum(greatest(coalesce(i.on_hand, 0) - coalesce(i.reserved, 0), 0)) as available_stock,
        bool_or(
          greatest(coalesce(i.on_hand, 0) - coalesce(i.reserved, 0), 0) > 0
          and greatest(coalesce(i.on_hand, 0) - coalesce(i.reserved, 0), 0) <= coalesce(i.low_stock_threshold, 0)
        ) as low_stock,
        bool_or(
          length(trim(coalesce(v.sku, ''))) > 0
          and coalesce(v.price_cents, 0) > 0
          and greatest(coalesce(i.on_hand, 0) - coalesce(i.reserved, 0), 0) > 0
        ) as sellable,
        min(v.price_cents) as minimum_price,
        string_agg(coalesce(v.sku, ''), ' ') as search_skus
      from public.product_variants v
      left join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id
    ) vm on true
    left join lateral (
      select bool_or(length(trim(pm.alt_text)) > 0) as has_alt_text
      from public.product_media pm
      where pm.product_id = p.id
    ) mm on true
  ),
  summary as (
    select
      count(*)::integer as total,
      count(*) filter (where status = 'active')::integer as published,
      count(*) filter (where status = 'draft')::integer as drafts,
      count(*) filter (where low_stock)::integer as low_stock,
      count(*) filter (where available_stock = 0)::integer as out_of_stock,
      count(*) filter (where not category_is_active or not sellable or not has_alt_text)::integer as pending
    from base
  ),
  filtered as materialized (
    select b.*
    from base b
    where (p_category_id is null or b.category_id = p_category_id)
      and (v_status = 'all' or b.status = v_status)
      and (
        v_stock = 'all'
        or (v_stock = 'available' and b.available_stock > 0)
        or (v_stock = 'low' and b.low_stock)
        or (v_stock = 'out' and b.available_stock = 0)
      )
      and (
        v_pending = 'all'
        or (v_pending = 'pending' and (not b.category_is_active or not b.sellable or not b.has_alt_text))
        or (v_pending = 'ready' and b.category_is_active and b.sellable and b.has_alt_text)
      )
      and (
        v_query = ''
        or strpos(lower(b.name), v_query) > 0
        or strpos(lower(b.slug), v_query) > 0
        or strpos(lower(b.search_skus), v_query) > 0
      )
  ),
  page_rows as (
    select
      f.*,
      row_number() over (
        order by
          case when v_sort = 'recent' then f.updated_at end desc,
          case when v_sort = 'oldest' then f.updated_at end asc,
          case when v_sort = 'name-asc' then lower(f.name) end asc,
          case when v_sort = 'name-desc' then lower(f.name) end desc,
          case when v_sort = 'price-asc' then f.minimum_price end asc nulls last,
          case when v_sort = 'price-desc' then f.minimum_price end desc nulls last,
          case when v_sort = 'stock-asc' then f.available_stock end asc,
          case when v_sort = 'stock-desc' then f.available_stock end desc,
          f.id asc
      ) as row_number
    from filtered f
    order by
      case when v_sort = 'recent' then f.updated_at end desc,
      case when v_sort = 'oldest' then f.updated_at end asc,
      case when v_sort = 'name-asc' then lower(f.name) end asc,
      case when v_sort = 'name-desc' then lower(f.name) end desc,
      case when v_sort = 'price-asc' then f.minimum_price end asc nulls last,
      case when v_sort = 'price-desc' then f.minimum_price end desc nulls last,
      case when v_sort = 'stock-asc' then f.available_stock end asc,
      case when v_sort = 'stock-desc' then f.available_stock end desc,
      f.id asc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'category_id', r.category_id,
          'name', r.name,
          'slug', r.slug,
          'description', r.description,
          'status', r.status,
          'free_shipping', r.free_shipping,
          'updated_at', r.updated_at,
          'categories', jsonb_build_object('name', r.category_name, 'slug', r.category_slug),
          'product_variants', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', v.id,
                'sku', v.sku,
                'price_cents', v.price_cents,
                'width_mm', v.width_mm,
                'depth_mm', v.depth_mm,
                'height_mm', v.height_mm,
                'fabric', v.fabric,
                'color', v.color,
                'is_active', v.is_active,
                'inventory', case when i.variant_id is null then null else jsonb_build_object(
                  'on_hand', i.on_hand,
                  'reserved', i.reserved,
                  'low_stock_threshold', i.low_stock_threshold
                ) end
              ) order by v.created_at, v.id
            )
            from public.product_variants v
            left join public.inventory i on i.variant_id = v.id
            where v.product_id = r.id
          ), '[]'::jsonb),
          'product_media', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pm.id,
                'storage_path', pm.storage_path,
                'alt_text', pm.alt_text,
                'position', pm.position
              ) order by pm.position, pm.id
            )
            from public.product_media pm
            where pm.product_id = r.id
          ), '[]'::jsonb)
        ) order by r.row_number
      )
      from page_rows r
    ), '[]'::jsonb),
    'total', (select count(*)::integer from filtered),
    'page', v_page,
    'page_size', v_page_size,
    'summary', (select jsonb_build_object(
      'total', s.total,
      'published', s.published,
      'drafts', s.drafts,
      'low_stock', s.low_stock,
      'out_of_stock', s.out_of_stock,
      'pending', s.pending
    ) from summary s)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_list_catalog_products(text, uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_catalog_products(text, uuid, text, text, text, text, integer, integer) to authenticated;
