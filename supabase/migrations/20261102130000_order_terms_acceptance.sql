-- Records which version of the purchase terms a customer accepted at checkout.
-- Additive: two nullable columns plus one customer-scoped, write-once RPC.
-- create_checkout_order is intentionally left untouched.

alter table public.orders
  add column if not exists terms_version text
    check (terms_version is null or char_length(terms_version) between 1 and 64),
  add column if not exists terms_accepted_at timestamptz;

comment on column public.orders.terms_version is
  'Version label of the terms the customer accepted when placing the order.';
comment on column public.orders.terms_accepted_at is
  'When the customer accepted the terms. Written once by record_order_terms_acceptance.';

-- Returns true when the acceptance was recorded, false when it was already set.
create or replace function public.record_order_terms_acceptance(
  p_order_id uuid,
  p_terms_version text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_version text := nullif(btrim(p_terms_version), '');
  v_updated integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_version is null or char_length(v_version) > 64 then
    raise exception 'terms version invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.orders o where o.id = p_order_id and o.customer_id = v_user
  ) then
    raise exception 'order not found' using errcode = '42501';
  end if;

  update public.orders
  set terms_version = v_version, terms_accepted_at = now()
  where id = p_order_id and customer_id = v_user and terms_accepted_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  perform private.log_order_event(
    p_order_id, 'customer', v_user, 'terms_accepted',
    jsonb_build_object('terms_version', v_version)
  );
  return true;
end;
$$;

revoke all on function public.record_order_terms_acceptance(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_order_terms_acceptance(uuid, text) to authenticated;
