-- Read-only admin sales report. Counts only orders with status 'paid' whose
-- paid_at falls inside the range (America/Sao_Paulo calendar days, inclusive).
-- Refunded, cancelled, expired and in-review orders are never counted as revenue.
-- Additive: one function, no table or data change.

create function public.admin_get_sales_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid report range' using errcode = '22023';
  end if;

  v_start := (p_from::timestamp at time zone 'America/Sao_Paulo');
  v_end := ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');

  with paid as (
    select o.id, o.total_cents, o.items_subtotal_cents, o.freight_cents,
      o.floor_charge_cents,
      (o.paid_at at time zone 'America/Sao_Paulo')::date as paid_day
    from public.orders o
    where o.status = 'paid' and o.paid_at >= v_start and o.paid_at < v_end
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totals', jsonb_build_object(
      'orders', (select count(*) from paid),
      'revenue_cents', (select coalesce(sum(total_cents), 0) from paid),
      'items_cents', (select coalesce(sum(items_subtotal_cents), 0) from paid),
      'freight_cents', (select coalesce(sum(freight_cents), 0) from paid),
      'floor_charge_cents', (select coalesce(sum(floor_charge_cents), 0) from paid),
      'average_ticket_cents', (select coalesce(round(avg(total_cents))::bigint, 0) from paid),
      'units', (
        select coalesce(sum(oi.quantity), 0)
        from public.order_items oi join paid p on p.id = oi.order_id
      )
    ),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.paid_day, 'orders', d.orders, 'revenue_cents', d.revenue_cents
      ) order by d.paid_day)
      from (
        select paid_day, count(*) as orders, sum(total_cents) as revenue_cents
        from paid group by paid_day
      ) d
    ), '[]'::jsonb),
    'by_supplier', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplier_code', s.supplier_code,
        'supplier_name', s.supplier_name,
        'orders', s.orders,
        'units', s.units,
        'items_cents', s.items_cents,
        'freight_cents', s.freight_cents
      ) order by s.items_cents desc, s.supplier_code)
      from (
        select g.supplier_code, g.supplier_name,
          count(distinct g.order_id) as orders,
          coalesce(sum((select sum(oi.quantity) from public.order_items oi where oi.order_group_id = g.id)), 0) as units,
          coalesce(sum((select sum(oi.line_total_cents) from public.order_items oi where oi.order_group_id = g.id)), 0) as items_cents,
          coalesce(sum(g.base_freight_cents), 0) as freight_cents
        from public.order_groups g join paid p on p.id = g.order_id
        group by g.supplier_code, g.supplier_name
      ) s
    ), '[]'::jsonb),
    'by_product', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', x.product_id,
        'product_name', x.product_name,
        'units', x.units,
        'revenue_cents', x.revenue_cents
      ) order by x.revenue_cents desc, x.product_name)
      from (
        select oi.product_id, max(oi.product_name) as product_name,
          sum(oi.quantity) as units, sum(oi.line_total_cents) as revenue_cents
        from public.order_items oi join paid p on p.id = oi.order_id
        group by oi.product_id
        order by sum(oi.line_total_cents) desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'by_mode', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', m.fulfillment_mode, 'groups', m.groups, 'items_cents', m.items_cents
      ) order by m.fulfillment_mode)
      from (
        select g.fulfillment_mode, count(*) as groups,
          coalesce(sum((select sum(oi.line_total_cents) from public.order_items oi where oi.order_group_id = g.id)), 0) as items_cents
        from public.order_groups g join paid p on p.id = g.order_id
        group by g.fulfillment_mode
      ) m
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_get_sales_report(date, date) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_sales_report(date, date) to authenticated;
