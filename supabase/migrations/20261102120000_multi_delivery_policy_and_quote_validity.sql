-- Owner decisions (2026-11-02): one freight per supplier, floor charge once per
-- address, delivery quotes valid for 24 hours. Additive: widens one check and
-- updates the two settings that were intentionally left unset.

do $$
declare
  v_name text;
begin
  for v_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.logistics_settings'::regclass
      and c.contype = 'c'
      and a.attname = 'multi_delivery_policy_status'
  loop
    execute format('alter table public.logistics_settings drop constraint %I', v_name);
  end loop;
end
$$;

alter table public.logistics_settings
  add constraint logistics_settings_multi_delivery_policy_status_check
  check (multi_delivery_policy_status in ('pending', 'per_supplier'));

update public.logistics_settings
set multi_delivery_policy_status = 'per_supplier',
    quote_expiration_minutes = 1440,
    updated_at = now()
where singleton
  and (multi_delivery_policy_status = 'pending' or quote_expiration_minutes is null);

comment on table public.logistics_settings is
  'Operational defaults. Floor fee is recorded once per quote/address. Multi-delivery policy per_supplier = one freight per supplier. Quote validity defaults to 24 hours.';
