-- Temporarily pause MFA for the catalog administrator so work can continue.
-- Authentication and explicit catalog_admins membership remain mandatory.
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
