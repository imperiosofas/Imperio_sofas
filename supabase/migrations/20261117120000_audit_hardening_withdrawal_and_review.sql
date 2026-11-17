-- Audit hardening (2026-11-17). Additive only: new columns, functions,
-- indexes and narrower grants. No data is deleted or rewritten.

-- 1. Right of withdrawal (CDC art. 49 / Decreto 7.962 art. 5): the customer
--    asks on the site and gets an immediate, timestamped protocol.
alter table public.orders
  add column if not exists withdrawal_requested_at timestamptz,
  add column if not exists withdrawal_reason text
    check (withdrawal_reason is null or char_length(withdrawal_reason) <= 500);

create or replace function public.request_order_withdrawal(
  p_order_id uuid,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'reason too long' using errcode = '22023';
  end if;
  select * into v_order from public.orders
  where id = p_order_id and customer_id = v_user
  for update;
  if not found then
    raise exception 'order not found' using errcode = '42501';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'order not eligible' using errcode = '55000';
  end if;
  if v_order.withdrawal_requested_at is null then
    update public.orders
    set withdrawal_requested_at = now(), withdrawal_reason = v_reason, updated_at = now()
    where id = p_order_id
    returning * into v_order;
    perform private.log_order_event(
      p_order_id, 'customer', v_user, 'withdrawal_requested',
      jsonb_build_object('reason', v_reason)
    );
  end if;
  return jsonb_build_object(
    'order_number', v_order.order_number,
    'requested_at', v_order.withdrawal_requested_at
  );
end;
$$;
revoke all on function public.request_order_withdrawal(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_order_withdrawal(uuid, text) to authenticated;

-- 2. Admin registers a cancellation/refund of a PAID order after refunding at
--    the payment provider. Optionally returns the items to stock. Once only.
create or replace function public.admin_register_order_refund(
  p_order_id uuid,
  p_reason text,
  p_restock boolean default false
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 500 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status not in ('paid', 'refunded') then
    return false;
  end if;
  if exists (
    select 1 from public.order_events
    where order_id = p_order_id and event_type = 'order_refund_registered'
  ) then
    return false;
  end if;

  if p_restock then
    perform 1 from public.inventory i
    join public.order_items oi on oi.variant_id = i.variant_id
    where oi.order_id = p_order_id
    order by i.variant_id
    for update of i;
    update public.inventory i
    set on_hand = i.on_hand + agg.qty, version = i.version + 1, updated_at = now()
    from (
      select variant_id, sum(quantity)::integer as qty
      from public.order_items where order_id = p_order_id group by variant_id
    ) agg
    where i.variant_id = agg.variant_id;
  end if;

  update public.orders
  set status = 'refunded', cancelled_at = coalesce(cancelled_at, now()),
      cancel_reason = v_reason, updated_at = now()
  where id = p_order_id;
  update public.order_groups
  set status = 'cancelled', status_updated_at = now()
  where order_id = p_order_id and status <> 'completed';

  perform private.log_order_event(
    p_order_id, 'admin', (select auth.uid()), 'order_refund_registered',
    jsonb_build_object('reason', v_reason, 'restocked', p_restock)
  );
  return true;
end;
$$;
revoke all on function public.admin_register_order_refund(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_register_order_refund(uuid, text, boolean) to authenticated;

-- 3. Orders stuck in needs_review (amount mismatch) kept their stock reserved
--    forever. Admin can close them. If money came in (a provider-approved
--    payment is stored as 'in_process' on amount mismatch), the admin must
--    first refund it at the provider and confirm that explicitly.
create or replace function public.admin_close_needs_review_order(
  p_order_id uuid,
  p_reason text default null,
  p_confirm_refunded boolean default false
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_holds boolean;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'needs_review' then
    return false;
  end if;
  if exists (
    select 1 from public.order_payments
    where order_id = p_order_id and status = 'approved'
  ) then
    raise exception 'approved payment; refund at provider first' using errcode = '55000';
  end if;
  if not p_confirm_refunded and (
    exists (
      select 1 from public.order_payments
      where order_id = p_order_id and status = 'in_process'
    )
    or exists (
      select 1 from public.order_events
      where order_id = p_order_id and event_type = 'payment_amount_mismatch'
    )
  ) then
    raise exception 'money may have been received; refund first and confirm'
      using errcode = '55000';
  end if;
  -- Stock is still reserved unless the order was closed before.
  v_holds := not exists (
    select 1 from public.order_events
    where order_id = p_order_id
      and event_type in ('order_cancelled', 'order_expired', 'order_review_closed')
  );
  if v_holds then
    perform 1 from public.inventory i
    join public.order_items oi on oi.variant_id = i.variant_id
    where oi.order_id = p_order_id
    order by i.variant_id
    for update of i;
    update public.inventory i
    set reserved = greatest(i.reserved - agg.qty, 0), version = i.version + 1, updated_at = now()
    from (
      select variant_id, sum(quantity)::integer as qty
      from public.order_items where order_id = p_order_id group by variant_id
    ) agg
    where i.variant_id = agg.variant_id;
  end if;
  update public.orders
  set status = 'cancelled', cancelled_at = now(),
      cancel_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'admin_review_closed'),
      updated_at = now()
  where id = p_order_id;
  update public.order_groups
  set status = 'cancelled', status_updated_at = now()
  where order_id = p_order_id;
  -- Only never-paid attempts are closed; an 'in_process' payment keeps its
  -- record (the money trail) and is marked refunded by the admin's confirmation.
  update public.order_payments
  set status = case when status = 'in_process' then 'refunded' else 'cancelled' end,
      updated_at = now()
  where order_id = p_order_id and status in ('pending', 'in_process');
  perform private.log_order_event(
    p_order_id, 'admin', (select auth.uid()), 'order_review_closed',
    jsonb_build_object(
      'released_reservation', v_holds,
      'confirmed_refunded', p_confirm_refunded
    )
  );
  return true;
end;
$$;
revoke all on function public.admin_close_needs_review_order(uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_close_needs_review_order(uuid, text, boolean) to authenticated;

-- 4. Reviews: the public reads go through get_published_product_reviews,
--    which hides user_id. Direct table reads exposed reviewers' auth ids.
drop policy if exists "published reviews are public" on public.product_reviews;
revoke select on public.product_reviews from anon;

-- 5. Least privilege on customer_profiles (only select/insert/update used).
revoke all on public.customer_profiles from public, anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;

-- 6. Missing foreign-key / filter indexes.
create index if not exists order_events_actor_id_idx
  on public.order_events(actor_id) where actor_id is not null;
create index if not exists product_reviews_product_id_idx
  on public.product_reviews(product_id);
