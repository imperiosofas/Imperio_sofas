create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  position integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  free_shipping boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_status_idx on public.products(category_id, status);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text unique,
  fabric text,
  color text,
  width_mm integer check (width_mm is null or width_mm > 0),
  depth_mm integer check (depth_mm is null or depth_mm > 0),
  height_mm integer check (height_mm is null or height_mm > 0),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  price_cents integer check (price_cents is null or price_cents >= 0),
  is_active boolean not null default false,
  bling_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or (sku is not null and price_cents > 0 and width_mm is not null)),
  unique nulls not distinct (product_id, fabric, color, width_mm, depth_mm, height_mm, attributes)
);

create index product_variants_product_active_idx on public.product_variants(product_id, is_active);

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  storage_path text not null unique check (storage_path !~ '^/' and storage_path !~ '(^|/)\.\.(/|$)'),
  alt_text text not null check (length(trim(alt_text)) between 1 and 300),
  media_type text not null default 'image' check (media_type in ('image')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_media_product_position_idx on public.product_media(product_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger inventory_set_updated_at before update on public.inventory
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.product_media enable row level security;

revoke all on table public.categories, public.products, public.product_variants, public.inventory, public.product_media from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1 from storage.buckets
    where id = 'catalog-images' and public
  ) then
    raise exception 'The catalog-images bucket must remain private.';
  end if;
end;
$$;

create or replace function private.is_public_catalog_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_media as pm
    join public.products as p on p.id = pm.product_id and p.status = 'active'
    join public.categories as c on c.id = p.category_id and c.is_active
    where pm.storage_path = p_object_name
      and (
        pm.variant_id is null
        or exists (
          select 1
          from public.product_variants as pv
          join public.inventory as i on i.variant_id = pv.id
          where pv.id = pm.variant_id
            and pv.product_id = p.id
            and pv.is_active
            and pv.sku is not null
            and pv.price_cents > 0
            and i.on_hand > i.reserved
        )
      )
      and exists (
        select 1
        from public.product_variants as pv_any
        join public.inventory as i_any on i_any.variant_id = pv_any.id
        where pv_any.product_id = p.id
          and pv_any.is_active
          and pv_any.sku is not null
          and pv_any.price_cents > 0
          and i_any.on_hand > i_any.reserved
      )
  );
$$;

revoke execute on function private.is_public_catalog_media(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_public_catalog_media(text) to anon, authenticated;

create policy "published catalog images are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'catalog-images'
  and private.is_public_catalog_media(name)
);

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.get_catalog_categories()
returns table (slug text, name text, description text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.description
  from public.categories as c
  where c.is_active
  order by c.position, c.name;
$$;

create or replace function public.get_catalog_products(p_category_slug text default null, p_product_slug text default null)
returns table (
  id uuid,
  slug text,
  name text,
  category_slug text,
  description text,
  width_mm integer,
  price_cents integer,
  sellable_units integer,
  media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.slug,
    p.name,
    c.slug as category_slug,
    p.description,
    sale.width_mm,
    sale.price_cents,
    sale.sellable_units,
    coalesce(media.items, '[]'::jsonb) as media
  from public.products as p
  join public.categories as c on c.id = p.category_id and c.is_active
  join lateral (
    select
      min(pv.width_mm)::integer as width_mm,
      min(pv.price_cents)::integer as price_cents,
      sum(i.on_hand - i.reserved)::integer as sellable_units
    from public.product_variants as pv
    join public.inventory as i on i.variant_id = pv.id
    where pv.product_id = p.id
      and pv.is_active
      and pv.price_cents is not null
      and i.on_hand > i.reserved
  ) as sale on sale.sellable_units > 0
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('storage_path', pm.storage_path, 'alt', pm.alt_text)
      order by pm.position, pm.id
    ) as items
    from public.product_media as pm
    where pm.product_id = p.id
      and (pm.variant_id is null or exists (
        select 1
        from public.product_variants as pv_media
        join public.inventory as i_media on i_media.variant_id = pv_media.id
        where pv_media.id = pm.variant_id
          and pv_media.product_id = p.id
          and pv_media.is_active
          and pv_media.price_cents is not null
          and i_media.on_hand > i_media.reserved
      ))
  ) as media on true
  where p.status = 'active'
    and (p_category_slug is null or c.slug = p_category_slug)
    and (p_product_slug is null or p.slug = p_product_slug)
  order by p.name;
$$;

revoke execute on function public.get_catalog_categories() from public;
revoke execute on function public.get_catalog_products(text, text) from public;
grant execute on function public.get_catalog_categories() to anon, authenticated;
grant execute on function public.get_catalog_products(text, text) to anon, authenticated;

comment on function public.get_catalog_products(text, text) is
  'Public catalog projection. Returns only active products with active, priced variants and positive available inventory.';
