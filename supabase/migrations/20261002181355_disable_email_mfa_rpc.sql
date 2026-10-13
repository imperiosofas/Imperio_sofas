-- Email-based MFA is disabled by owner decision. Keep existing challenge data
-- for recovery/audit, but do not expose its verification state to client roles.
revoke all on function public.is_email_mfa_verified()
  from public, anon, authenticated;
revoke all on function private.is_email_mfa_verified()
  from public, anon, authenticated;
grant execute on function private.is_email_mfa_verified() to service_role;
