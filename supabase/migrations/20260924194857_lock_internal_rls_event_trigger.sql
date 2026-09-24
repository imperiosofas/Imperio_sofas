-- This database-maintenance function is invoked by its event trigger, not by API callers.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Support the FK lookup/cascade checks for a media row's optional variant.
create index if not exists product_media_variant_id_idx
  on public.product_media (variant_id);
