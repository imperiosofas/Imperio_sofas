create function public.get_my_favorite_products()
returns jsonb language sql stable security definer set search_path = '' as $$
  with mine as (
    select product_id, created_at from public.product_favorites
    where user_id = auth.uid() order by created_at desc limit 100
  )
  select coalesce(jsonb_agg(to_jsonb(product) order by mine.created_at desc), '[]'::jsonb)
  from mine join public.get_catalog_products(null, null) product on product.id = mine.product_id;
$$;
revoke execute on function public.get_my_favorite_products() from public, anon;
grant execute on function public.get_my_favorite_products() to authenticated;
