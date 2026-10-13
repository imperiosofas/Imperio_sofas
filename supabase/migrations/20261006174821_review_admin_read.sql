create policy "catalog admins can read reviews" on public.product_reviews
  for select to authenticated using ((select private.is_catalog_admin()));
