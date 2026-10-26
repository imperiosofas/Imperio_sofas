-- Admin-only current-state catalog and inventory snapshot. Exact inventory
-- values are returned only after checking the existing catalog membership
-- helper; this function does not change table grants or RLS policies.
create or replace function public.admin_get_analytics_snapshot (p_category_id uuid default null) returns jsonb language plpgsql stable security invoker
set
  search_path = '' as $function$
declare
  v_snapshot jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with category_scope as (
    select c.id, c.name, c.position
    from public.categories as c
    where p_category_id is null or c.id = p_category_id
  ),
  product_scope as (
    select p.id, p.category_id, p.name, p.slug, p.status
    from public.products as p
    join category_scope as c on c.id = p.category_id
  ),
  variant_inventory as (
    select
      p.id as product_id,
      p.name as product_name,
      p.slug,
      p.category_id,
      c.name as category_name,
      pv.id as variant_id,
      pv.sku,
      pv.is_active,
      coalesce(i.on_hand - i.reserved, 0) as available_units,
      coalesce(i.low_stock_threshold, 0) as low_stock_threshold
    from product_scope as p
    join public.categories as c on c.id = p.category_id
    join public.product_variants as pv on pv.product_id = p.id
    left join public.inventory as i on i.variant_id = pv.id
  )
  select jsonb_build_object(
    'snapshot_at', statement_timestamp(),
    'summary', jsonb_build_object(
      'products_total', (select count(*) from product_scope),
      'active_products', (
        select count(*) from product_scope where status = 'active'
      ),
      'draft_products', (
        select count(*) from product_scope where status = 'draft'
      ),
      'archived_products', (
        select count(*) from product_scope where status = 'archived'
      ),
      'categories_total', (select count(*) from category_scope),
      'active_variants', (
        select count(*) from variant_inventory where is_active
      ),
      'low_stock_variants', (
        select count(*)
        from variant_inventory
        where is_active
          and available_units > 0
          and low_stock_threshold > 0
          and available_units <= low_stock_threshold
      ),
      'out_of_stock_variants', (
        select count(*)
        from variant_inventory
        where is_active and available_units <= 0
      ),
      'available_units_total', coalesce((
        select sum(available_units)
        from variant_inventory
        where is_active
      ), 0)
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', grouped.category_id,
          'category_name', grouped.category_name,
          'product_count', grouped.product_count,
          'variants_total', grouped.variants_total,
          'variants_in_stock', grouped.variants_in_stock,
          'low_stock_variants', grouped.low_stock_variants,
          'out_of_stock_variants', grouped.out_of_stock_variants,
          'available_units', grouped.available_units
        )
        order by grouped.position, grouped.category_name, grouped.category_id
      )
      from (
        select
          c.id as category_id,
          c.name as category_name,
          c.position,
          count(distinct p.id) as product_count,
          count(v.variant_id) as variants_total,
          count(v.variant_id) filter (
            where v.is_active and v.available_units > 0
          ) as variants_in_stock,
          count(v.variant_id) filter (
            where v.is_active
              and v.available_units > 0
              and v.low_stock_threshold > 0
              and v.available_units <= v.low_stock_threshold
          ) as low_stock_variants,
          count(v.variant_id) filter (
            where v.is_active and v.available_units <= 0
          ) as out_of_stock_variants,
          coalesce(sum(v.available_units) filter (where v.is_active), 0)
            as available_units
        from category_scope as c
        left join product_scope as p on p.category_id = c.id
        left join variant_inventory as v on v.product_id = p.id
        group by c.id, c.name, c.position
      ) as grouped
    ), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id,
          'product_name', item.product_name,
          'slug', item.slug,
          'category_name', item.category_name,
          'variant_id', item.variant_id,
          'sku', item.sku,
          'available_units', item.available_units,
          'low_stock_threshold', item.low_stock_threshold,
          'is_low_stock', item.is_low_stock
        )
        order by
          item.attention_priority,
          item.available_units,
          item.product_name,
          item.sku nulls last,
          item.variant_id
      )
      from (
        select
          v.*,
          (v.available_units > 0
            and v.low_stock_threshold > 0
            and v.available_units <= v.low_stock_threshold) as is_low_stock,
          case when v.available_units <= 0 then 0 else 1 end
            as attention_priority
        from variant_inventory as v
        where v.is_active
          and (
            v.available_units <= 0
            or (
              v.low_stock_threshold > 0
              and v.available_units <= v.low_stock_threshold
            )
          )
        order by
          case when v.available_units <= 0 then 0 else 1 end,
          v.available_units,
          v.product_name,
          v.sku nulls last,
          v.variant_id
        limit 100
      ) as item
    ), '[]'::jsonb),
    'top_inventory_products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id,
          'product_name', item.product_name,
          'slug', item.slug,
          'category_name', item.category_name,
          'available_units', item.available_units,
          'active_variant_count', item.active_variant_count
        )
        order by
          item.available_units desc,
          item.active_variant_count desc,
          item.product_name,
          item.product_id
      )
      from (
        select
          p.id as product_id,
          p.name as product_name,
          p.slug,
          c.name as category_name,
          coalesce(sum(v.available_units) filter (where v.is_active), 0)
            as available_units,
          count(v.variant_id) filter (where v.is_active)
            as active_variant_count
        from product_scope as p
        join public.categories as c on c.id = p.category_id
        left join variant_inventory as v on v.product_id = p.id
        group by p.id, p.name, p.slug, c.name
        having count(v.variant_id) filter (where v.is_active) > 0
        order by
          coalesce(sum(v.available_units) filter (where v.is_active), 0) desc,
          count(v.variant_id) filter (where v.is_active) desc,
          p.name,
          p.id
        limit 20
      ) as item
    ), '[]'::jsonb)
  ) into v_snapshot;

  return v_snapshot;
end;
$function$;

revoke
execute on function public.admin_get_analytics_snapshot (uuid)
from
  public,
  anon;

grant
execute on function public.admin_get_analytics_snapshot (uuid) to authenticated;

comment on function public.admin_get_analytics_snapshot (uuid) is 'Returns a current-state catalog and exact inventory snapshot to provisioned catalog admins only.';

