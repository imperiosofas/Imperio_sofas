-- Restore the administrative assurance requirement after the temporary pause.
-- Membership is necessary, but never sufficient without a current AAL2 session.
create or replace function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1
      from public.catalog_admins as ca
      where ca.user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_catalog_admin() from public, anon;
grant execute on function private.is_catalog_admin() to authenticated;

-- The audit log has no API grants or client-facing policies. RLS provides
-- defense in depth; the owner-executed audit trigger remains able to append.
alter table private.catalog_admin_audit enable row level security;
