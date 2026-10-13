-- Catalog administration is closed by default. Only provisioned admins at AAL2
-- can read or mutate catalog tables directly through the authenticated API.
create table public.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled_at timestamptz not null default now(),
  enabled_by uuid references auth.users(id) on delete set null
);

alter table public.catalog_admins enable row level security;
revoke all on table public.catalog_admins from public, anon, authenticated;
grant select on table public.catalog_admins to authenticated;
create policy "admins can read their own membership"
  on public.catalog_admins for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1 from public.catalog_admins as ca
      where ca.user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_catalog_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_catalog_admin() to authenticated;

grant select, insert, update, delete on
  public.categories, public.products, public.product_variants,
  public.inventory, public.product_media to authenticated;

create policy "catalog admins manage categories"
  on public.categories for all to authenticated
  using ((select private.is_catalog_admin()))
  with check ((select private.is_catalog_admin()));
create policy "catalog admins manage products"
  on public.products for all to authenticated
  using ((select private.is_catalog_admin()))
  with check ((select private.is_catalog_admin()));
create policy "catalog admins manage variants"
  on public.product_variants for all to authenticated
  using ((select private.is_catalog_admin()))
  with check ((select private.is_catalog_admin()));
create policy "catalog admins manage inventory"
  on public.inventory for all to authenticated
  using ((select private.is_catalog_admin()))
  with check ((select private.is_catalog_admin()));
create policy "catalog admins manage product media"
  on public.product_media for all to authenticated
  using ((select private.is_catalog_admin()))
  with check ((select private.is_catalog_admin()));

-- Atomic product/variant editor. SECURITY INVOKER preserves table grants
-- and RLS; all arguments are untrusted and are also checked by DB constraints.
create or replace function public.admin_save_catalog_product(
  p_product jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_variant jsonb;
  v_category_id uuid;
  v_status text;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_product_id := nullif(p_product ->> 'id', '')::uuid;
  v_category_id := (p_product ->> 'category_id')::uuid;
  v_status := coalesce(p_product ->> 'status', 'draft');
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if v_product_id is null then
    insert into public.products(category_id, name, slug, description, status, free_shipping)
    values (
      v_category_id,
      p_product ->> 'name',
      p_product ->> 'slug',
      coalesce(p_product ->> 'description', ''),
      'draft',
      coalesce((p_product ->> 'free_shipping')::boolean, false)
    ) returning id into v_product_id;
  else
    update public.products
    set category_id = v_category_id,
        name = p_product ->> 'name',
        slug = p_product ->> 'slug',
        description = coalesce(p_product ->> 'description', ''),
        free_shipping = coalesce((p_product ->> 'free_shipping')::boolean, false)
    where id = v_product_id;
    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;
  end if;

  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'at_least_one_variant_required' using errcode = '22023';
  end if;
  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_variant_id := nullif(v_variant ->> 'id', '')::uuid;
    if v_variant_id is null then
      insert into public.product_variants(
        product_id, sku, fabric, color, width_mm, depth_mm, height_mm,
        price_cents, is_active
      ) values (
        v_product_id, nullif(trim(v_variant ->> 'sku'), ''),
        nullif(trim(v_variant ->> 'fabric'), ''),
        nullif(trim(v_variant ->> 'color'), ''),
        nullif(v_variant ->> 'width_mm', '')::integer,
        nullif(v_variant ->> 'depth_mm', '')::integer,
        nullif(v_variant ->> 'height_mm', '')::integer,
        nullif(v_variant ->> 'price_cents', '')::integer,
        coalesce((v_variant ->> 'is_active')::boolean, true)
      ) returning id into v_variant_id;
      insert into public.inventory(variant_id, on_hand, low_stock_threshold)
      values (
        v_variant_id,
        coalesce(nullif(v_variant ->> 'on_hand', '')::integer, 0),
        coalesce(nullif(v_variant ->> 'low_stock_threshold', '')::integer, 0)
      );
    else
      update public.product_variants
      set sku = nullif(trim(v_variant ->> 'sku'), ''),
          fabric = nullif(trim(v_variant ->> 'fabric'), ''),
          color = nullif(trim(v_variant ->> 'color'), ''),
          width_mm = nullif(v_variant ->> 'width_mm', '')::integer,
          depth_mm = nullif(v_variant ->> 'depth_mm', '')::integer,
          height_mm = nullif(v_variant ->> 'height_mm', '')::integer,
          price_cents = nullif(v_variant ->> 'price_cents', '')::integer,
          is_active = coalesce((v_variant ->> 'is_active')::boolean, false)
      where id = v_variant_id and product_id = v_product_id;
      if not found then
        raise exception 'variant_not_found' using errcode = 'P0002';
      end if;
      update public.inventory
      set on_hand = coalesce(nullif(v_variant ->> 'on_hand', '')::integer, 0),
          low_stock_threshold = coalesce(nullif(v_variant ->> 'low_stock_threshold', '')::integer, 0),
          version = version + 1
      where variant_id = v_variant_id;
    end if;
  end loop;

  if v_status = 'active' and not exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    join public.product_variants pv on pv.product_id = p.id and pv.is_active
    join public.inventory i on i.variant_id = pv.id and i.on_hand > i.reserved
    where p.id = v_product_id
      and pv.sku is not null and pv.price_cents > 0 and pv.width_mm is not null
  ) then
    raise exception 'publish_requirements_not_met'
      using errcode = '23514', hint = 'Ative a categoria e informe SKU, preço, largura e estoque disponível.';
  end if;

  if v_status = 'active' and not exists (
    select 1 from public.product_media pm
    where pm.product_id = v_product_id and length(trim(pm.alt_text)) > 0
  ) then
    raise exception 'publish_requires_media'
      using errcode = '23514', hint = 'Adicione ao menos uma imagem com texto alternativo antes de publicar.';
  end if;

  update public.products set status = v_status where id = v_product_id;
  return v_product_id;
end;
$$;
revoke all on function public.admin_save_catalog_product(jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_catalog_product(jsonb, jsonb) to authenticated;

-- The bucket remains private. Upload/removal is restricted to provisioned admins
-- and product-scoped object paths; public reads still use the published policy.
create policy "catalog admins upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalog-images'
    and name ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    and (select private.is_catalog_admin())
  );
create policy "catalog admins read product images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'catalog-images'
    and name like 'products/%'
    and (select private.is_catalog_admin())
  );
create policy "catalog admins remove product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalog-images'
    and name like 'products/%'
    and (select private.is_catalog_admin())
  );

create table private.catalog_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  occurred_at timestamptz not null default now()
);
revoke all on table private.catalog_admin_audit from public, anon, authenticated;

create or replace function private.audit_catalog_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
begin
  if tg_table_name = 'inventory' then
    v_record_id := coalesce((to_jsonb(new) ->> 'variant_id')::uuid, (to_jsonb(old) ->> 'variant_id')::uuid);
  else
    v_record_id := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
  end if;
  insert into private.catalog_admin_audit(actor_id, table_name, record_id, operation)
  values ((select auth.uid()), tg_table_name, v_record_id, tg_op);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_catalog_admin_change() from public, anon, authenticated;

create trigger categories_admin_audit after insert or update or delete on public.categories
  for each row execute function private.audit_catalog_admin_change();
create trigger products_admin_audit after insert or update or delete on public.products
  for each row execute function private.audit_catalog_admin_change();
create trigger variants_admin_audit after insert or update or delete on public.product_variants
  for each row execute function private.audit_catalog_admin_change();
create trigger inventory_admin_audit after insert or update or delete on public.inventory
  for each row execute function private.audit_catalog_admin_change();
create trigger media_admin_audit after insert or update or delete on public.product_media
  for each row execute function private.audit_catalog_admin_change();
