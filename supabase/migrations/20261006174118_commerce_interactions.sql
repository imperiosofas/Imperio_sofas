-- Customer-owned relationships. Catalog tables remain private behind projections.
create table public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index product_favorites_product_idx on public.product_favorites(product_id);
create function private.is_public_product(p_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p join public.categories c
    on c.id = p.category_id and c.is_active
    where p.id = p_product_id and p.status = 'active');
$$;
revoke execute on function private.is_public_product(uuid) from public, anon;
grant execute on function private.is_public_product(uuid) to authenticated;
alter table public.product_favorites enable row level security;
revoke all on public.product_favorites from public, anon, authenticated;
grant select, insert, delete on public.product_favorites to authenticated;
create policy "favorites are private" on public.product_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "customers favorite published products" on public.product_favorites
  for insert to authenticated with check (
    (select auth.uid()) = user_id and private.is_public_product(product_id)
  );
create policy "customers remove own favorites" on public.product_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 2000),
  display_name text not null default 'Cliente' check (length(trim(display_name)) between 1 and 80),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index product_reviews_public_idx on public.product_reviews(product_id, created_at desc)
  where status = 'published';
create trigger reviews_updated_at before update on public.product_reviews
  for each row execute function public.set_updated_at();
alter table public.product_reviews enable row level security;
revoke all on public.product_reviews from public, anon, authenticated;
grant select on public.product_reviews to anon, authenticated;
-- Writes go through narrow RPCs. Direct table UPDATE cannot restore a hidden review.
create policy "published reviews are public" on public.product_reviews
  for select to anon, authenticated using (status = 'published');
create policy "customers can read own review" on public.product_reviews
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cart_id, variant_id)
);
create index cart_items_variant_idx on public.cart_items(variant_id);
create trigger carts_updated_at before update on public.carts
  for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
revoke all on public.carts, public.cart_items from public, anon, authenticated;
grant select on public.carts, public.cart_items to authenticated;
create policy "own cart" on public.carts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own cart items" on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

-- Public projections never expose a draft, inactive variant, or zero-stock item.
create function public.get_catalog_product_detail(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
    'category_slug', c.slug,
    'variants', (
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'width_mm', v.width_mm, 'depth_mm', v.depth_mm,
        'height_mm', v.height_mm, 'fabric', v.fabric, 'color', v.color,
        'price_cents', v.price_cents, 'available', i.on_hand - i.reserved
      ) order by v.width_mm, v.id)
      from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active and v.sku is not null
        and v.price_cents > 0 and i.on_hand > i.reserved
    ),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'alt', m.alt_text,
        'variant_id', m.variant_id) order by m.position, m.id)
      from public.product_media m
      where m.product_id = p.id and (m.variant_id is null or exists (
        select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
        where v.id = m.variant_id and v.product_id = p.id and v.is_active
          and v.sku is not null and v.price_cents > 0 and i.on_hand > i.reserved
      ))
    ), '[]'::jsonb)
  )
  from public.products p join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = p_slug and p.status = 'active'
    and exists (select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.is_active and v.sku is not null and v.price_cents > 0
        and i.on_hand > i.reserved);
$$;
revoke execute on function public.get_catalog_product_detail(text) from public;
grant execute on function public.get_catalog_product_detail(text) to anon, authenticated;

create function public.get_product_review_summary(p_product_ids uuid[])
returns table(product_id uuid, review_count bigint, average_rating numeric)
language sql stable security definer set search_path = '' as $$
  select r.product_id, count(*)::bigint, round(avg(r.rating), 1)
  from public.product_reviews r join public.products p on p.id = r.product_id
  where r.status = 'published' and p.status = 'active'
    and r.product_id = any(p_product_ids)
  group by r.product_id;
$$;
revoke execute on function public.get_product_review_summary(uuid[]) from public;
grant execute on function public.get_product_review_summary(uuid[]) to anon, authenticated;

create function public.get_published_product_reviews(p_product_id uuid)
returns table(id uuid, rating smallint, comment text, display_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.comment, r.display_name, r.created_at
  from public.product_reviews r join public.products p on p.id = r.product_id
  where r.product_id = p_product_id and r.status = 'published' and p.status = 'active'
  order by r.created_at desc limit 100;
$$;
revoke execute on function public.get_published_product_reviews(uuid) from public;
grant execute on function public.get_published_product_reviews(uuid) to anon, authenticated;

create function public.save_product_review(p_product_id uuid, p_rating integer, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_name text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_rating not between 1 and 5 or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'invalid review'; end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'active') then
    raise exception 'product unavailable'; end if;
  select left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), 'Cliente'), 80)
  into v_name from auth.users where id = v_user;
  insert into public.product_reviews(product_id, user_id, rating, comment, display_name)
    values(p_product_id, v_user, p_rating, nullif(trim(p_comment), ''), v_name)
  on conflict (user_id, product_id) do update set
    rating = excluded.rating, comment = excluded.comment,
    status = case when public.product_reviews.status = 'hidden' then 'hidden' else 'published' end;
end; $$;
revoke execute on function public.save_product_review(uuid, integer, text) from public, anon;
grant execute on function public.save_product_review(uuid, integer, text) to authenticated;

create function public.delete_my_product_review(p_product_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.product_reviews where product_id = p_product_id and user_id = auth.uid();
$$;
revoke execute on function public.delete_my_product_review(uuid) from public, anon;
grant execute on function public.delete_my_product_review(uuid) to authenticated;

create function public.moderate_product_review(p_review_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_catalog_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'invalid status'; end if;
  update public.product_reviews set status = p_status where id = p_review_id;
end; $$;
revoke execute on function public.moderate_product_review(uuid, text) from public, anon;
grant execute on function public.moderate_product_review(uuid, text) to authenticated;

-- The only cart writer checks server-side catalog state and current inventory.
create function public.set_cart_item(p_variant_id uuid, p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_cart uuid; v_stock integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_quantity < 0 or p_quantity > 99 or p_quantity is null then
    raise exception 'invalid quantity'; end if;
  if p_quantity > 0 then
    select i.on_hand - i.reserved into v_stock
    from public.product_variants v
    join public.products p on p.id = v.product_id and p.status = 'active'
    join public.categories c on c.id = p.category_id and c.is_active
    join public.inventory i on i.variant_id = v.id
    where v.id = p_variant_id and v.is_active and v.sku is not null and v.price_cents > 0;
    if v_stock is null or p_quantity > v_stock then raise exception 'item unavailable'; end if;
  end if;
  insert into public.carts(user_id) values(v_user)
    on conflict (user_id) do update set updated_at = now()
    returning id into v_cart;
  if p_quantity = 0 then
    delete from public.cart_items where cart_id = v_cart and variant_id = p_variant_id;
  else
    insert into public.cart_items(cart_id, variant_id, quantity)
      values(v_cart, p_variant_id, p_quantity)
    on conflict (cart_id, variant_id) do update set quantity = excluded.quantity;
  end if;
end; $$;
revoke execute on function public.set_cart_item(uuid, integer) from public, anon;
grant execute on function public.set_cart_item(uuid, integer) to authenticated;

create function public.get_my_cart()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', ci.variant_id, 'quantity', ci.quantity,
    'product_id', p.id, 'product_slug', p.slug, 'name', p.name,
    'width_mm', v.width_mm, 'price_cents', v.price_cents,
    'available', case when p.status = 'active' and c.is_active and v.is_active
      and v.sku is not null and v.price_cents > 0 then greatest(i.on_hand-i.reserved,0)
      else 0 end,
    'storage_path', (select m.storage_path from public.product_media m
      where m.product_id = p.id and (m.variant_id is null or m.variant_id = v.id)
      order by m.position, m.id limit 1)
  ) order by ci.created_at), '[]'::jsonb)
  from public.carts ca join public.cart_items ci on ci.cart_id = ca.id
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  join public.categories c on c.id = p.category_id
  join public.inventory i on i.variant_id = v.id
  where ca.user_id = auth.uid();
$$;
revoke execute on function public.get_my_cart() from public, anon;
grant execute on function public.get_my_cart() to authenticated;
