-- Logistics foundation. This migration defines operational metadata and
-- quote requests only; it does not create orders, payments, or reservations.

create table public.logistics_suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('VALE', 'MUNDIAL')),
  display_name text not null check (display_name = trim(display_name) and char_length(display_name) between 1 and 80),
  is_active boolean not null default true,
  allows_delivery boolean not null default true,
  allows_pickup boolean not null default false,
  lead_min_business_days integer not null check (lead_min_business_days >= 0),
  lead_max_business_days integer not null check (lead_max_business_days >= lead_min_business_days),
  lead_time_starts_on text not null default 'payment_confirmed'
    check (lead_time_starts_on = 'payment_confirmed'),
  delivery_quote_required boolean not null default true,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code <> 'MUNDIAL' or not allows_pickup),
  constraint logistics_suppliers_delivery_requires_quote
    check (not allows_delivery or delivery_quote_required)
);

insert into public.logistics_suppliers (
  code, display_name, is_active, allows_delivery, allows_pickup,
  lead_min_business_days, lead_max_business_days, lead_time_starts_on,
  delivery_quote_required, admin_notes
)
values
  ('VALE', 'Vale', true, true, true, 7, 7, 'payment_confirmed', true, null),
  ('MUNDIAL', 'Mundial', true, true, false, 30, 45, 'payment_confirmed', true, null)
on conflict (code) do nothing;

alter table public.products
  add column supplier_id uuid references public.logistics_suppliers(id) on delete restrict;

comment on column public.products.supplier_id is
  'Explicit logistics supplier assignment. Existing products are intentionally left NULL until an administrator confirms each assignment.';

create index products_supplier_id_idx on public.products(supplier_id) where supplier_id is not null;

create table public.logistics_areas (
  ibge_code text primary key check (ibge_code ~ '^[0-9]{7}$'),
  city_name text not null,
  state_code text not null check (state_code = 'SP'),
  is_enabled boolean not null default true,
  source text not null default 'IBGE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_name, state_code)
);

insert into public.logistics_areas (ibge_code, city_name, state_code, is_enabled, source)
values
  ('3508504', 'Caçapava', 'SP', true, 'IBGE'),
  ('3549904', 'São José dos Campos', 'SP', true, 'IBGE'),
  ('3524402', 'Jacareí', 'SP', true, 'IBGE'),
  ('3554102', 'Taubaté', 'SP', true, 'IBGE'),
  ('3554805', 'Tremembé', 'SP', true, 'IBGE'),
  ('3538006', 'Pindamonhangaba', 'SP', true, 'IBGE'),
  ('3502507', 'Aparecida', 'SP', true, 'IBGE'),
  ('3518404', 'Guaratinguetá', 'SP', true, 'IBGE'),
  ('3527207', 'Lorena', 'SP', true, 'IBGE'),
  ('3508603', 'Cachoeira Paulista', 'SP', true, 'IBGE'),
  ('3544301', 'Roseira', 'SP', true, 'IBGE'),
  ('3540754', 'Potim', 'SP', true, 'IBGE')
on conflict (ibge_code) do nothing;

create table public.logistics_pickup_locations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.logistics_suppliers(id) on delete restrict,
  location_code text not null,
  display_name text not null,
  street text not null,
  street_number text not null,
  neighborhood text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}-[0-9]{3}$'),
  ibge_code text not null references public.logistics_areas(ibge_code) on delete restrict,
  state_code text not null check (state_code = 'SP'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, location_code),
  check (street_number = trim(street_number) and length(street_number) > 0)
);

insert into public.logistics_pickup_locations (
  supplier_id, location_code, display_name, street, street_number,
  neighborhood, postal_code, ibge_code, state_code, is_active
)
select s.id, 'VALE_GALPAO', 'Galpão Vale', 'Rua Agostinho Abifadel', '35',
  'Terra Nova', '12081-670', '3554102', 'SP', true
from public.logistics_suppliers s
where s.code = 'VALE'
on conflict (supplier_id, location_code) do nothing;

create table public.logistics_settings (
  singleton boolean primary key default true check (singleton),
  floor_charge_cents integer not null default 1000 check (floor_charge_cents >= 0),
  included_through_floor integer not null default 4 check (included_through_floor >= 0),
  quote_expiration_minutes integer check (quote_expiration_minutes is null or quote_expiration_minutes > 0),
  whatsapp_phone_e164 text check (
    whatsapp_phone_e164 is null or whatsapp_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  multi_delivery_policy_status text not null default 'pending'
    check (multi_delivery_policy_status = 'pending'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.logistics_settings (singleton, floor_charge_cents, included_through_floor)
values (true, 1000, 4)
on conflict (singleton) do nothing;

comment on table public.logistics_settings is
  'Operational defaults. The floor fee is recorded once per quote/address; final multi-delivery checkout policy remains pending. Quote expiry and WhatsApp remain unset until explicitly configured.';

create table public.logistics_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint jsonb not null check (jsonb_typeof(request_fingerprint) = 'object'),
  status text not null default 'awaiting_quote'
    check (status in ('awaiting_quote', 'quoted', 'accepted', 'rejected', 'cancelled', 'invalidated', 'expired')),
  delivery_postal_code text check (delivery_postal_code is null or delivery_postal_code ~ '^[0-9]{8}$'),
  delivery_street text,
  delivery_number text,
  delivery_complement text,
  delivery_neighborhood text,
  delivery_ibge_code text references public.logistics_areas(ibge_code) on delete restrict,
  delivery_city_name_snapshot text,
  delivery_state_code text check (delivery_state_code is null or delivery_state_code = 'SP'),
  delivery_floor_number integer check (delivery_floor_number is null or delivery_floor_number >= 0),
  cep_verified_at timestamptz,
  cep_verification_source text check (cep_verification_source is null or cep_verification_source = 'viacep'),
  floor_charge_cents integer not null default 0 check (floor_charge_cents >= 0),
  included_through_floor_snapshot integer not null default 4 check (included_through_floor_snapshot >= 0),
  floor_charge_per_floor_cents_snapshot integer not null default 1000 check (floor_charge_per_floor_cents_snapshot >= 0),
  quote_expires_at timestamptz,
  customer_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (
    (delivery_ibge_code is null and delivery_postal_code is null
      and delivery_street is null and delivery_number is null
      and delivery_neighborhood is null and delivery_city_name_snapshot is null
      and delivery_state_code is null and delivery_floor_number is null
      and cep_verified_at is null and cep_verification_source is null
      and floor_charge_cents = 0)
    or
    (delivery_ibge_code is not null and delivery_postal_code is not null
      and delivery_street is not null and delivery_number is not null
      and delivery_neighborhood is not null and delivery_city_name_snapshot is not null
      and delivery_state_code = 'SP' and delivery_floor_number is not null
      and cep_verified_at is not null and cep_verification_source = 'viacep')
  )
);

create index logistics_quotes_customer_created_idx
  on public.logistics_quotes(customer_id, created_at desc);
create index logistics_quotes_status_created_idx
  on public.logistics_quotes(status, created_at desc);

create table public.logistics_quote_groups (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.logistics_quotes(id) on delete restrict,
  supplier_id uuid not null references public.logistics_suppliers(id) on delete restrict,
  supplier_code_snapshot text not null check (supplier_code_snapshot in ('VALE', 'MUNDIAL')),
  fulfillment_mode text not null check (fulfillment_mode in ('delivery', 'pickup')),
  pickup_location_id uuid references public.logistics_pickup_locations(id) on delete restrict,
  status text not null default 'awaiting_quote'
    check (status in ('awaiting_quote', 'quoted', 'cancelled', 'invalidated')),
  base_freight_cents integer check (base_freight_cents is null or base_freight_cents >= 0),
  quoted_by uuid references auth.users(id) on delete set null,
  quoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, supplier_id),
  check ((fulfillment_mode = 'pickup') = (pickup_location_id is not null)),
  check (status <> 'quoted' or (base_freight_cents is not null and quoted_at is not null))
);

create index logistics_quote_groups_quote_status_idx
  on public.logistics_quote_groups(quote_id, status);

create table public.logistics_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_group_id uuid not null references public.logistics_quote_groups(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  product_name_snapshot text not null,
  product_slug_snapshot text not null,
  variant_snapshot jsonb not null check (jsonb_typeof(variant_snapshot) = 'object'),
  unit_price_cents_snapshot integer not null check (unit_price_cents_snapshot > 0),
  created_at timestamptz not null default now(),
  unique (quote_group_id, variant_id)
);

create index logistics_quote_items_variant_idx on public.logistics_quote_items(variant_id);

create table public.logistics_quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.logistics_quotes(id) on delete restrict,
  quote_group_id uuid references public.logistics_quote_groups(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('customer', 'admin', 'server')),
  event_type text not null check (event_type in (
    'quote_created', 'group_created', 'group_priced', 'group_repriced',
    'customer_accepted', 'customer_rejected', 'customer_cancelled', 'quote_expired',
    'quote_invalidated'
  )),
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);

create index logistics_quote_events_quote_created_idx
  on public.logistics_quote_events(quote_id, occurred_at, id);

create table public.logistics_admin_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in (
    'product', 'area', 'settings', 'supplier', 'pickup_location', 'quote_group'
  )),
  entity_key text not null,
  event_type text not null,
  before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(after_state) = 'object'),
  occurred_at timestamptz not null default now()
);

create index logistics_admin_events_entity_idx
  on public.logistics_admin_events(entity_type, entity_key, occurred_at desc);

-- Quotes are snapshots. Cart, request, coverage, supplier, pickup-location,
-- product-classification, and delivery-term changes invalidate them transactionally.
create function private.invalidate_open_logistics_quotes(
  p_customer_id uuid,
  p_reason text,
  p_different_fingerprint jsonb default null,
  p_ibge_code text default null,
  p_supplier_id uuid default null,
  p_pickup_location_id uuid default null,
  p_product_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote record;
  v_count integer := 0;
begin
  if p_reason is null
    or p_reason not in (
      'cart_changed', 'request_changed', 'area_disabled',
      'supplier_changed', 'pickup_location_changed',
      'product_supplier_changed', 'delivery_terms_changed', 'quote_expiry_changed'
    ) then
    raise exception 'invalid quote invalidation request' using errcode = '22023';
  end if;
  if p_reason in ('cart_changed', 'request_changed') and p_customer_id is null then
    raise exception 'customer required for this invalidation' using errcode = '22023';
  end if;
  if p_reason not in ('cart_changed', 'request_changed') and p_customer_id is not null then
    raise exception 'customer id is only valid for customer quote invalidation' using errcode = '22023';
  end if;
  if p_reason = 'request_changed' and p_different_fingerprint is null then
    raise exception 'request fingerprint required' using errcode = '22023';
  end if;
  if p_reason <> 'request_changed' and p_different_fingerprint is not null then
    raise exception 'request fingerprint is only valid for request invalidation' using errcode = '22023';
  end if;
  if p_reason = 'area_disabled'
    and (p_customer_id is not null or coalesce(p_ibge_code, '') !~ '^[0-9]{7}$') then
    raise exception 'approved area code required' using errcode = '22023';
  end if;
  if p_reason = 'supplier_changed'
    and (p_customer_id is not null or p_supplier_id is null or p_pickup_location_id is not null) then
    raise exception 'supplier id required for supplier invalidation' using errcode = '22023';
  end if;
  if p_reason = 'pickup_location_changed'
    and (p_customer_id is not null or p_pickup_location_id is null or p_supplier_id is not null) then
    raise exception 'pickup location id required for pickup invalidation' using errcode = '22023';
  end if;
  if p_reason = 'product_supplier_changed'
    and (p_customer_id is not null or p_product_id is null) then
    raise exception 'product id required for supplier assignment invalidation' using errcode = '22023';
  end if;
  if p_reason = 'delivery_terms_changed'
    and (p_customer_id is not null or p_different_fingerprint is not null
      or p_ibge_code is not null or p_supplier_id is not null
      or p_pickup_location_id is not null or p_product_id is not null) then
    raise exception 'delivery terms invalidation cannot be scoped to another entity' using errcode = '22023';
  end if;
  if p_reason <> 'area_disabled' and p_ibge_code is not null then
    raise exception 'area code is only valid for area invalidation' using errcode = '22023';
  end if;
  if p_reason not in ('supplier_changed') and p_supplier_id is not null then
    raise exception 'supplier id is only valid for supplier invalidation' using errcode = '22023';
  end if;
  if p_reason not in ('pickup_location_changed') and p_pickup_location_id is not null then
    raise exception 'pickup location id is only valid for pickup invalidation' using errcode = '22023';
  end if;
  if p_reason <> 'product_supplier_changed' and p_product_id is not null then
    raise exception 'product id is only valid for supplier assignment invalidation' using errcode = '22023';
  end if;

  for v_quote in
    select q.id, q.status
    from public.logistics_quotes q
    where (
        (p_reason in ('cart_changed', 'request_changed') and q.customer_id = p_customer_id)
        or (p_reason = 'area_disabled' and q.delivery_ibge_code = p_ibge_code)
        or (p_reason = 'supplier_changed' and exists (
          select 1 from public.logistics_quote_groups g
          where g.quote_id = q.id and g.supplier_id = p_supplier_id
        ))
        or (p_reason = 'pickup_location_changed' and exists (
          select 1 from public.logistics_quote_groups g
          where g.quote_id = q.id and g.pickup_location_id = p_pickup_location_id
        ))
        or (p_reason = 'product_supplier_changed' and exists (
          select 1
          from public.logistics_quote_items qi
          join public.logistics_quote_groups g on g.id = qi.quote_group_id
          where g.quote_id = q.id and qi.product_id = p_product_id
        ))
        or (p_reason = 'delivery_terms_changed' and exists (
          select 1 from public.logistics_quote_groups g
          where g.quote_id = q.id and g.fulfillment_mode = 'delivery'
        ))
        or p_reason = 'quote_expiry_changed'
      )
      and q.status in ('awaiting_quote', 'quoted', 'accepted')
      and (
        p_reason = 'cart_changed'
        or (p_reason = 'request_changed' and q.request_fingerprint is distinct from p_different_fingerprint)
        or p_reason in (
          'area_disabled', 'supplier_changed', 'pickup_location_changed',
          'product_supplier_changed', 'delivery_terms_changed', 'quote_expiry_changed'
        )
      )
      and (p_reason <> 'quote_expiry_changed' or q.status = 'quoted')
    for update
  loop
    update public.logistics_quote_groups g
    set status = 'invalidated', updated_at = now()
    where g.quote_id = v_quote.id and g.status in ('awaiting_quote', 'quoted', 'accepted');
    update public.logistics_quotes q
    set status = 'invalidated', updated_at = now()
    where q.id = v_quote.id;
    insert into public.logistics_quote_events (
      quote_id, actor_id, actor_type, event_type, from_status, to_status, payload
    ) values (
      v_quote.id, null, 'server', 'quote_invalidated', v_quote.status, 'invalidated',
      jsonb_build_object('reason', p_reason)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function private.invalidate_logistics_quotes_after_cart_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  if tg_op = 'UPDATE' and old.cart_id is distinct from new.cart_id then
    for v_customer_id in
      select distinct c.user_id
      from public.carts c
      where c.id in (old.cart_id, new.cart_id)
      order by c.user_id
    loop
      perform private.invalidate_open_logistics_quotes(v_customer_id, 'cart_changed');
    end loop;
  else
    select c.user_id into v_customer_id
    from public.carts c
    where c.id = case when tg_op = 'DELETE' then old.cart_id else new.cart_id end;
    if v_customer_id is not null then
      perform private.invalidate_open_logistics_quotes(v_customer_id, 'cart_changed');
    end if;
  end if;
  return null;
end;
$$;

create function private.invalidate_logistics_quotes_after_product_supplier_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.supplier_id is distinct from new.supplier_id then
    perform private.invalidate_open_logistics_quotes(
      null, 'product_supplier_changed', null, null, null, null, new.id
    );
  end if;
  return new;
end;
$$;

create trigger logistics_cart_items_invalidate_quotes
after insert or update or delete on public.cart_items
for each row execute function private.invalidate_logistics_quotes_after_cart_change();

create trigger products_logistics_supplier_invalidate_quotes
after update of supplier_id on public.products
for each row
when (old.supplier_id is distinct from new.supplier_id)
execute function private.invalidate_logistics_quotes_after_product_supplier_change();

revoke all on function private.invalidate_open_logistics_quotes(uuid, text, jsonb, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.invalidate_logistics_quotes_after_cart_change()
  from public, anon, authenticated, service_role;
revoke all on function private.invalidate_logistics_quotes_after_product_supplier_change()
  from public, anon, authenticated, service_role;

alter table public.logistics_suppliers enable row level security;
alter table public.logistics_areas enable row level security;
alter table public.logistics_pickup_locations enable row level security;
alter table public.logistics_settings enable row level security;
alter table public.logistics_quotes enable row level security;
alter table public.logistics_quote_groups enable row level security;
alter table public.logistics_quote_items enable row level security;
alter table public.logistics_quote_events enable row level security;
alter table public.logistics_admin_events enable row level security;

revoke all on table
  public.logistics_suppliers,
  public.logistics_areas,
  public.logistics_pickup_locations,
  public.logistics_settings,
  public.logistics_quotes,
  public.logistics_quote_groups,
  public.logistics_quote_items,
  public.logistics_quote_events,
  public.logistics_admin_events
from public, anon, authenticated, service_role;

revoke all on sequence public.logistics_admin_events_id_seq
from public, anon, authenticated, service_role;

-- Public PDP projection: only an already-public, sellable product can be
-- resolved. No source tables are exposed to anon/authenticated clients.
create function public.get_public_product_logistics(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'product_id', p.id,
    'slug', p.slug,
    'supplier_id', p.supplier_id,
    'supplier_code', s.code,
    'supplier_name', s.display_name,
    'supplier_active', coalesce(s.is_active, false),
    'supplier_assigned', p.supplier_id is not null,
    'fulfillment_modes', to_jsonb(array_remove(array[
      case when s.is_active and s.allows_delivery then 'delivery' end,
      case when s.is_active and s.allows_pickup then 'pickup' end
    ], null)),
    'lead_min_business_days', case when s.is_active then s.lead_min_business_days end,
    'lead_max_business_days', case when s.is_active then s.lead_max_business_days end,
    'delivery_quote_required', case when s.is_active then s.delivery_quote_required end,
    'delivery_areas', case when s.is_active and s.allows_delivery then coalesce((
      select jsonb_agg(jsonb_build_object(
        'ibge_code', a.ibge_code, 'city_name', a.city_name, 'state_code', a.state_code
      ) order by a.city_name)
      from public.logistics_areas a where a.is_enabled
    ), '[]'::jsonb) else '[]'::jsonb end,
    'pickup_locations', case when s.is_active and s.allows_pickup then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'display_name', l.display_name, 'street', l.street,
        'street_number', l.street_number, 'neighborhood', l.neighborhood,
        'postal_code', l.postal_code, 'city_name', a.city_name,
        'state_code', l.state_code
      ) order by l.display_name)
      from public.logistics_pickup_locations l
      join public.logistics_areas a on a.ibge_code = l.ibge_code
      where l.supplier_id = s.id and l.is_active
    ), '[]'::jsonb) else '[]'::jsonb end,
    'floor_charge', jsonb_build_object(
      'floor_charge_cents', cfg.floor_charge_cents,
      'included_through_floor', cfg.included_through_floor,
      'applied_once_per_quote_address', true
    ),
    'quote_expiration_minutes', cfg.quote_expiration_minutes,
    'whatsapp_phone_e164', cfg.whatsapp_phone_e164
  )
  from public.products p
  join public.categories c on c.id = p.category_id and c.is_active
  left join public.logistics_suppliers s on s.id = p.supplier_id
  cross join public.logistics_settings cfg
  where p.slug = p_slug
    and p.status = 'active'
    and exists (
      select 1
      from public.product_variants v
      join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active
        and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0 and i.on_hand > i.reserved
    )
  limit 1;
$$;

-- Authenticated cart projection. It reports only a boolean availability hint,
-- never exact stock, and does not mutate cart rows or invoke cart writers.
create function public.get_my_cart_logistics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', v.id,
        'product_id', p.id,
        'product_slug', p.slug,
        'product_name', p.name,
        'quantity', ci.quantity,
        'supplier_id', p.supplier_id,
        'supplier_code', s.code,
        'supplier_name', s.display_name,
        'supplier_assigned', p.supplier_id is not null,
        'available_for_quote', (
          s.id is not null and s.is_active and (s.allows_delivery or s.allows_pickup)
          and p.status = 'active' and c.is_active and v.is_active
          and nullif(trim(v.sku), '') is not null and v.price_cents > 0
          and i.on_hand - i.reserved >= ci.quantity
        ),
        'fulfillment_modes', to_jsonb(array_remove(array[
          case when s.is_active and s.allows_delivery then 'delivery' end,
          case when s.is_active and s.allows_pickup then 'pickup' end
        ], null))
      ) order by ci.created_at, ci.variant_id)
      from public.carts ca
      join public.cart_items ci on ci.cart_id = ca.id
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
      join public.inventory i on i.variant_id = v.id
      left join public.logistics_suppliers s on s.id = p.supplier_id
      where ca.user_id = v_user_id
    ), '[]'::jsonb),
    'delivery_areas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ibge_code', a.ibge_code, 'city_name', a.city_name, 'state_code', a.state_code
      ) order by a.city_name)
      from public.logistics_areas a where a.is_enabled
    ), '[]'::jsonb),
    'pickup_locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'supplier_code', s.code, 'display_name', l.display_name,
        'street', l.street, 'street_number', l.street_number,
        'neighborhood', l.neighborhood, 'postal_code', l.postal_code,
        'city_name', a.city_name, 'state_code', l.state_code
      ) order by l.display_name)
      from public.logistics_pickup_locations l
      join public.logistics_suppliers s on s.id = l.supplier_id
      join public.logistics_areas a on a.ibge_code = l.ibge_code
      where l.is_active and s.is_active and s.allows_pickup
    ), '[]'::jsonb),
    'floor_charge', jsonb_build_object(
      'floor_charge_cents', cfg.floor_charge_cents,
      'included_through_floor', cfg.included_through_floor,
      'applied_once_per_quote_address', true
    ),
    'quote_expiration_minutes', cfg.quote_expiration_minutes,
    'whatsapp_phone_e164', cfg.whatsapp_phone_e164
  ) into v_result
  from public.logistics_settings cfg
  where cfg.singleton;

  return v_result;
end;
$$;

revoke all on function public.get_public_product_logistics(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_product_logistics(text) to anon, authenticated;
revoke all on function public.get_my_cart_logistics() from public, anon, authenticated, service_role;
grant execute on function public.get_my_cart_logistics() to authenticated;

comment on function public.get_public_product_logistics(text) is
  'Public, sellable-product logistics projection; reads are restricted to active catalog products and do not expose internal logistics tables.';
comment on function public.get_my_cart_logistics() is
  'Authenticated owner-only logistics projection for the current cart; read-only and never returns exact inventory.';

-- This RPC is a server trust boundary, not a customer-facing PostgREST method.
-- The server action must validate the session with Supabase Auth getUser(),
-- derive p_user_id from that verified identity, and resolve/verify CEP via
-- ViaCEP server-side. Client-supplied user IDs or IBGE data must be ignored.
-- Call with the Supabase secret key only as the apikey header. Do not send it
-- as an Authorization bearer token: sb_secret is not a JWT and auth.jwt() is
-- not the authorization boundary here. The EXECUTE grant to service_role is the gate.
create function public.logistics_create_quote_server(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_supplier_modes jsonb,
  p_address jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_existing_fingerprint jsonb;
  v_fingerprint jsonb;
  v_address jsonb := coalesce(p_address, '{}'::jsonb);
  v_has_delivery boolean;
  v_cep text;
  v_ibge_code text;
  v_city_name text;
  v_state_code text;
  v_floor integer;
  v_floor_charge integer := 0;
  v_floor_included integer := 4;
  v_floor_rate integer := 1000;
  v_normalized_modes jsonb;
  v_settings public.logistics_settings%rowtype;
  v_area public.logistics_areas%rowtype;
  v_supplier public.logistics_suppliers%rowtype;
  v_group jsonb;
  v_item jsonb;
  v_group_id uuid;
  v_pickup_location_id uuid;
  v_pickup_location public.logistics_pickup_locations%rowtype;
  v_supplier_code text;
  v_fulfillment_mode text;
  v_cart_id uuid;
  v_cart_snapshot jsonb;
  v_submitted_snapshot jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_product record;
  v_calculated_fee bigint;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'verified customer required' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  select c.id into v_cart_id from public.carts c
  where c.user_id = p_user_id for update;
  if not found then
    raise exception 'customer cart required' using errcode = '22023';
  end if;
  perform 1
  from public.cart_items ci
  where ci.cart_id = v_cart_id
  order by ci.variant_id
  for update;
  if jsonb_typeof(p_supplier_modes) is distinct from 'array'
    or jsonb_array_length(p_supplier_modes) not between 1 and 2 then
    raise exception 'one or two supplier groups required' using errcode = '22023';
  end if;
  if jsonb_typeof(v_address) is distinct from 'object' then
    raise exception 'address must be an object' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_supplier_modes) g(value)
    where jsonb_typeof(g.value) is distinct from 'object'
      or jsonb_typeof(g.value -> 'items') is distinct from 'array'
      or jsonb_array_length(g.value -> 'items') = 0
      or jsonb_typeof(g.value -> 'supplier_code') is distinct from 'string'
      or nullif(trim(g.value ->> 'supplier_code'), '') is null
      or jsonb_typeof(g.value -> 'fulfillment_mode') is distinct from 'string'
      or lower(trim(g.value ->> 'fulfillment_mode')) not in ('delivery', 'pickup')
  ) then
    raise exception 'invalid supplier group' using errcode = '22023';
  end if;
  if (
    select count(distinct upper(trim(g.value ->> 'supplier_code')))
    from jsonb_array_elements(p_supplier_modes) g(value)
  ) <> jsonb_array_length(p_supplier_modes) then
    raise exception 'duplicate supplier group' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_supplier_modes) g(value)
    cross join lateral jsonb_array_elements(g.value -> 'items') i(value)
    where jsonb_typeof(i.value) is distinct from 'object'
      or nullif(trim(i.value ->> 'variant_id'), '') is null
      or coalesce(i.value ->> 'quantity', '') !~ '^[0-9]+$'
  ) then
    raise exception 'invalid quote item shape' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_supplier_modes) g(value)
    cross join lateral jsonb_array_elements(g.value -> 'items') i(value)
    group by i.value ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate quote item' using errcode = '22023';
  end if;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'supplier_code', normalized.supplier_code,
      'fulfillment_mode', normalized.fulfillment_mode,
      'pickup_location_id', normalized.pickup_location_id,
      'items', normalized.items
    ) order by normalized.supplier_code), '[]'::jsonb)
    into v_normalized_modes
    from (
      select upper(trim(g.value ->> 'supplier_code')) as supplier_code,
        lower(trim(g.value ->> 'fulfillment_mode')) as fulfillment_mode,
        nullif(trim(g.value ->> 'pickup_location_id'), '')::uuid as pickup_location_id,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'variant_id', (item.value ->> 'variant_id')::uuid,
            'quantity', (item.value ->> 'quantity')::integer
          ) order by (item.value ->> 'variant_id')::uuid)
          from jsonb_array_elements(g.value -> 'items') item(value)
        ), '[]'::jsonb) as items
      from jsonb_array_elements(p_supplier_modes) g(value)
    ) normalized;
  exception when others then
    raise exception 'invalid supplier modes or item values' using errcode = '22023';
  end;
  p_supplier_modes := v_normalized_modes;

  if exists (
    select 1
    from jsonb_array_elements(p_supplier_modes) g(value)
    cross join lateral jsonb_array_elements(g.value -> 'items') i(value)
    group by i.value ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate quote item' using errcode = '22023';
  end if;

  v_has_delivery := exists (
    select 1 from jsonb_array_elements(p_supplier_modes) g(value)
    where g.value ->> 'fulfillment_mode' = 'delivery'
  );
  select * into strict v_settings
  from public.logistics_settings cfg where cfg.singleton
  for share;
  v_floor_included := v_settings.included_through_floor;
  v_floor_rate := v_settings.floor_charge_cents;

  if v_has_delivery then
    v_cep := regexp_replace(coalesce(v_address ->> 'postal_code', ''), '[^0-9]', '', 'g');
    v_ibge_code := v_address ->> 'ibge_code';
    v_city_name := nullif(trim(v_address ->> 'city_name'), '');
    v_state_code := upper(trim(coalesce(v_address ->> 'state_code', '')));
    if v_cep !~ '^[0-9]{8}$'
      or regexp_replace(coalesce(v_address ->> 'cep_verified_postal_code', ''), '[^0-9]', '', 'g') <> v_cep
      or coalesce(v_address ->> 'cep_verification_source', '') <> 'viacep'
      or nullif(v_address ->> 'cep_verified_at', '') is null
      or v_ibge_code !~ '^[0-9]{7}$'
      or v_state_code <> 'SP'
      or v_city_name is null
      or nullif(trim(v_address ->> 'street'), '') is null
      or nullif(trim(v_address ->> 'number'), '') is null
      or nullif(trim(v_address ->> 'neighborhood'), '') is null then
      raise exception 'verified delivery address required' using errcode = '22023';
    end if;
    select * into v_area
    from public.logistics_areas a
    where a.ibge_code = v_ibge_code
      and a.city_name = v_city_name
      and a.state_code = v_state_code
      and a.is_enabled
    for share;
    if not found then
      raise exception 'delivery area unavailable' using errcode = '22023';
    end if;
    begin
      perform (v_address ->> 'cep_verified_at')::timestamptz;
      if coalesce(v_address ->> 'floor_number', '') !~ '^(0|[1-9][0-9]*)$' then
        raise exception 'floor must be a non-negative integer' using errcode = '22023';
      end if;
      v_floor := (v_address ->> 'floor_number')::integer;
    exception when others then
      raise exception 'invalid CEP proof or floor' using errcode = '22023';
    end;
    if v_floor is null or v_floor < 0 then
      raise exception 'floor must be a non-negative integer' using errcode = '22023';
    end if;
    v_calculated_fee := greatest(0::bigint, v_floor::bigint - v_floor_included::bigint)
      * v_floor_rate::bigint;
    if v_calculated_fee > 2147483647 then
      raise exception 'floor fee exceeds supported amount' using errcode = '22023';
    end if;
    v_floor_charge := v_calculated_fee::integer;
  else
    v_cep := null;
    v_ibge_code := null;
    v_city_name := null;
    v_state_code := null;
    v_floor := null;
    if v_address <> '{}'::jsonb then
      raise exception 'pickup-only quote must not include delivery address' using errcode = '22023';
    end if;
  end if;

  v_fingerprint := jsonb_build_object(
    'supplier_modes', p_supplier_modes,
    'address', case when v_has_delivery then jsonb_build_object(
      'postal_code', v_cep,
      'street', trim(v_address ->> 'street'),
      'number', trim(v_address ->> 'number'),
      'complement', nullif(trim(v_address ->> 'complement'), ''),
      'neighborhood', trim(v_address ->> 'neighborhood'),
      'ibge_code', v_ibge_code,
      'city_name', v_city_name,
      'state_code', v_state_code,
      'floor_number', v_floor
    ) else '{}'::jsonb end
  );

  -- The browser/server CEP lookup happens before this RPC. Re-lock and compare
  -- the complete cart snapshot before inserting any quote so the submitted
  -- supplier/variant/quantity set cannot omit or stale a line.
  -- Lock product classification too: an administrator changing a supplier
  -- serializes with quote creation, then invalidates any snapshot already made.
  perform p.id
  from public.products p
  join public.product_variants v on v.product_id = p.id
  join public.cart_items ci on ci.variant_id = v.id
  where ci.cart_id = v_cart_id
  order by p.id
  for share of p;

  select coalesce(jsonb_agg(jsonb_build_object(
    'supplier_code', upper(s.code),
    'variant_id', ci.variant_id,
    'quantity', ci.quantity
  ) order by upper(s.code), ci.variant_id), '[]'::jsonb)
  into v_cart_snapshot
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  left join public.logistics_suppliers s on s.id = p.supplier_id
  where ci.cart_id = v_cart_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'supplier_code', upper(trim(g.value ->> 'supplier_code')),
    'variant_id', (i.value ->> 'variant_id')::uuid,
    'quantity', (i.value ->> 'quantity')::integer
  ) order by upper(trim(g.value ->> 'supplier_code')), (i.value ->> 'variant_id')::uuid), '[]'::jsonb)
  into v_submitted_snapshot
  from jsonb_array_elements(p_supplier_modes) g(value)
  cross join lateral jsonb_array_elements(g.value -> 'items') i(value);

  if v_submitted_snapshot is distinct from v_cart_snapshot then
    raise exception 'submitted quote groups do not match current cart' using errcode = '22023';
  end if;

  -- Lock the selected configuration before creating a quote row. Admin edits
  -- use FOR UPDATE and invalidate affected quotes in the same transaction.
  for v_group in select value from jsonb_array_elements(p_supplier_modes)
  loop
    v_supplier_code := upper(trim(v_group ->> 'supplier_code'));
    v_fulfillment_mode := v_group ->> 'fulfillment_mode';
    select * into v_supplier
    from public.logistics_suppliers s
    where s.code = v_supplier_code and s.is_active
    for share;
    if not found then
      raise exception 'supplier unavailable' using errcode = '22023';
    end if;
    if v_fulfillment_mode = 'delivery' and not v_supplier.allows_delivery then
      raise exception 'supplier does not support delivery' using errcode = '22023';
    elsif v_fulfillment_mode = 'pickup' and not v_supplier.allows_pickup then
      raise exception 'supplier does not support pickup' using errcode = '22023';
    end if;

    if v_fulfillment_mode = 'pickup' then
      begin
        v_pickup_location_id := (v_group ->> 'pickup_location_id')::uuid;
      exception when others then
        raise exception 'pickup location required' using errcode = '22023';
      end;
      select * into v_pickup_location
      from public.logistics_pickup_locations l
      where l.id = v_pickup_location_id and l.supplier_id = v_supplier.id and l.is_active
      for share;
      if not found then
        raise exception 'pickup location unavailable' using errcode = '22023';
      end if;
    elsif nullif(v_group ->> 'pickup_location_id', '') is not null then
      raise exception 'delivery group cannot select pickup location' using errcode = '22023';
    end if;
  end loop;

  insert into public.logistics_quotes (
    customer_id, idempotency_key, request_fingerprint, status,
    delivery_postal_code, delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_ibge_code, delivery_city_name_snapshot,
    delivery_state_code, delivery_floor_number, cep_verified_at,
    cep_verification_source, floor_charge_cents,
    included_through_floor_snapshot, floor_charge_per_floor_cents_snapshot
  ) values (
    p_user_id, p_idempotency_key, v_fingerprint, 'awaiting_quote',
    v_cep, case when v_has_delivery then trim(v_address ->> 'street') end,
    case when v_has_delivery then trim(v_address ->> 'number') end,
    case when v_has_delivery then nullif(trim(v_address ->> 'complement'), '') end,
    case when v_has_delivery then trim(v_address ->> 'neighborhood') end,
    v_ibge_code, v_city_name, v_state_code, v_floor,
    case when v_has_delivery then (v_address ->> 'cep_verified_at')::timestamptz end,
    case when v_has_delivery then 'viacep' end,
    v_floor_charge, v_floor_included, v_floor_rate
  ) on conflict (customer_id, idempotency_key) do nothing
  returning id into v_quote_id;

  if v_quote_id is null then
    select q.id, q.request_fingerprint into v_quote_id, v_existing_fingerprint
    from public.logistics_quotes q
    where q.customer_id = p_user_id and q.idempotency_key = p_idempotency_key
    for update;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency key reused with different input' using errcode = '22023';
    end if;
    return v_quote_id;
  end if;

  perform private.invalidate_open_logistics_quotes(p_user_id, 'request_changed', v_fingerprint);

  for v_group in select value from jsonb_array_elements(p_supplier_modes)
  loop
    v_supplier_code := upper(trim(v_group ->> 'supplier_code'));
    v_fulfillment_mode := v_group ->> 'fulfillment_mode';
    select * into v_supplier
    from public.logistics_suppliers s
    where s.code = v_supplier_code and s.is_active
    for share;
    if not found then
      raise exception 'supplier unavailable' using errcode = '22023';
    end if;
    if v_fulfillment_mode = 'delivery' and not v_supplier.allows_delivery then
      raise exception 'supplier does not support delivery' using errcode = '22023';
    elsif v_fulfillment_mode = 'pickup' and not v_supplier.allows_pickup then
      raise exception 'supplier does not support pickup' using errcode = '22023';
    elsif v_fulfillment_mode not in ('delivery', 'pickup') then
      raise exception 'invalid fulfillment mode' using errcode = '22023';
    end if;

    v_pickup_location_id := null;
    if v_fulfillment_mode = 'pickup' then
      begin
        v_pickup_location_id := (v_group ->> 'pickup_location_id')::uuid;
      exception when others then
        raise exception 'pickup location required' using errcode = '22023';
      end;
      select * into v_pickup_location
      from public.logistics_pickup_locations l
      where l.id = v_pickup_location_id and l.supplier_id = v_supplier.id and l.is_active
      for share;
      if not found then
        raise exception 'pickup location unavailable' using errcode = '22023';
      end if;
    elsif nullif(v_group ->> 'pickup_location_id', '') is not null then
      raise exception 'delivery group cannot select pickup location' using errcode = '22023';
    end if;

    insert into public.logistics_quote_groups (
      quote_id, supplier_id, supplier_code_snapshot, fulfillment_mode, pickup_location_id
    ) values (
      v_quote_id, v_supplier.id, v_supplier.code, v_fulfillment_mode, v_pickup_location_id
    ) returning id into v_group_id;

    insert into public.logistics_quote_events (
      quote_id, quote_group_id, actor_id, actor_type, event_type,
      from_status, to_status, payload
    ) values (
      v_quote_id, v_group_id, p_user_id, 'customer', 'group_created',
      null, 'awaiting_quote', jsonb_build_object(
        'supplier_code', v_supplier.code, 'fulfillment_mode', v_fulfillment_mode
      )
    );

    for v_item in select value from jsonb_array_elements(v_group -> 'items')
    loop
      begin
        v_variant_id := (v_item ->> 'variant_id')::uuid;
        v_quantity := (v_item ->> 'quantity')::integer;
      exception when others then
        raise exception 'invalid quote item' using errcode = '22023';
      end;
      if v_quantity is null or v_quantity < 1 or v_quantity > 99 then
        raise exception 'invalid quote quantity' using errcode = '22023';
      end if;
      select p.id, p.name, p.slug, p.supplier_id,
        v.sku, v.fabric, v.color, v.width_mm, v.depth_mm, v.height_mm,
        v.attributes, v.price_cents, ci.quantity as cart_quantity,
        i.on_hand - i.reserved as available_quantity
      into v_product
      from public.carts ca
      join public.cart_items ci on ci.cart_id = ca.id
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
      join public.inventory i on i.variant_id = v.id
      where ca.user_id = p_user_id
        and v.id = v_variant_id
        and p.supplier_id = v_supplier.id
        and p.status = 'active' and c.is_active
        and v.is_active and nullif(trim(v.sku), '') is not null
        and v.price_cents > 0
        and ci.quantity >= v_quantity
        and i.on_hand - i.reserved >= v_quantity;
      if not found then
        raise exception 'item not eligible for logistics quote' using errcode = '22023';
      end if;

      insert into public.logistics_quote_items (
        quote_group_id, product_id, variant_id, quantity,
        product_name_snapshot, product_slug_snapshot, variant_snapshot,
        unit_price_cents_snapshot
      ) values (
        v_group_id, v_product.id, v_variant_id, v_quantity,
        v_product.name, v_product.slug,
        jsonb_strip_nulls(jsonb_build_object(
          'sku', v_product.sku, 'fabric', v_product.fabric, 'color', v_product.color,
          'width_mm', v_product.width_mm, 'depth_mm', v_product.depth_mm,
          'height_mm', v_product.height_mm, 'attributes', v_product.attributes
        )),
        v_product.price_cents
      );
    end loop;
  end loop;

  insert into public.logistics_quote_events (
    quote_id, actor_id, actor_type, event_type, from_status, to_status, payload
  ) values (
    v_quote_id, p_user_id, 'customer', 'quote_created', null, 'awaiting_quote',
    jsonb_build_object('group_count', jsonb_array_length(p_supplier_modes), 'floor_charge_cents', v_floor_charge)
  );

  return v_quote_id;
end;
$$;

revoke all on function public.logistics_create_quote_server(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.logistics_create_quote_server(uuid, uuid, jsonb, jsonb) to service_role;

comment on function public.logistics_create_quote_server(uuid, uuid, jsonb, jsonb) is
  'Privileged server-only creation boundary. EXECUTE is granted only to service_role. Call only after server-side auth.getUser() and ViaCEP verification; derive p_user_id and p_address server-side. With sb_secret, send the key only in apikey, never as an Authorization bearer token; the key is not a JWT and auth.jwt() is not checked.';

create function public.customer_list_my_logistics_quotes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'quote_id', q.id,
    'status', q.status,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'quote_expires_at', q.quote_expires_at,
    'city_name', q.delivery_city_name_snapshot,
    'floor_charge_cents', q.floor_charge_cents,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'status', e.to_status,
        'timestamp', e.occurred_at,
        'actor_type', e.actor_type
      ) order by e.occurred_at, e.id)
      from public.logistics_quote_events e where e.quote_id = q.id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplier_code', g.supplier_code_snapshot,
        'fulfillment_mode', g.fulfillment_mode,
        'status', g.status,
        'base_freight_cents', g.base_freight_cents
      ) order by g.supplier_code_snapshot)
      from public.logistics_quote_groups g where g.quote_id = q.id
    ), '[]'::jsonb)
  ) order by q.created_at desc, q.id), '[]'::jsonb)
  into v_result
  from public.logistics_quotes q
  where q.customer_id = v_user_id;

  return v_result;
end;
$$;

create function public.customer_get_logistics_quote(p_quote_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'quote_id', q.id,
    'status', q.status,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'quote_expires_at', q.quote_expires_at,
    'customer_responded_at', q.customer_responded_at,
    'address', case when q.delivery_ibge_code is null then null else jsonb_build_object(
      'postal_code', q.delivery_postal_code,
      'street', q.delivery_street,
      'number', q.delivery_number,
      'complement', q.delivery_complement,
      'neighborhood', q.delivery_neighborhood,
      'ibge_code', q.delivery_ibge_code,
      'city_name', q.delivery_city_name_snapshot,
      'state_code', q.delivery_state_code,
      'floor_number', q.delivery_floor_number
    ) end,
    'floor_charge_cents', q.floor_charge_cents,
    'floor_charge_rule', jsonb_build_object(
      'included_through_floor', q.included_through_floor_snapshot,
      'per_floor_cents', q.floor_charge_per_floor_cents_snapshot,
      'applied_once_per_quote_address', true
    ),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplier_code', g.supplier_code_snapshot,
        'fulfillment_mode', g.fulfillment_mode,
        'pickup_location_id', g.pickup_location_id,
        'status', g.status,
        'base_freight_cents', g.base_freight_cents,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_id', i.product_id,
            'variant_id', i.variant_id,
            'quantity', i.quantity,
            'product_name', i.product_name_snapshot,
            'product_slug', i.product_slug_snapshot,
            'variant', i.variant_snapshot,
            'unit_price_cents_snapshot', i.unit_price_cents_snapshot
          ) order by i.product_name_snapshot, i.id)
          from public.logistics_quote_items i where i.quote_group_id = g.id
        ), '[]'::jsonb)
      ) order by g.supplier_code_snapshot)
      from public.logistics_quote_groups g where g.quote_id = q.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'occurred_at', e.occurred_at,
        'payload', e.payload
      ) order by e.occurred_at, e.id)
      from public.logistics_quote_events e where e.quote_id = q.id
    ), '[]'::jsonb)
  ) into v_result
  from public.logistics_quotes q
  where q.id = p_quote_id and q.customer_id = v_user_id;

  return v_result;
end;
$$;

create function public.customer_respond_logistics_quote(
  p_quote_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.logistics_quotes%rowtype;
  v_new_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_accept is null then
    raise exception 'response required' using errcode = '22023';
  end if;

  select * into v_quote
  from public.logistics_quotes q
  where q.id = p_quote_id and q.customer_id = v_user_id
  for update;
  if not found then
    raise exception 'quote not found' using errcode = '42501';
  end if;
  if v_quote.status <> 'quoted' then
    raise exception 'quote is not awaiting customer response' using errcode = '22023';
  end if;

  if v_quote.quote_expires_at is not null and v_quote.quote_expires_at <= now() then
    update public.logistics_quotes
    set status = 'expired', updated_at = now()
    where id = p_quote_id;
    update public.logistics_quote_groups
    set status = 'invalidated', updated_at = now()
    where quote_id = p_quote_id and status = 'quoted';
    insert into public.logistics_quote_events (
      quote_id, actor_id, actor_type, event_type, from_status, to_status
    ) values (p_quote_id, v_user_id, 'customer', 'quote_expired', 'quoted', 'expired');
    return jsonb_build_object('quote_id', p_quote_id, 'status', 'expired', 'quote_expires_at', v_quote.quote_expires_at);
  end if;

  v_new_status := case when p_accept then 'accepted' else 'rejected' end;
  update public.logistics_quotes
  set status = v_new_status, customer_responded_at = now(), updated_at = now()
  where id = p_quote_id;
  insert into public.logistics_quote_events (
    quote_id, actor_id, actor_type, event_type, from_status, to_status
  ) values (
    p_quote_id, v_user_id, 'customer',
    case when p_accept then 'customer_accepted' else 'customer_rejected' end,
    'quoted', v_new_status
  );

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'status', v_new_status,
    'quote_expires_at', v_quote.quote_expires_at
  );
end;
$$;

create function public.customer_cancel_logistics_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_old_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select q.status into v_old_status
  from public.logistics_quotes q
  where q.id = p_quote_id and q.customer_id = v_user_id
  for update;
  if not found then
    raise exception 'quote not found' using errcode = '42501';
  end if;
  if v_old_status not in ('awaiting_quote', 'quoted') then
    raise exception 'quote cannot be cancelled in its current state' using errcode = '22023';
  end if;

  update public.logistics_quote_groups
  set status = 'cancelled', updated_at = now()
  where quote_id = p_quote_id and status in ('awaiting_quote', 'quoted');
  update public.logistics_quotes
  set status = 'cancelled', updated_at = now()
  where id = p_quote_id;
  insert into public.logistics_quote_events (
    quote_id, actor_id, actor_type, event_type, from_status, to_status
  ) values (p_quote_id, v_user_id, 'customer', 'customer_cancelled', v_old_status, 'cancelled');

  return jsonb_build_object('quote_id', p_quote_id, 'status', 'cancelled');
end;
$$;

revoke all on function public.customer_list_my_logistics_quotes() from public, anon, authenticated, service_role;
grant execute on function public.customer_list_my_logistics_quotes() to authenticated;
revoke all on function public.customer_get_logistics_quote(uuid) from public, anon, authenticated, service_role;
grant execute on function public.customer_get_logistics_quote(uuid) to authenticated;
revoke all on function public.customer_respond_logistics_quote(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.customer_respond_logistics_quote(uuid, boolean) to authenticated;
revoke all on function public.customer_cancel_logistics_quote(uuid) from public, anon, authenticated, service_role;
grant execute on function public.customer_cancel_logistics_quote(uuid) to authenticated;

-- Admin read models. These expose only the columns required by the logistics
-- workspace and always verify the existing explicit catalog-admin membership.
create function public.admin_logistics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'supplier_count', (select count(*) from public.logistics_suppliers),
    'active_supplier_count', (select count(*) from public.logistics_suppliers where is_active),
    'product_count', (select count(*) from public.products),
    'unassigned_product_count', (select count(*) from public.products where supplier_id is null),
    'enabled_area_count', (select count(*) from public.logistics_areas where is_enabled),
    'quote_counts', coalesce((
      select jsonb_object_agg(s.status, s.total order by s.status)
      from (
        select q.status, count(*) as total
        from public.logistics_quotes q group by q.status
      ) s
    ), '{}'::jsonb),
    'open_quote_count', (
      select count(*) from public.logistics_quotes q
      where q.status in ('awaiting_quote', 'quoted')
    ),
    'settings', (
      select jsonb_build_object(
        'floor_charge_cents', cfg.floor_charge_cents,
        'included_through_floor', cfg.included_through_floor,
        'quote_expiration_minutes', cfg.quote_expiration_minutes,
        'whatsapp_phone_e164', cfg.whatsapp_phone_e164,
        'multi_delivery_policy_status', cfg.multi_delivery_policy_status
      ) from public.logistics_settings cfg where cfg.singleton
    )
  );
end;
$$;

create function public.admin_list_logistics_suppliers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'supplier_id', s.id,
    'code', s.code,
    'display_name', s.display_name,
    'is_active', s.is_active,
    'allows_delivery', s.allows_delivery,
    'allows_pickup', s.allows_pickup,
    'lead_min_business_days', s.lead_min_business_days,
    'lead_max_business_days', s.lead_max_business_days,
    'lead_time_starts_on', s.lead_time_starts_on,
    'delivery_quote_required', s.delivery_quote_required,
    'admin_notes', s.admin_notes,
    'assigned_product_count', (select count(*) from public.products p where p.supplier_id = s.id),
    'pickup_locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pickup_location_id', l.id,
        'location_code', l.location_code,
        'display_name', l.display_name,
        'street', l.street,
        'street_number', l.street_number,
        'neighborhood', l.neighborhood,
        'postal_code', l.postal_code,
        'ibge_code', l.ibge_code,
        'city_name', a.city_name,
        'state_code', l.state_code,
        'is_active', l.is_active
      ) order by l.display_name)
      from public.logistics_pickup_locations l
      join public.logistics_areas a on a.ibge_code = l.ibge_code
      where l.supplier_id = s.id
    ), '[]'::jsonb)
  ) order by s.code), '[]'::jsonb)
  into v_result
  from public.logistics_suppliers s;
  return v_result;
end;
$$;

create function public.admin_list_logistics_products(p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_query text := nullif(trim(p_query), '');
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'name', p.name,
    'slug', p.slug,
    'status', p.status,
    'category_id', p.category_id,
    'category_name', c.name,
    'supplier_id', p.supplier_id,
    'supplier_code', s.code,
    'supplier_name', s.display_name,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'variant_id', v.id,
        'sku', v.sku,
        'fabric', v.fabric,
        'color', v.color,
        'width_mm', v.width_mm,
        'depth_mm', v.depth_mm,
        'height_mm', v.height_mm,
        'attributes', v.attributes,
        'price_cents', v.price_cents,
        'is_active', v.is_active,
        'on_hand', i.on_hand,
        'reserved', i.reserved,
        'low_stock_threshold', i.low_stock_threshold
      ) order by v.created_at, v.id)
      from public.product_variants v
      left join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id
    ), '[]'::jsonb)
  ) order by p.name, p.id), '[]'::jsonb)
  into v_result
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.logistics_suppliers s on s.id = p.supplier_id
  where v_query is null
    or p.name ilike '%' || v_query || '%'
    or p.slug ilike '%' || v_query || '%'
    or exists (
      select 1 from public.product_variants v
      where v.product_id = p.id and v.sku ilike '%' || v_query || '%'
    )
    or s.code ilike '%' || v_query || '%';
  return v_result;
end;
$$;

create function public.admin_list_logistics_areas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ibge_code', a.ibge_code,
    'city_name', a.city_name,
    'state_code', a.state_code,
    'is_enabled', a.is_enabled,
    'source', a.source,
    'pickup_location_count', (
      select count(*) from public.logistics_pickup_locations l
      where l.ibge_code = a.ibge_code and l.is_active
    )
  ) order by a.city_name), '[]'::jsonb)
  into v_result
  from public.logistics_areas a;
  return v_result;
end;
$$;

create function public.admin_list_logistics_quotes(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_filter text := nullif(trim(p_status), '');
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_filter is not null and v_filter not in (
    'awaiting_quote', 'quoted', 'accepted', 'rejected', 'cancelled', 'invalidated', 'expired'
  ) then
    raise exception 'invalid quote status' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'quote_id', q.id,
    'customer_id', q.customer_id,
    'status', q.status,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'quote_expires_at', q.quote_expires_at,
    'delivery_address', case when q.delivery_ibge_code is null then null else jsonb_build_object(
      'postal_code', q.delivery_postal_code,
      'street', q.delivery_street,
      'number', q.delivery_number,
      'complement', q.delivery_complement,
      'neighborhood', q.delivery_neighborhood,
      'ibge_code', q.delivery_ibge_code,
      'city_name', q.delivery_city_name_snapshot,
      'state_code', q.delivery_state_code,
      'floor_number', q.delivery_floor_number
    ) end,
    'floor_charge_cents', q.floor_charge_cents,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'status', e.to_status,
        'timestamp', e.occurred_at,
        'actor_type', e.actor_type
      ) order by e.occurred_at, e.id)
      from public.logistics_quote_events e where e.quote_id = q.id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'group_id', g.id,
        'supplier_id', g.supplier_id,
        'supplier_code', g.supplier_code_snapshot,
        'fulfillment_mode', g.fulfillment_mode,
        'pickup_location_id', g.pickup_location_id,
        'status', g.status,
        'base_freight_cents', g.base_freight_cents,
        'quoted_by', g.quoted_by,
        'quoted_at', g.quoted_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_id', i.product_id,
            'variant_id', i.variant_id,
            'quantity', i.quantity,
            'product_name', i.product_name_snapshot,
            'product_slug', i.product_slug_snapshot,
            'variant', i.variant_snapshot,
            'unit_price_cents_snapshot', i.unit_price_cents_snapshot
          ) order by i.product_name_snapshot, i.id)
          from public.logistics_quote_items i where i.quote_group_id = g.id
        ), '[]'::jsonb)
      ) order by g.supplier_code_snapshot)
      from public.logistics_quote_groups g where g.quote_id = q.id
    ), '[]'::jsonb)
  ) order by q.created_at desc, q.id), '[]'::jsonb)
  into v_result
  from public.logistics_quotes q
  where v_filter is null or q.status = v_filter;
  return v_result;
end;
$$;

create function public.admin_assign_product_supplier(
  p_product_id uuid,
  p_supplier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_supplier public.logistics_suppliers%rowtype;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_product_id is null then
    raise exception 'product id required' using errcode = '22023';
  end if;
  if p_supplier_id is not null then
    select * into v_supplier from public.logistics_suppliers s
    where s.id = p_supplier_id;
    if not found then
      raise exception 'supplier not found' using errcode = '22023';
    end if;
  end if;

  select * into v_product from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if v_product.supplier_id is distinct from p_supplier_id then
    update public.products p set supplier_id = p_supplier_id, updated_at = now()
    where p.id = p_product_id;
    insert into public.logistics_admin_events (
      actor_id, entity_type, entity_key, event_type, before_state, after_state
    ) values (
      (select auth.uid()), 'product', p_product_id::text, 'supplier_assigned',
      jsonb_build_object('supplier_id', v_product.supplier_id),
      jsonb_build_object('supplier_id', p_supplier_id)
    );
  end if;
  return jsonb_build_object(
    'product_id', p_product_id,
    'supplier_id', p_supplier_id,
    'supplier_code', v_supplier.code
  );
end;
$$;

create function public.admin_set_logistics_area(
  p_ibge_code text,
  p_city_name text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area public.logistics_areas%rowtype;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_ibge_code is null or p_city_name is null or p_enabled is null then
    raise exception 'IBGE code, city and enabled state are required' using errcode = '22023';
  end if;

  select * into v_area from public.logistics_areas a
  where a.ibge_code = p_ibge_code and a.city_name = p_city_name
  for update;
  if not found then
    raise exception 'city is not in the approved logistics area set' using errcode = '22023';
  end if;
  if v_area.is_enabled is distinct from p_enabled then
    update public.logistics_areas a set is_enabled = p_enabled, updated_at = now()
    where a.ibge_code = p_ibge_code;
    insert into public.logistics_admin_events (
      actor_id, entity_type, entity_key, event_type, before_state, after_state
    ) values (
      (select auth.uid()), 'area', p_ibge_code, 'area_enabled_changed',
      jsonb_build_object('city_name', v_area.city_name, 'is_enabled', v_area.is_enabled),
      jsonb_build_object('city_name', v_area.city_name, 'is_enabled', p_enabled)
    );
    if v_area.is_enabled and not p_enabled then
      perform private.invalidate_open_logistics_quotes(null, 'area_disabled', null, p_ibge_code);
    end if;
  end if;
  return jsonb_build_object(
    'ibge_code', v_area.ibge_code,
    'city_name', v_area.city_name,
    'state_code', v_area.state_code,
    'is_enabled', p_enabled
  );
end;
$$;

create function public.admin_update_logistics_settings(
  p_floor_charge_cents integer,
  p_included_through_floor integer,
  p_quote_expiration_minutes integer,
  p_whatsapp_phone_e164 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.logistics_settings%rowtype;
  v_after public.logistics_settings%rowtype;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_floor_charge_cents is null or p_floor_charge_cents < 0
    or p_included_through_floor is null or p_included_through_floor < 0
    or (p_quote_expiration_minutes is not null and p_quote_expiration_minutes < 1)
    or (p_whatsapp_phone_e164 is not null and p_whatsapp_phone_e164 !~ '^\+[1-9][0-9]{7,14}$') then
    raise exception 'invalid logistics settings' using errcode = '22023';
  end if;

  select * into strict v_before from public.logistics_settings cfg
  where cfg.singleton for update;
  update public.logistics_settings cfg set
    floor_charge_cents = p_floor_charge_cents,
    included_through_floor = p_included_through_floor,
    quote_expiration_minutes = p_quote_expiration_minutes,
    whatsapp_phone_e164 = p_whatsapp_phone_e164,
    updated_at = now(),
    updated_by = (select auth.uid())
  where cfg.singleton
  returning * into v_after;

  if v_before.floor_charge_cents is distinct from v_after.floor_charge_cents
    or v_before.included_through_floor is distinct from v_after.included_through_floor then
    perform private.invalidate_open_logistics_quotes(null, 'delivery_terms_changed');
  end if;
  if v_before.quote_expiration_minutes is distinct from v_after.quote_expiration_minutes then
    perform private.invalidate_open_logistics_quotes(null, 'quote_expiry_changed');
  end if;

  insert into public.logistics_admin_events (
    actor_id, entity_type, entity_key, event_type, before_state, after_state
  ) values (
    (select auth.uid()), 'settings', 'singleton', 'logistics_settings_updated',
    jsonb_build_object(
      'floor_charge_cents', v_before.floor_charge_cents,
      'included_through_floor', v_before.included_through_floor,
      'quote_expiration_minutes', v_before.quote_expiration_minutes,
      'whatsapp_phone_e164', v_before.whatsapp_phone_e164
    ),
    jsonb_build_object(
      'floor_charge_cents', v_after.floor_charge_cents,
      'included_through_floor', v_after.included_through_floor,
      'quote_expiration_minutes', v_after.quote_expiration_minutes,
      'whatsapp_phone_e164', v_after.whatsapp_phone_e164
    )
  );
  return jsonb_build_object(
    'floor_charge_cents', v_after.floor_charge_cents,
    'included_through_floor', v_after.included_through_floor,
    'quote_expiration_minutes', v_after.quote_expiration_minutes,
    'whatsapp_phone_e164', v_after.whatsapp_phone_e164,
    'multi_delivery_policy_status', v_after.multi_delivery_policy_status
  );
end;
$$;

create function public.admin_update_logistics_supplier(
  p_supplier_id uuid,
  p_display_name text,
  p_is_active boolean,
  p_allows_delivery boolean,
  p_allows_pickup boolean,
  p_lead_min_business_days integer,
  p_lead_max_business_days integer,
  p_delivery_quote_required boolean,
  p_admin_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.logistics_suppliers%rowtype;
  v_after public.logistics_suppliers%rowtype;
  v_configuration_changed boolean;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_supplier_id is null
    or p_display_name is null
    or char_length(trim(p_display_name)) not between 1 and 80
    or p_is_active is null
    or p_allows_delivery is null
    or p_allows_pickup is null
    or p_lead_min_business_days is null or p_lead_min_business_days < 0
    or p_lead_max_business_days is null or p_lead_max_business_days < p_lead_min_business_days
    or p_delivery_quote_required is null
    or (p_allows_delivery and not p_delivery_quote_required) then
    raise exception 'invalid supplier configuration' using errcode = '22023';
  end if;

  select * into v_before from public.logistics_suppliers s
  where s.id = p_supplier_id for update;
  if not found then
    raise exception 'supplier not found' using errcode = 'P0002';
  end if;
  if v_before.code = 'MUNDIAL' and p_allows_pickup then
    raise exception 'MUNDIAL is delivery-only' using errcode = '22023';
  end if;
  v_configuration_changed :=
    v_before.display_name is distinct from trim(p_display_name)
    or v_before.is_active is distinct from p_is_active
    or v_before.allows_delivery is distinct from p_allows_delivery
    or v_before.allows_pickup is distinct from p_allows_pickup
    or v_before.lead_min_business_days is distinct from p_lead_min_business_days
    or v_before.lead_max_business_days is distinct from p_lead_max_business_days
    or v_before.delivery_quote_required is distinct from p_delivery_quote_required
    or v_before.admin_notes is distinct from p_admin_notes;

  update public.logistics_suppliers s set
    display_name = trim(p_display_name),
    is_active = p_is_active,
    allows_delivery = p_allows_delivery,
    allows_pickup = p_allows_pickup,
    lead_min_business_days = p_lead_min_business_days,
    lead_max_business_days = p_lead_max_business_days,
    delivery_quote_required = p_delivery_quote_required,
    admin_notes = p_admin_notes,
    updated_at = now()
  where s.id = p_supplier_id
  returning * into v_after;

  insert into public.logistics_admin_events (
    actor_id, entity_type, entity_key, event_type, before_state, after_state
  ) values (
    (select auth.uid()), 'supplier', p_supplier_id::text, 'supplier_configuration_updated',
    jsonb_build_object(
      'display_name', v_before.display_name,
      'is_active', v_before.is_active,
      'allows_delivery', v_before.allows_delivery,
      'allows_pickup', v_before.allows_pickup,
      'lead_min_business_days', v_before.lead_min_business_days,
      'lead_max_business_days', v_before.lead_max_business_days,
      'delivery_quote_required', v_before.delivery_quote_required,
      'admin_notes', v_before.admin_notes
    ),
    jsonb_build_object(
      'display_name', v_after.display_name,
      'is_active', v_after.is_active,
      'allows_delivery', v_after.allows_delivery,
      'allows_pickup', v_after.allows_pickup,
      'lead_min_business_days', v_after.lead_min_business_days,
      'lead_max_business_days', v_after.lead_max_business_days,
      'delivery_quote_required', v_after.delivery_quote_required,
      'admin_notes', v_after.admin_notes
    )
  );
  if v_configuration_changed then
    perform private.invalidate_open_logistics_quotes(
      null, 'supplier_changed', null, null, p_supplier_id, null
    );
  end if;
  return jsonb_build_object(
    'supplier_id', v_after.id,
    'code', v_after.code,
    'display_name', v_after.display_name,
    'is_active', v_after.is_active,
    'allows_delivery', v_after.allows_delivery,
    'allows_pickup', v_after.allows_pickup,
    'lead_min_business_days', v_after.lead_min_business_days,
    'lead_max_business_days', v_after.lead_max_business_days,
    'delivery_quote_required', v_after.delivery_quote_required,
    'admin_notes', v_after.admin_notes
  );
end;
$$;

-- Pickup records are created and edited only from explicit admin-entered
-- address fields. Municipality metadata is derived from the existing allowlist;
-- this RPC never creates a city or address automatically.
create function public.admin_save_logistics_pickup_location(
  p_pickup_location_id uuid,
  p_supplier_id uuid,
  p_location_code text,
  p_display_name text,
  p_street text,
  p_street_number text,
  p_neighborhood text,
  p_postal_code text,
  p_ibge_code text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.logistics_pickup_locations%rowtype;
  v_after public.logistics_pickup_locations%rowtype;
  v_supplier public.logistics_suppliers%rowtype;
  v_area public.logistics_areas%rowtype;
  v_location_code text := upper(trim(coalesce(p_location_code, '')));
  v_postal_code text;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_supplier_id is null or p_is_active is null
    or v_location_code !~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'
    or p_display_name is null or char_length(trim(p_display_name)) not between 1 and 120
    or p_street is null or char_length(trim(p_street)) not between 1 and 160
    or p_street_number is null or char_length(trim(p_street_number)) not between 1 and 40
    or p_neighborhood is null or char_length(trim(p_neighborhood)) not between 1 and 120
    or p_postal_code is null or trim(p_postal_code) !~ '^[0-9]{5}-?[0-9]{3}$'
    or p_ibge_code is null or trim(p_ibge_code) !~ '^[0-9]{7}$' then
    raise exception 'invalid pickup location fields' using errcode = '22023';
  end if;
  v_postal_code := substr(replace(trim(p_postal_code), '-', ''), 1, 5)
    || '-' || substr(replace(trim(p_postal_code), '-', ''), 6, 3);

  select * into v_supplier from public.logistics_suppliers s
  where s.id = p_supplier_id for update;
  if not found then
    raise exception 'supplier not found' using errcode = '22023';
  end if;
  select * into v_area from public.logistics_areas a
  where a.ibge_code = trim(p_ibge_code);
  if not found then
    raise exception 'municipality is not in the approved logistics area set' using errcode = '22023';
  end if;

  if p_pickup_location_id is null then
    if not v_supplier.allows_pickup then
      raise exception 'supplier does not allow pickup' using errcode = '22023';
    end if;
    if p_is_active and not v_supplier.is_active then
      raise exception 'active pickup requires an active supplier' using errcode = '22023';
    end if;
    insert into public.logistics_pickup_locations (
      supplier_id, location_code, display_name, street, street_number,
      neighborhood, postal_code, ibge_code, state_code, is_active
    ) values (
      p_supplier_id, v_location_code, trim(p_display_name), trim(p_street),
      trim(p_street_number), trim(p_neighborhood), v_postal_code,
      v_area.ibge_code, v_area.state_code, p_is_active
    ) returning * into v_after;
    insert into public.logistics_admin_events (
      actor_id, entity_type, entity_key, event_type, before_state, after_state
    ) values (
      (select auth.uid()), 'pickup_location', v_after.id::text, 'pickup_location_created', '{}'::jsonb,
      jsonb_build_object(
        'supplier_id', v_after.supplier_id, 'location_code', v_after.location_code,
        'display_name', v_after.display_name, 'street', v_after.street,
        'street_number', v_after.street_number, 'neighborhood', v_after.neighborhood,
        'postal_code', v_after.postal_code, 'ibge_code', v_after.ibge_code,
        'is_active', v_after.is_active
      )
    );
  else
    select * into v_before from public.logistics_pickup_locations l
    where l.id = p_pickup_location_id for update;
    if not found then
      raise exception 'pickup location not found' using errcode = 'P0002';
    end if;
    if v_before.supplier_id <> p_supplier_id then
      raise exception 'pickup location supplier is immutable' using errcode = '22023';
    end if;
    if p_is_active and (not v_supplier.is_active or not v_supplier.allows_pickup) then
      raise exception 'active pickup requires an active pickup-enabled supplier' using errcode = '22023';
    end if;
    update public.logistics_pickup_locations l set
      location_code = v_location_code,
      display_name = trim(p_display_name),
      street = trim(p_street),
      street_number = trim(p_street_number),
      neighborhood = trim(p_neighborhood),
      postal_code = v_postal_code,
      ibge_code = v_area.ibge_code,
      state_code = v_area.state_code,
      is_active = p_is_active,
      updated_at = now()
    where l.id = p_pickup_location_id
    returning * into v_after;
    insert into public.logistics_admin_events (
      actor_id, entity_type, entity_key, event_type, before_state, after_state
    ) values (
      (select auth.uid()), 'pickup_location', v_after.id::text, 'pickup_location_updated',
      jsonb_build_object(
        'supplier_id', v_before.supplier_id, 'location_code', v_before.location_code,
        'display_name', v_before.display_name, 'street', v_before.street,
        'street_number', v_before.street_number, 'neighborhood', v_before.neighborhood,
        'postal_code', v_before.postal_code, 'ibge_code', v_before.ibge_code,
        'is_active', v_before.is_active
      ),
      jsonb_build_object(
        'supplier_id', v_after.supplier_id, 'location_code', v_after.location_code,
        'display_name', v_after.display_name, 'street', v_after.street,
        'street_number', v_after.street_number, 'neighborhood', v_after.neighborhood,
        'postal_code', v_after.postal_code, 'ibge_code', v_after.ibge_code,
        'is_active', v_after.is_active
      )
    );
    perform private.invalidate_open_logistics_quotes(
      null, 'pickup_location_changed', null, null, null, p_pickup_location_id
    );
  end if;

  return jsonb_build_object(
    'pickup_location_id', v_after.id,
    'supplier_id', v_after.supplier_id,
    'supplier_code', v_supplier.code,
    'location_code', v_after.location_code,
    'display_name', v_after.display_name,
    'street', v_after.street,
    'street_number', v_after.street_number,
    'neighborhood', v_after.neighborhood,
    'postal_code', v_after.postal_code,
    'ibge_code', v_after.ibge_code,
    'city_name', v_area.city_name,
    'state_code', v_area.state_code,
    'is_active', v_after.is_active
  );
end;
$$;

create function public.admin_set_logistics_group_freight(
  p_quote_id uuid,
  p_supplier_code text,
  p_base_freight_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.logistics_quotes%rowtype;
  v_group public.logistics_quote_groups%rowtype;
  v_next_quote_status text;
  v_expiration_minutes integer;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_quote_id is null or p_supplier_code not in ('VALE', 'MUNDIAL')
    or p_base_freight_cents is null or p_base_freight_cents < 0 then
    raise exception 'invalid group freight' using errcode = '22023';
  end if;

  select * into v_quote from public.logistics_quotes q
  where q.id = p_quote_id for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;
  if v_quote.status not in ('awaiting_quote', 'quoted') then
    raise exception 'quote is not editable' using errcode = '22023';
  end if;
  select * into v_group from public.logistics_quote_groups g
  where g.quote_id = p_quote_id and g.supplier_code_snapshot = p_supplier_code
  for update;
  if not found then
    raise exception 'supplier group not found on quote' using errcode = 'P0002';
  end if;

  update public.logistics_quote_groups g set
    status = 'quoted',
    base_freight_cents = p_base_freight_cents,
    quoted_by = (select auth.uid()),
    quoted_at = now(),
    updated_at = now()
  where g.id = v_group.id;

  select case when bool_and(g.status = 'quoted') then 'quoted' else 'awaiting_quote' end
  into v_next_quote_status
  from public.logistics_quote_groups g where g.quote_id = p_quote_id;

  if v_next_quote_status = 'quoted' then
    select cfg.quote_expiration_minutes into v_expiration_minutes
    from public.logistics_settings cfg where cfg.singleton;
    update public.logistics_quotes q set
      status = 'quoted',
      quote_expires_at = case when v_expiration_minutes is null then null
        else now() + make_interval(mins => v_expiration_minutes) end,
      updated_at = now()
    where q.id = p_quote_id;
  end if;

  insert into public.logistics_quote_events (
    quote_id, quote_group_id, actor_id, actor_type, event_type,
    from_status, to_status, payload
  ) values (
    p_quote_id, v_group.id, (select auth.uid()), 'admin',
    case when v_group.status = 'quoted' then 'group_repriced' else 'group_priced' end,
    v_group.status, 'quoted', jsonb_build_object(
      'supplier_code', v_group.supplier_code_snapshot,
      'base_freight_cents', p_base_freight_cents
    )
  );
  insert into public.logistics_admin_events (
    actor_id, entity_type, entity_key, event_type, before_state, after_state
  ) values (
    (select auth.uid()), 'quote_group', v_group.id::text, 'group_freight_set',
    jsonb_build_object('status', v_group.status, 'base_freight_cents', v_group.base_freight_cents),
    jsonb_build_object('status', 'quoted', 'base_freight_cents', p_base_freight_cents)
  );

  return jsonb_build_object(
    'quote_id', p_quote_id,
    'group_id', v_group.id,
    'supplier_code', v_group.supplier_code_snapshot,
    'group_status', 'quoted',
    'base_freight_cents', p_base_freight_cents,
    'quote_status', v_next_quote_status
  );
end;
$$;

-- RPC execution is closed by default. Admin functions are authenticated-only
-- at PostgREST and perform their own membership check; creation is server-only.
revoke all on function public.admin_logistics_overview() from public, anon, authenticated, service_role;
grant execute on function public.admin_logistics_overview() to authenticated;
revoke all on function public.admin_list_logistics_suppliers() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_logistics_suppliers() to authenticated;
revoke all on function public.admin_list_logistics_products(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_logistics_products(text) to authenticated;
revoke all on function public.admin_list_logistics_areas() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_logistics_areas() to authenticated;
revoke all on function public.admin_list_logistics_quotes(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_logistics_quotes(text) to authenticated;
revoke all on function public.admin_assign_product_supplier(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_assign_product_supplier(uuid, uuid) to authenticated;
revoke all on function public.admin_set_logistics_area(text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_logistics_area(text, text, boolean) to authenticated;
revoke all on function public.admin_update_logistics_settings(integer, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_logistics_settings(integer, integer, integer, text) to authenticated;
revoke all on function public.admin_update_logistics_supplier(uuid, text, boolean, boolean, boolean, integer, integer, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_update_logistics_supplier(uuid, text, boolean, boolean, boolean, integer, integer, boolean, text)
  to authenticated;
revoke all on function public.admin_save_logistics_pickup_location(uuid, uuid, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_save_logistics_pickup_location(uuid, uuid, text, text, text, text, text, text, text, boolean)
  to authenticated;
revoke all on function public.admin_set_logistics_group_freight(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_logistics_group_freight(uuid, text, integer) to authenticated;

comment on function public.admin_update_logistics_supplier(uuid, text, boolean, boolean, boolean, integer, integer, boolean, text) is
  'Admin-only supplier configuration with editable display_name. Supplier code is fixed and cannot be changed through this RPC; product classification remains explicit.';
comment on function public.admin_save_logistics_pickup_location(uuid, uuid, text, text, text, text, text, text, text, boolean) is
  'Admin-only manual create/update/activate/deactivate for pickup addresses. Supplier ownership is immutable on update; supplier must support pickup for activation, and IBGE municipality must already exist in logistics_areas. No address is auto-created.';
comment on function public.admin_set_logistics_group_freight(uuid, text, integer) is
  'Admin-only manual freight quote; a customer-visible quote becomes quoted only when every supplier group is priced.';
