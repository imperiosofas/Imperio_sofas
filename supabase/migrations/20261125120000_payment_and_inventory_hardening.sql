-- QA audit 2026-11-25 (DB2 findings). Additive: one new column, replaced
-- function bodies and narrower grants. No data is deleted or rewritten.

-- DB2-01: payment events on orders that are no longer pending.
-- A replayed approval never downgrades an approved payment, a second real
-- payment on a paid order is kept and flagged, and amount mismatches on
-- cancelled/expired orders go to review. payment_alert_at marks orders the
-- store must look at.
alter table public.orders add column if not exists payment_alert_at timestamptz;
create index if not exists orders_payment_alert_idx
  on public.orders(payment_alert_at) where payment_alert_at is not null;

create or replace function public.order_apply_payment_event(
  p_provider text,
  p_event_id text,
  p_order_id uuid,
  p_provider_payment_id text,
  p_status text,
  p_amount_cents integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id bigint;
  v_order public.orders%rowtype;
  v_payment public.order_payments%rowtype;
  v_outcome text;
  v_stock_ok boolean;
begin
  if p_provider not in ('mock', 'mercadopago')
    or p_status not in ('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded')
    or nullif(trim(p_event_id), '') is null then
    raise exception 'invalid payment event' using errcode = '22023';
  end if;

  insert into public.payment_webhook_events (provider, event_id, provider_payment_id, order_id)
  values (p_provider, p_event_id, p_provider_payment_id, p_order_id)
  on conflict (provider, event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    update public.payment_webhook_events set outcome = 'unknown_order', processed_at = now() where id = v_event_id;
    return jsonb_build_object('outcome', 'unknown_order');
  end if;

  select * into v_payment from public.order_payments
  where order_id = p_order_id and provider = p_provider
    and (provider_payment_id = p_provider_payment_id or provider_payment_id is null)
  order by (provider_payment_id is not null) desc, created_at desc limit 1 for update;
  if not found then
    insert into public.order_payments (order_id, provider, amount_cents, idempotency_key, provider_payment_id)
    values (p_order_id, p_provider, v_order.total_cents, gen_random_uuid(), p_provider_payment_id)
    returning * into v_payment;
  elsif v_payment.provider_payment_id is null and p_provider_payment_id is not null then
    update public.order_payments set provider_payment_id = p_provider_payment_id, updated_at = now()
    where id = v_payment.id;
  end if;

  if p_status = 'approved' then
    if v_payment.status = 'approved' then
      -- Replay of an approved payment: never downgrade it; flag a changed amount.
      if p_amount_cents is distinct from v_payment.amount_cents then
        update public.orders set payment_alert_at = coalesce(payment_alert_at, now()) where id = v_order.id;
        perform private.log_order_event(v_order.id, 'server', null, 'payment_amount_changed_after_approval',
          jsonb_build_object('approved_cents', v_payment.amount_cents, 'received_cents', p_amount_cents));
      end if;
      v_outcome := 'already_paid';
    elsif v_order.status in ('paid', 'refunded', 'needs_review') then
      -- A different payment was approved for an order that already has money:
      -- the customer paid twice. Keep the record and alert the store.
      update public.order_payments set status = 'in_process', updated_at = now() where id = v_payment.id;
      update public.orders set payment_alert_at = coalesce(payment_alert_at, now()) where id = v_order.id;
      perform private.log_order_event(v_order.id, 'server', null, 'duplicate_payment_received',
        jsonb_build_object('provider', p_provider, 'amount_cents', p_amount_cents));
      v_outcome := 'duplicate_payment';
    elsif p_amount_cents is distinct from v_order.total_cents then
      update public.order_payments set status = 'in_process', updated_at = now() where id = v_payment.id;
      if v_order.status in ('pending_payment', 'cancelled', 'expired') then
        update public.orders set status = 'needs_review', payment_alert_at = coalesce(payment_alert_at, now()),
          updated_at = now() where id = v_order.id;
      end if;
      perform private.log_order_event(v_order.id, 'server', null, 'payment_amount_mismatch',
        jsonb_build_object('expected_cents', v_order.total_cents, 'received_cents', p_amount_cents));
      v_outcome := 'amount_mismatch';
    elsif v_order.status = 'pending_payment' then
      perform private.consume_order_stock(v_order.id);
      update public.orders set status = 'paid', paid_at = now(), updated_at = now() where id = v_order.id;
      update public.order_groups set status = 'preparing', status_updated_at = now() where order_id = v_order.id;
      update public.order_payments set status = 'approved', approved_at = now(), updated_at = now() where id = v_payment.id;
      delete from public.cart_items ci
      using public.carts c
      where ci.cart_id = c.id and c.user_id = v_order.customer_id
        and ci.variant_id in (select oi.variant_id from public.order_items oi where oi.order_id = v_order.id);
      perform private.log_order_event(v_order.id, 'server', null, 'payment_approved',
        jsonb_build_object('provider', p_provider, 'amount_cents', p_amount_cents));
      v_outcome := 'paid';
    elsif v_order.status in ('expired', 'cancelled') then
      -- Money arrived after the reservation was released: only accept it if
      -- every item can still be reserved, otherwise a person must review it.
      select not exists (
        select 1 from (
          select oi.variant_id, sum(oi.quantity)::integer as qty
          from public.order_items oi where oi.order_id = v_order.id group by oi.variant_id
        ) need
        join public.inventory i on i.variant_id = need.variant_id
        where i.on_hand - i.reserved < need.qty
      ) into v_stock_ok;
      update public.order_payments set status = 'approved', approved_at = now(), updated_at = now() where id = v_payment.id;
      if v_stock_ok then
        perform private.consume_order_stock_late(v_order.id);
        update public.orders set status = 'paid', paid_at = now(), cancelled_at = null,
          cancel_reason = null, updated_at = now() where id = v_order.id;
        update public.order_groups set status = 'preparing', status_updated_at = now() where order_id = v_order.id;
        delete from public.cart_items ci
        using public.carts c
        where ci.cart_id = c.id and c.user_id = v_order.customer_id
          and ci.variant_id in (select oi.variant_id from public.order_items oi where oi.order_id = v_order.id);
        perform private.log_order_event(v_order.id, 'server', null, 'late_payment_recovered',
          jsonb_build_object('provider', p_provider));
        v_outcome := 'paid_late';
      else
        update public.orders set status = 'needs_review', payment_alert_at = coalesce(payment_alert_at, now()),
          updated_at = now() where id = v_order.id;
        perform private.log_order_event(v_order.id, 'server', null, 'late_payment_no_stock',
          jsonb_build_object('provider', p_provider));
        v_outcome := 'needs_review';
      end if;
    else
      v_outcome := 'ignored_' || v_order.status;
    end if;
  elsif p_status = 'refunded' then
    update public.order_payments set status = 'refunded', updated_at = now() where id = v_payment.id;
    if v_order.status = 'paid' then
      update public.orders set status = 'refunded', updated_at = now() where id = v_order.id;
      perform private.log_order_event(v_order.id, 'server', null, 'payment_refunded',
        jsonb_build_object('provider', p_provider));
    end if;
    v_outcome := 'refunded';
  else
    if v_payment.status <> 'approved' then
      update public.order_payments set status = p_status, updated_at = now() where id = v_payment.id;
    end if;
    perform private.log_order_event(v_order.id, 'server', null, 'payment_' || p_status,
      jsonb_build_object('provider', p_provider));
    v_outcome := p_status;
  end if;

  update public.payment_webhook_events
  set outcome = v_outcome, processed_at = now() where id = v_event_id;
  return jsonb_build_object('outcome', v_outcome, 'order_id', v_order.id);
end;
$$;

revoke all on function public.order_apply_payment_event(text, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.order_apply_payment_event(text, text, uuid, text, text, integer) to service_role;

-- DB2-02: nobody writes inventory.reserved directly (only the order RPCs do),
-- and one drifted counter must not block the whole expiry run.
revoke update on public.inventory from authenticated;
grant update (on_hand, low_stock_threshold, version, updated_at) on public.inventory to authenticated;

create or replace function public.expire_pending_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'pending_payment' and o.payment_expires_at <= now()
    order by o.payment_expires_at for update skip locked
  loop
    begin
      if private.cancel_order(v_id, 'expired', 'payment_window_elapsed', 'system', null) then
        v_count := v_count + 1;
      end if;
    exception when check_violation then
      perform private.log_order_event(v_id, 'system', null, 'expire_failed_inventory_drift',
        jsonb_build_object('sqlstate', sqlstate));
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_pending_orders() from public, anon, authenticated, service_role;
grant execute on function public.expire_pending_orders() to service_role;

-- DB2-03: a concurrent double submit with the same idempotency key returns
-- the existing order instead of an error (per-customer advisory lock).
alter function public.create_checkout_order(uuid, uuid, jsonb) rename to create_checkout_order_impl;
alter function public.create_checkout_order_impl(uuid, uuid, jsonb) set schema private;
revoke all on function private.create_checkout_order_impl(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create function public.create_checkout_order(
  p_idempotency_key uuid,
  p_quote_id uuid default null,
  p_pickup jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_user::text, 0));
  select id into v_existing from public.orders
  where customer_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;
  return private.create_checkout_order_impl(p_idempotency_key, p_quote_id, p_pickup);
end;
$$;
revoke all on function public.create_checkout_order(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb) to authenticated;

-- DB2-04: an order with an approved late payment and no stock can be closed
-- once the admin refunds it at the provider and confirms it.
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
  if not p_confirm_refunded and exists (
    select 1 from public.order_payments
    where order_id = p_order_id and status = 'approved'
  ) then
    raise exception 'approved payment; refund at provider first and confirm' using errcode = '55000';
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
  set status = case when status in ('in_process', 'approved') then 'refunded' else 'cancelled' end,
      updated_at = now()
  where order_id = p_order_id and status in ('pending', 'in_process', 'approved');
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
