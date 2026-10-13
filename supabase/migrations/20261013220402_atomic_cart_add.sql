-- Serialize additions for the same variant by locking its inventory row, then
-- increment the existing cart quantity in the conflict update itself.
create function public.add_cart_item(p_variant_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cart uuid;
  v_stock integer;
  v_new_quantity integer;
  v_existing_quantity integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'invalid quantity';
  end if;

  select i.on_hand - i.reserved into v_stock
  from public.product_variants v
  join public.products p on p.id = v.product_id and p.status = 'active'
  join public.categories c on c.id = p.category_id and c.is_active
  join public.inventory i on i.variant_id = v.id
  where v.id = p_variant_id
    and v.is_active
    and v.sku is not null
    and v.price_cents > 0
  for update of i;

  if v_stock is null or v_stock < 1 or p_quantity > v_stock then
    raise exception 'item unavailable';
  end if;

  insert into public.carts(user_id) values (v_user)
  on conflict (user_id) do update set updated_at = now()
  returning id into v_cart;

  insert into public.cart_items as ci(cart_id, variant_id, quantity)
  values (v_cart, p_variant_id, p_quantity)
  on conflict (cart_id, variant_id) do update
    set quantity = ci.quantity + excluded.quantity
    where ci.quantity + excluded.quantity <= least(v_stock, 99)
  returning ci.quantity into v_new_quantity;

  if v_new_quantity is null then
    select ci.quantity into v_existing_quantity
    from public.cart_items ci
    where ci.cart_id = v_cart and ci.variant_id = p_variant_id;

    if v_existing_quantity + p_quantity > 99 then
      raise exception 'quantity limit reached';
    end if;
    raise exception 'item unavailable';
  end if;
end;
$$;

revoke execute on function public.add_cart_item(uuid, integer) from public, anon;
grant execute on function public.add_cart_item(uuid, integer) to authenticated;
