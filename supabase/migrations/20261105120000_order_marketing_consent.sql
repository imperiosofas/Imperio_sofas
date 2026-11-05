-- Optional WhatsApp promotions consent captured at checkout (LGPD: consent,
-- independent from the purchase). Write-once per order; revocation is handled
-- by the store on request.
alter table public.orders
  add column if not exists marketing_whatsapp_consent_at timestamptz;

create or replace function public.record_order_marketing_consent(
  p_order_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_updated integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update public.orders
  set marketing_whatsapp_consent_at = now()
  where id = p_order_id and customer_id = v_user
    and marketing_whatsapp_consent_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;
  perform private.log_order_event(
    p_order_id, 'customer', v_user, 'marketing_whatsapp_consent',
    '{}'::jsonb
  );
  return true;
end;
$$;

revoke all on function public.record_order_marketing_consent(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.record_order_marketing_consent(uuid) to authenticated;
