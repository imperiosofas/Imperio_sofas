-- Orders, payments and stock reservation foundation.
--
-- Checkout never trusts the browser: the customer RPC recalculates items,
-- prices, freight and totals from the database, requires an accepted and still
-- matching delivery quote (or a pickup-only cart), and reserves stock inside
-- the same transaction. Payment results are applied by service-role-only RPCs
-- that are idempotent and verify the paid amount against the order total.
-- Nothing here charges money; a payment provider is wired in the application.

create table public.commerce_settings (
  singleton boolean primary key default true check (singleton),
  -- Kill switch: no order can be created until this is switched on.
  checkout_enabled boolean not null default false,
  -- How long reserved stock waits for payment before it is released.
  payment_window_minutes integer not null default 30
    check (payment_window_minutes between 5 and 1440),
  updated_at timestamptz not null default now()
);
insert into public.commerce_settings (singleton) values (true)
on conflict (singleton) do nothing;

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  quote_id uuid references public.logistics_quotes(id) on delete restrict,
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'paid', 'cancelled', 'expired', 'refunded', 'needs_review')
  ),
  currency text not null default 'BRL' check (currency = 'BRL'),
  items_subtotal_cents integer not null check (items_subtotal_cents > 0),
  freight_cents integer not null default 0 check (freight_cents >= 0),
  floor_charge_cents integer not null default 0 check (floor_charge_cents >= 0),
  total_cents integer not null,
  customer_email text,
  customer_name text,
  customer_phone text,
  delivery_postal_code text,
  delivery_street text,
  delivery_number text,
  delivery_complement text,
  delivery_neighborhood text,
  delivery_city text,
  delivery_state text,
  delivery_floor integer check (delivery_floor is null or delivery_floor >= 0),
  payment_expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (total_cents = items_subtotal_cents + freight_cents + floor_charge_cents)
);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index orders_pending_expiry_idx on public.orders(payment_expires_at)
  where status = 'pending_payment';
create index orders_quote_idx on public.orders(quote_id) where quote_id is not null;

create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  supplier_id uuid not null references public.logistics_suppliers(id) on delete restrict,
  supplier_code text not null,
  supplier_name text not null,
  fulfillment_mode text not null check (fulfillment_mode in ('delivery', 'pickup')),
  pickup_location_id uuid references public.logistics_pickup_locations(id) on delete restrict,
  pickup_label text,
  base_freight_cents integer not null default 0 check (base_freight_cents >= 0),
  lead_min_business_days integer,
  lead_max_business_days integer,
  lead_time_starts_on text,
  status text not null default 'awaiting_payment' check (
    status in ('awaiting_payment', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')
  ),
  status_updated_at timestamptz not null default now(),
  unique (order_id, supplier_id),
  check ((fulfillment_mode = 'pickup') = (pickup_location_id is not null))
);
create index order_groups_supplier_idx on public.order_groups(supplier_id);
create index order_groups_pickup_idx on public.order_groups(pickup_location_id)
  where pickup_location_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_group_id uuid not null references public.order_groups(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  product_name text not null,
  product_slug text not null,
  sku text,
  variant_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(variant_snapshot) = 'object'),
  unit_price_cents integer not null check (unit_price_cents > 0),
  line_total_cents integer not null,
  unique (order_id, variant_id),
  check (line_total_cents = unit_price_cents * quantity)
);
create index order_items_group_idx on public.order_items(order_group_id);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_variant_idx on public.order_items(variant_id);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('mock', 'mercadopago')),
  status text not null default 'pending' check (
    status in ('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded')
  ),
  amount_cents integer not null check (amount_cents > 0),
  idempotency_key uuid not null,
  provider_preference_id text,
  provider_payment_id text,
  checkout_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, idempotency_key)
);
create unique index order_payments_provider_payment_idx
  on public.order_payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create unique index order_payments_one_approved_idx
  on public.order_payments(order_id) where status = 'approved';

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_type text not null check (actor_type in ('customer', 'admin', 'server', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, occurred_at, id);

-- Replay protection: a provider event id is processed once.
create table public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('mock', 'mercadopago')),
  event_id text not null,
  provider_payment_id text,
  order_id uuid references public.orders(id) on delete set null,
  outcome text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index payment_webhook_events_order_idx on public.payment_webhook_events(order_id)
  where order_id is not null;

alter table public.commerce_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_groups enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_webhook_events enable row level security;

revoke all on public.commerce_settings, public.orders, public.order_groups,
  public.order_items, public.order_payments, public.order_events,
  public.payment_webhook_events from public, anon, authenticated;
revoke all on sequence public.order_number_seq from public, anon, authenticated;

-- Customers read only their own orders. Writes happen exclusively in RPCs.
grant select on public.commerce_settings to authenticated;
grant select on public.orders, public.order_groups, public.order_items,
  public.order_payments to authenticated;

create policy "commerce settings readable" on public.commerce_settings
  for select to authenticated using (true);
create policy "customers read own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = customer_id);
create policy "customers read own order groups" on public.order_groups
  for select to authenticated using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "customers read own order items" on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "customers read own order payments" on public.order_payments
  for select to authenticated using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())));

create function private.log_order_event(
  p_order_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, actor_type, actor_id, event_type, payload)
  values (p_order_id, p_actor_type, p_actor_id, p_event_type, coalesce(p_payload, '{}'::jsonb));
$$;

-- Releases reserved stock and closes a still-unpaid order.
create function private.cancel_order(
  p_order_id uuid,
  p_new_status text,
  p_reason text,
  p_actor_type text,
  p_actor_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  if p_new_status not in ('cancelled', 'expired') then
    raise exception 'invalid closing status' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'pending_payment' then
    return false;
  end if;

  update public.inventory i
  set reserved = i.reserved - agg.qty, version = i.version + 1, updated_at = now()
  from (
    select oi.variant_id, sum(oi.quantity)::integer as qty
    from public.order_items oi where oi.order_id = p_order_id
    group by oi.variant_id
  ) agg
  where i.variant_id = agg.variant_id;

  update public.orders
  set status = p_new_status, cancelled_at = now(), cancel_reason = p_reason, updated_at = now()
  where id = p_order_id;
  update public.order_groups
  set status = 'cancelled', status_updated_at = now()
  where order_id = p_order_id;
  update public.order_payments
  set status = 'cancelled', updated_at = now()
  where order_id = p_order_id and status in ('pending', 'in_process');

  perform private.log_order_event(
    p_order_id, p_actor_type, p_actor_id, 'order_' || p_new_status,
    jsonb_build_object('reason', p_reason)
  );
  return true;
end;
$$;

-- Converts reserved stock into a sale: on_hand and reserved fall together.
create function private.consume_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory i
  set on_hand = i.on_hand - agg.qty,
      reserved = i.reserved - agg.qty,
      version = i.version + 1,
      updated_at = now()
  from (
    select oi.variant_id, sum(oi.quantity)::integer as qty
    from public.order_items oi where oi.order_id = p_order_id
    group by oi.variant_id
  ) agg
  where i.variant_id = agg.variant_id;
end;
$$;

create function public.create_checkout_order(
  p_idempotency_key uuid,
  p_quote_id uuid default null,
  p_pickup jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_settings public.commerce_settings%rowtype;
  v_logistics public.logistics_settings%rowtype;
  v_existing uuid;
  v_cart_id uuid;
  v_cart_count integer;
  v_lines jsonb;
  v_cart_snapshot jsonb;
  v_quote public.logistics_quotes%rowtype;
  v_quote_snapshot jsonb;
  v_order_id uuid;
  v_group_id uuid;
  v_group record;
  v_pickup jsonb;
  v_pickup_location public.logistics_pickup_locations%rowtype;
  v_supplier public.logistics_suppliers%rowtype;
  v_mode text;
  v_freight bigint := 0;
  v_group_freight integer;
  v_subtotal bigint := 0;
  v_floor integer := 0;
  v_delivery_groups integer := 0;
  v_total bigint;
  v_line jsonb;
  v_email text;
  v_name text;
  v_phone text;
  v_other uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select id into v_existing from public.orders
  where customer_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into strict v_settings from public.commerce_settings where singleton for share;
  if not v_settings.checkout_enabled then
    raise exception 'checkout disabled' using errcode = '55000';
  end if;
  select * into strict v_logistics from public.logistics_settings where singleton for share;

  select c.id into v_cart_id from public.carts c where c.user_id = v_user for update;
  if not found then
    raise exception 'cart empty' using errcode = '22023';
  end if;
  perform 1 from public.cart_items ci where ci.cart_id = v_cart_id order by ci.variant_id for update;
  perform 1
  from public.inventory i
  join public.cart_items ci on ci.variant_id = i.variant_id
  where ci.cart_id = v_cart_id
  order by i.variant_id
  for update of i;
  perform 1
  from public.products p
  join public.product_variants v on v.product_id = p.id
  join public.cart_items ci on ci.variant_id = v.id
  where ci.cart_id = v_cart_id
  order by p.id
  for share of p;

  select count(*) into v_cart_count from public.cart_items where cart_id = v_cart_id;
  if v_cart_count = 0 then
    raise exception 'cart empty' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', ci.variant_id,
    'quantity', ci.quantity,
    'product_id', p.id,
    'name', p.name,
    'slug', p.slug,
    'sku', v.sku,
    'price_cents', v.price_cents,
    'supplier_code', upper(s.code),
    'available', i.on_hand - i.reserved,
    'purchasable', (
      p.status = 'active' and c.is_active and v.is_active
      and v.sku is not null and v.price_cents > 0
      and p.supplier_id is not null and s.is_active
    ),
    'variant', jsonb_build_object(
      'fabric', v.fabric, 'color', v.color, 'width_mm', v.width_mm,
      'depth_mm', v.depth_mm, 'height_mm', v.height_mm, 'attributes', v.attributes
    )
  ) order by ci.variant_id), '[]'::jsonb)
  into v_lines
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  join public.categories c on c.id = p.category_id
  join public.inventory i on i.variant_id = v.id
  left join public.logistics_suppliers s on s.id = p.supplier_id
  where ci.cart_id = v_cart_id;

  if jsonb_array_length(v_lines) <> v_cart_count
    or exists (select 1 from jsonb_array_elements(v_lines) l where (l ->> 'purchasable')::boolean is not true) then
    raise exception 'cart has unavailable items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_lines) l
    where (l ->> 'available')::integer < (l ->> 'quantity')::integer
  ) then
    raise exception 'insufficient stock' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'supplier_code', l ->> 'supplier_code',
    'variant_id', (l ->> 'variant_id')::uuid,
    'quantity', (l ->> 'quantity')::integer,
    'price_cents', (l ->> 'price_cents')::integer
  ) order by l ->> 'supplier_code', (l ->> 'variant_id')::uuid)
  into v_cart_snapshot
  from jsonb_array_elements(v_lines) l;

  -- A quote is the customer's accepted contract for the delivery groups.
  if p_quote_id is not null then
    select * into v_quote from public.logistics_quotes q
    where q.id = p_quote_id and q.customer_id = v_user for update;
    if not found or v_quote.status <> 'accepted' then
      raise exception 'accepted quote required' using errcode = '22023';
    end if;
    if v_quote.quote_expires_at is not null and v_quote.quote_expires_at <= now() then
      raise exception 'quote expired' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'supplier_code', upper(g.supplier_code_snapshot),
      'variant_id', qi.variant_id,
      'quantity', qi.quantity,
      'price_cents', qi.unit_price_cents_snapshot
    ) order by upper(g.supplier_code_snapshot), qi.variant_id), '[]'::jsonb)
    into v_quote_snapshot
    from public.logistics_quote_groups g
    join public.logistics_quote_items qi on qi.quote_group_id = g.id
    where g.quote_id = v_quote.id;
    if v_quote_snapshot is distinct from v_cart_snapshot then
      raise exception 'quote does not match cart' using errcode = '22023';
    end if;
  elsif p_pickup is null or jsonb_typeof(p_pickup) is distinct from 'array' then
    raise exception 'pickup selection invalid' using errcode = '22023';
  end if;

  -- Resolve each supplier group's mode, pickup place and freight.
  for v_group in
    select distinct l ->> 'supplier_code' as supplier_code
    from jsonb_array_elements(v_lines) l order by 1
  loop
    select * into v_supplier from public.logistics_suppliers s
    where s.code = v_group.supplier_code and s.is_active for share;
    if not found then
      raise exception 'supplier unavailable' using errcode = '22023';
    end if;
    if p_quote_id is not null then
      select g.fulfillment_mode, g.pickup_location_id, g.base_freight_cents
      into v_mode, v_pickup_location.id, v_group_freight
      from public.logistics_quote_groups g
      where g.quote_id = v_quote.id and g.supplier_id = v_supplier.id;
      if not found then
        raise exception 'quote does not match cart' using errcode = '22023';
      end if;
      if v_mode = 'delivery' and v_group_freight is null then
        raise exception 'quote has an unpriced delivery group' using errcode = '22023';
      end if;
    else
      v_mode := 'pickup';
      v_group_freight := 0;
      select e into v_pickup
      from jsonb_array_elements(p_pickup) e
      where upper(trim(e ->> 'supplier_code')) = v_group.supplier_code limit 1;
      if v_pickup is null or not v_supplier.allows_pickup then
        raise exception 'delivery quote required' using errcode = '22023';
      end if;
      begin
        v_pickup_location.id := (v_pickup ->> 'pickup_location_id')::uuid;
      exception when others then
        raise exception 'pickup location required' using errcode = '22023';
      end;
    end if;
    if v_mode = 'delivery' then
      v_delivery_groups := v_delivery_groups + 1;
      v_freight := v_freight + coalesce(v_group_freight, 0);
    else
      select * into v_pickup_location from public.logistics_pickup_locations l
      where l.id = v_pickup_location.id and l.supplier_id = v_supplier.id and l.is_active for share;
      if not found then
        raise exception 'pickup location unavailable' using errcode = '22023';
      end if;
    end if;
  end loop;

  if v_delivery_groups > 1 and v_logistics.multi_delivery_policy_status = 'pending' then
    raise exception 'multi delivery policy pending' using errcode = '55000';
  end if;
  if v_delivery_groups > 0 then
    v_floor := v_quote.floor_charge_cents;
  end if;

  select coalesce(sum(((l ->> 'price_cents')::bigint) * ((l ->> 'quantity')::bigint)), 0)
  into v_subtotal from jsonb_array_elements(v_lines) l;
  v_total := v_subtotal + v_freight + v_floor;
  if v_total > 2147483647 then
    raise exception 'order total exceeds supported amount' using errcode = '22023';
  end if;

  -- Only one open order per customer holds stock at a time.
  for v_other in
    select o.id from public.orders o
    where o.customer_id = v_user and o.status = 'pending_payment' order by o.id for update
  loop
    perform private.cancel_order(v_other, 'cancelled', 'replaced_by_new_order', 'system', v_user);
  end loop;

  select u.email::text, nullif(btrim(cp.display_name), ''), cp.contact_phone
  into v_email, v_name, v_phone
  from auth.users u left join public.customer_profiles cp on cp.user_id = u.id
  where u.id = v_user;

  insert into public.orders (
    customer_id, idempotency_key, quote_id, items_subtotal_cents, freight_cents,
    floor_charge_cents, total_cents, customer_email, customer_name, customer_phone,
    delivery_postal_code, delivery_street, delivery_number, delivery_complement,
    delivery_neighborhood, delivery_city, delivery_state, delivery_floor,
    payment_expires_at
  ) values (
    v_user, p_idempotency_key, p_quote_id, v_subtotal::integer, v_freight::integer,
    v_floor, v_total::integer, v_email, v_name, v_phone,
    case when v_delivery_groups > 0 then v_quote.delivery_postal_code end,
    case when v_delivery_groups > 0 then v_quote.delivery_street end,
    case when v_delivery_groups > 0 then v_quote.delivery_number end,
    case when v_delivery_groups > 0 then v_quote.delivery_complement end,
    case when v_delivery_groups > 0 then v_quote.delivery_neighborhood end,
    case when v_delivery_groups > 0 then v_quote.delivery_city_name_snapshot end,
    case when v_delivery_groups > 0 then v_quote.delivery_state_code end,
    case when v_delivery_groups > 0 then v_quote.delivery_floor_number end,
    now() + make_interval(mins => v_settings.payment_window_minutes)
  ) returning id into v_order_id;

  for v_group in
    select distinct l ->> 'supplier_code' as supplier_code
    from jsonb_array_elements(v_lines) l order by 1
  loop
    select * into v_supplier from public.logistics_suppliers s where s.code = v_group.supplier_code;
    v_pickup_location := null;
    v_group_freight := 0;
    if p_quote_id is not null then
      select g.fulfillment_mode, g.pickup_location_id, coalesce(g.base_freight_cents, 0)
      into v_mode, v_pickup_location.id, v_group_freight
      from public.logistics_quote_groups g
      where g.quote_id = v_quote.id and g.supplier_id = v_supplier.id;
    else
      v_mode := 'pickup';
      select e into v_pickup from jsonb_array_elements(p_pickup) e
      where upper(trim(e ->> 'supplier_code')) = v_group.supplier_code limit 1;
      v_pickup_location.id := (v_pickup ->> 'pickup_location_id')::uuid;
    end if;
    if v_mode = 'pickup' then
      select * into v_pickup_location from public.logistics_pickup_locations l
      where l.id = v_pickup_location.id;
    end if;

    insert into public.order_groups (
      order_id, supplier_id, supplier_code, supplier_name, fulfillment_mode,
      pickup_location_id, pickup_label, base_freight_cents,
      lead_min_business_days, lead_max_business_days, lead_time_starts_on
    ) values (
      v_order_id, v_supplier.id, v_supplier.code, v_supplier.display_name, v_mode,
      case when v_mode = 'pickup' then v_pickup_location.id end,
      case when v_mode = 'pickup' then
        v_pickup_location.display_name || ' - ' || v_pickup_location.street || ', '
        || v_pickup_location.street_number || ' - ' || v_pickup_location.neighborhood
        || ' (CEP ' || v_pickup_location.postal_code || ')' end,
      case when v_mode = 'delivery' then v_group_freight else 0 end,
      v_supplier.lead_min_business_days, v_supplier.lead_max_business_days,
      v_supplier.lead_time_starts_on
    ) returning id into v_group_id;

    for v_line in
      select l from jsonb_array_elements(v_lines) l where l ->> 'supplier_code' = v_group.supplier_code
    loop
      insert into public.order_items (
        order_id, order_group_id, product_id, variant_id, quantity, product_name,
        product_slug, sku, variant_snapshot, unit_price_cents, line_total_cents
      ) values (
        v_order_id, v_group_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'variant_id')::uuid,
        (v_line ->> 'quantity')::integer, v_line ->> 'name', v_line ->> 'slug', v_line ->> 'sku',
        v_line -> 'variant', (v_line ->> 'price_cents')::integer,
        ((v_line ->> 'price_cents')::integer * (v_line ->> 'quantity')::integer)
      );
      update public.inventory
      set reserved = reserved + (v_line ->> 'quantity')::integer, version = version + 1, updated_at = now()
      where variant_id = (v_line ->> 'variant_id')::uuid
        and on_hand - reserved >= (v_line ->> 'quantity')::integer;
      if not found then
        raise exception 'insufficient stock' using errcode = '22023';
      end if;
    end loop;
  end loop;

  perform private.log_order_event(v_order_id, 'customer', v_user, 'order_created', jsonb_build_object(
    'total_cents', v_total, 'quote_id', p_quote_id, 'delivery_groups', v_delivery_groups));
  return v_order_id;
end;
$$;

create function public.cancel_my_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.customer_id = v_user) then
    raise exception 'order not found' using errcode = '42501';
  end if;
  return private.cancel_order(p_order_id, 'cancelled', 'customer_cancelled', 'customer', v_user);
end;
$$;

-- Service role: registers the payment attempt created at the provider.
create function public.order_register_payment(
  p_order_id uuid,
  p_provider text,
  p_idempotency_key uuid,
  p_preference_id text default null,
  p_checkout_url text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  select id into v_payment_id from public.order_payments
  where order_id = p_order_id and idempotency_key = p_idempotency_key;
  if found then
    return v_payment_id;
  end if;
  if v_order.status <> 'pending_payment' or v_order.payment_expires_at <= now() then
    raise exception 'order is not awaiting payment' using errcode = '22023';
  end if;
  insert into public.order_payments (
    order_id, provider, amount_cents, idempotency_key, provider_preference_id, checkout_url
  ) values (
    p_order_id, p_provider, v_order.total_cents, p_idempotency_key, p_preference_id, p_checkout_url
  ) returning id into v_payment_id;
  perform private.log_order_event(p_order_id, 'server', null, 'payment_started',
    jsonb_build_object('provider', p_provider, 'amount_cents', v_order.total_cents));
  return v_payment_id;
end;
$$;

-- Service role: applies one provider event. Idempotent per (provider, event).
create function public.order_apply_payment_event(
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
    if p_amount_cents is distinct from v_order.total_cents then
      update public.order_payments set status = 'in_process', updated_at = now() where id = v_payment.id;
      if v_order.status = 'pending_payment' then
        update public.orders set status = 'needs_review', updated_at = now() where id = v_order.id;
      end if;
      perform private.log_order_event(v_order.id, 'server', null, 'payment_amount_mismatch',
        jsonb_build_object('expected_cents', v_order.total_cents, 'received_cents', p_amount_cents));
      v_outcome := 'amount_mismatch';
    elsif v_order.status = 'paid' then
      v_outcome := 'already_paid';
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
        perform private.log_order_event(v_order.id, 'server', null, 'late_payment_recovered',
          jsonb_build_object('provider', p_provider));
        v_outcome := 'paid_late';
      else
        update public.orders set status = 'needs_review', updated_at = now() where id = v_order.id;
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

-- Late payment with free stock: take the units directly (no reservation exists).
create function private.consume_order_stock_late(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory i
  set on_hand = i.on_hand - agg.qty, version = i.version + 1, updated_at = now()
  from (
    select oi.variant_id, sum(oi.quantity)::integer as qty
    from public.order_items oi where oi.order_id = p_order_id group by oi.variant_id
  ) agg
  where i.variant_id = agg.variant_id;
end;
$$;

-- Service role / scheduled job: releases stock held by unpaid orders.
create function public.expire_pending_orders()
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
    if private.cancel_order(v_id, 'expired', 'payment_window_elapsed', 'system', null) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Admin read models and the one write that admins need: fulfillment progress.
create function public.admin_list_orders(p_status text default null, p_limit integer default 100)
returns table (
  id uuid,
  order_number bigint,
  status text,
  total_cents integer,
  created_at timestamptz,
  paid_at timestamptz,
  customer_name text,
  customer_email text,
  item_count integer,
  modes text
) language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select o.id, o.order_number, o.status, o.total_cents, o.created_at, o.paid_at,
    o.customer_name, o.customer_email,
    coalesce((select sum(oi.quantity)::integer from public.order_items oi where oi.order_id = o.id), 0),
    coalesce((select string_agg(distinct g.fulfillment_mode, ',') from public.order_groups g where g.order_id = o.id), '')
  from public.orders o
  where p_status is null or o.status = p_status
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

create function public.admin_get_order(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select to_jsonb(o) || jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(g) || jsonb_build_object('items', coalesce((
        select jsonb_agg(to_jsonb(oi) order by oi.product_name)
        from public.order_items oi where oi.order_group_id = g.id), '[]'::jsonb))
        order by g.supplier_code)
      from public.order_groups g where g.order_id = o.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', p.provider, 'status', p.status, 'amount_cents', p.amount_cents,
        'created_at', p.created_at, 'approved_at', p.approved_at) order by p.created_at)
      from public.order_payments p where p.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', e.event_type, 'actor_type', e.actor_type,
        'occurred_at', e.occurred_at) order by e.occurred_at, e.id)
      from public.order_events e where e.order_id = o.id), '[]'::jsonb)
  ) into v_result
  from public.orders o where o.id = p_order_id;
  return v_result;
end;
$$;

create function public.admin_set_order_group_status(p_group_id uuid, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_group public.order_groups%rowtype;
  v_order_status text;
  v_allowed boolean;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_group from public.order_groups where id = p_group_id for update;
  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  select status into v_order_status from public.orders where id = v_group.order_id for update;
  if v_order_status <> 'paid' then
    raise exception 'order is not paid' using errcode = '22023';
  end if;
  v_allowed := (v_group.status = 'preparing' and p_status = 'ready_for_pickup' and v_group.fulfillment_mode = 'pickup')
    or (v_group.status = 'preparing' and p_status = 'out_for_delivery' and v_group.fulfillment_mode = 'delivery')
    or (v_group.status in ('ready_for_pickup', 'out_for_delivery') and p_status = 'completed');
  if not v_allowed then
    raise exception 'invalid fulfillment transition' using errcode = '22023';
  end if;
  update public.order_groups set status = p_status, status_updated_at = now() where id = p_group_id;
  perform private.log_order_event(v_group.order_id, 'admin', (select auth.uid()), 'group_' || p_status,
    jsonb_build_object('supplier_code', v_group.supplier_code));
  return p_status;
end;
$$;

create function public.admin_get_orders_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'pending_payment', count(*) filter (where o.status = 'pending_payment'),
      'paid', count(*) filter (where o.status = 'paid'),
      'needs_review', count(*) filter (where o.status = 'needs_review'),
      'cancelled', count(*) filter (where o.status in ('cancelled', 'expired')),
      'refunded', count(*) filter (where o.status = 'refunded'),
      'paid_last_7_days', count(*) filter (where o.status = 'paid' and o.paid_at >= now() - interval '7 days'),
      'revenue_cents', coalesce(sum(o.total_cents) filter (where o.status = 'paid'), 0),
      'average_ticket_cents', coalesce(round(avg(o.total_cents) filter (where o.status = 'paid')), 0)::bigint
    ) from public.orders o);
end;
$$;

-- Grants: customer RPCs to authenticated, payment RPCs to the service role only.
revoke all on function public.create_checkout_order(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_checkout_order(uuid, uuid, jsonb) to authenticated;
revoke all on function public.cancel_my_order(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_my_order(uuid) to authenticated;
revoke all on function public.order_register_payment(uuid, text, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.order_register_payment(uuid, text, uuid, text, text) to service_role;
revoke all on function public.order_apply_payment_event(text, text, uuid, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.order_apply_payment_event(text, text, uuid, text, text, integer) to service_role;
revoke all on function public.expire_pending_orders() from public, anon, authenticated, service_role;
grant execute on function public.expire_pending_orders() to service_role;
revoke all on function public.admin_list_orders(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_orders(text, integer) to authenticated;
revoke all on function public.admin_get_order(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_order(uuid) to authenticated;
revoke all on function public.admin_set_order_group_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_order_group_status(uuid, text) to authenticated;
revoke all on function public.admin_get_orders_summary() from public, anon, authenticated, service_role;
grant execute on function public.admin_get_orders_summary() to authenticated;
revoke all on function private.log_order_event(uuid, text, uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.cancel_order(uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function private.consume_order_stock(uuid) from public, anon, authenticated, service_role;
revoke all on function private.consume_order_stock_late(uuid) from public, anon, authenticated, service_role;
