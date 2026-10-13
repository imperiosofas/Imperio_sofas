-- A moderated review keeps its unique key so deletion cannot bypass moderation.
-- Clear customer text/name when they request removal of a hidden review.
create or replace function public.delete_my_product_review(p_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.product_reviews
    where product_id = p_product_id and user_id = auth.uid() and status = 'published';
  update public.product_reviews set comment = null, display_name = 'Cliente'
    where product_id = p_product_id and user_id = auth.uid() and status = 'hidden';
end;
$$;
revoke execute on function public.delete_my_product_review(uuid) from public, anon;
grant execute on function public.delete_my_product_review(uuid) to authenticated;
