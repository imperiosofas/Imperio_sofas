-- Review fixes for 20261125120000 (independent review, 2026-11-25).
-- Additive: replaced function bodies only. No data is changed.
--
-- 1. Only a NEW payment on a paid/refunded/needs_review order counts as a
--    duplicate. Later updates of the payment that put the order in review
--    (Mercado Pago sends a new event id per update) keep the old behaviour.
-- 2. A payment already marked refunded (including orders closed by the admin
--    after a confirmed refund) is never revived by a later "approved" update.
-- 3. An order whose stock counter drifted is flagged once (payment_alert_at)
--    and skipped by later expiry runs instead of logging every 5 minutes.
-- 4. The order row is locked FOR NO KEY UPDATE: the webhook event insert
--    (FK to orders) already holds KEY SHARE on it, and FOR UPDATE conflicted
--    with the KEY SHARE of a concurrent event for the same order (deadlock).

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
  v_new_payment boolean := false;
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

  select * into v_order from public.orders where id = p_order_id for no key update;
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
    v_new_payment := true;
  elsif v_payment.provider_payment_id is null and p_provider_payment_id is not null then
    update public.order_payments set provider_payment_id = p_provider_payment_id, updated_at = now()
    where id = v_payment.id;
    -- This provider payment had not been seen on the order before.
    v_new_payment := true;
  end if;

  if p_status = 'approved' then
    if v_payment.status = 'refunded' then
      -- Already refunded (or the order was closed after a confirmed refund):
      -- a later "approved" update of the same payment never revives the order.
      update public.orders set payment_alert_at = coalesce(payment_alert_at, now()) where id = v_order.id;
      perform private.log_order_event(v_order.id, 'server', null, 'payment_approved_after_refund',
        jsonb_build_object('provider', p_provider, 'amount_cents', p_amount_cents));
      v_outcome := 'ignored_refunded';
    elsif v_payment.status = 'approved' then
      -- Replay of an approved payment: never downgrade it; flag a changed amount.
      if p_amount_cents is distinct from v_payment.amount_cents then
        update public.orders set payment_alert_at = coalesce(payment_alert_at, now()) where id = v_order.id;
        perform private.log_order_event(v_order.id, 'server', null, 'payment_amount_changed_after_approval',
          jsonb_build_object('approved_cents', v_payment.amount_cents, 'received_cents', p_amount_cents));
      end if;
      v_outcome := 'already_paid';
    elsif v_new_payment and v_order.status in ('paid', 'refunded', 'needs_review') then
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

create or replace function public.expire_pending_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select o.id from public.orders o
    where o.status = 'pending_payment' and o.payment_expires_at <= now()
      and o.payment_alert_at is null
    order by o.payment_expires_at for update skip locked
  loop
    begin
      if private.cancel_order(v_id, 'expired', 'payment_window_elapsed', 'system', null) then
        v_count := v_count + 1;
      end if;
    exception when check_violation then
      -- Flag it once and leave it to a person; the next runs skip it.
      update public.orders set payment_alert_at = coalesce(payment_alert_at, now()) where id = v_id;
      perform private.log_order_event(v_id, 'system', null, 'expire_failed_inventory_drift',
        jsonb_build_object('sqlstate', sqlstate));
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.expire_pending_orders() from public, anon, authenticated, service_role;
grant execute on function public.expire_pending_orders() to service_role;
