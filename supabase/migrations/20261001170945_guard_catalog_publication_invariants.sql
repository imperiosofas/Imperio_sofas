create or replace function private.guard_catalog_product_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    if not exists (
      select 1
      from public.categories c
      join public.product_variants pv on pv.product_id = new.id and pv.is_active
      join public.inventory i on i.variant_id = pv.id and i.on_hand > i.reserved
      where c.id = new.category_id and c.is_active
        and pv.sku is not null and pv.price_cents > 0 and pv.width_mm is not null
    ) then
      raise exception 'publish_requirements_not_met'
        using errcode = '23514', hint = 'Categoria ativa, variação vendável e estoque disponível são obrigatórios.';
    end if;
    if not exists (
      select 1 from public.product_media pm
      where pm.product_id = new.id and length(trim(pm.alt_text)) > 0
    ) then
      raise exception 'publish_requires_media'
        using errcode = '23514', hint = 'Adicione ao menos uma imagem com texto alternativo.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_catalog_product_publication() from public, anon, authenticated;

create trigger products_require_publication_readiness_insert
  before insert on public.products
  for each row execute function private.guard_catalog_product_publication();
create trigger products_require_publication_readiness_update
  before update of status, category_id on public.products
  for each row execute function private.guard_catalog_product_publication();

create or replace function private.guard_catalog_category_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1 from public.products p
    where p.category_id = old.id and p.status = 'active'
  ) then
    raise exception 'category_has_published_products'
      using errcode = '23514', hint = 'Despublique os produtos antes de desativar a categoria.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_catalog_category_deactivation() from public, anon, authenticated;

create trigger categories_protect_published_products
  before update of is_active on public.categories
  for each row execute function private.guard_catalog_category_deactivation();

create or replace function private.guard_last_published_product_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select p.status into v_status
  from public.products p
  where p.id = old.product_id
  for update;
  if v_status = 'active' and (
    select count(*) from public.product_media pm
    where pm.product_id = old.product_id
  ) <= 1 then
    raise exception 'published_product_requires_media'
      using errcode = '23514', hint = 'Tire o produto da loja ou adicione outra imagem antes de remover esta.';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_last_published_product_image() from public, anon, authenticated;

create trigger product_media_keep_published_image
  before delete on public.product_media
  for each row execute function private.guard_last_published_product_image();
