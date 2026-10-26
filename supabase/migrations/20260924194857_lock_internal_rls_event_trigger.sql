-- This database-maintenance function is invoked by its event trigger, not by API callers.
-- It is created by the hosted Supabase platform, so a fresh local database
-- (supabase db reset in CI) does not have it; only revoke when it exists.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Support the FK lookup/cascade checks for a media row's optional variant.
create index if not exists product_media_variant_id_idx
  on public.product_media (variant_id);
