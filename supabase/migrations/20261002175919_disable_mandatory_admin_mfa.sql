-- MFA is optional for now by owner decision. Authorization remains limited to
-- authenticated users explicitly present in public.catalog_admins.
create or replace function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_admins as ca
    where ca.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_catalog_admin() from public, anon;
grant execute on function private.is_catalog_admin() to authenticated;
