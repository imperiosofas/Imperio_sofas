insert into public.categories (name, slug, description, position, is_active)
values ('Sofás', 'sofas', 'Modelos selecionados para diferentes salas e momentos.', 10, true)
on conflict (slug) do nothing;

with draft_products (slug, name, width_mm) as (
  values
    ('sofa-belize', 'Sofá Belize', 2200),
    ('sofa-berlim', 'Sofá Berlim', 2500),
    ('sofa-dallas', 'Sofá Dallas', 2900),
    ('sofa-ferrari', 'Sofá Ferrari', 2200),
    ('sofa-maximo', 'Sofá Máximo', 2300)
), inserted_products as (
  insert into public.products (category_id, name, slug, description, status)
  select c.id, d.name, d.slug, 'Cadastro inicial pendente de revisão comercial.', 'draft'
  from draft_products as d
  cross join public.categories as c
  where c.slug = 'sofas'
  on conflict (slug) do nothing
  returning id, slug
), selected_products as (
  select p.id, p.slug
  from inserted_products as p
  union
  select p.id, p.slug
  from public.products as p
  join draft_products as d on d.slug = p.slug
), inserted_variants as (
  insert into public.product_variants (product_id, width_mm, price_cents, is_active)
  select p.id, d.width_mm, null, false
  from selected_products as p
  join draft_products as d on d.slug = p.slug
  on conflict (product_id, fabric, color, width_mm, depth_mm, height_mm, attributes) do nothing
  returning id, product_id
), variants as (
  select id, product_id from inserted_variants
  union
  select pv.id, pv.product_id
  from public.product_variants as pv
  join selected_products as p on p.id = pv.product_id
  join draft_products as d on d.slug = p.slug and d.width_mm = pv.width_mm
)
insert into public.inventory (variant_id, on_hand, reserved, low_stock_threshold)
select id, 0, 0, 0 from variants
on conflict (variant_id) do nothing;
