-- Email OTP is a custom second step for password sessions. The Supabase
-- session itself remains AAL1; authorization uses this server-verified
-- session record instead of forging Supabase's aal claim.
create table private.email_mfa_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  email text not null,
  code_hmac text not null check (code_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  check (expires_at > created_at)
);

create index email_mfa_challenges_user_created_idx
  on private.email_mfa_challenges (user_id, created_at desc);

create table private.email_mfa_verified_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  verified_at timestamptz not null default now()
);

alter table private.email_mfa_challenges enable row level security;
alter table private.email_mfa_verified_sessions enable row level security;
revoke all on table private.email_mfa_challenges from public, anon, authenticated;
revoke all on table private.email_mfa_verified_sessions from public, anon, authenticated;

create or replace function public.issue_email_mfa_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_email text,
  p_code_hmac text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_sent timestamptz;
  v_recent_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  if p_email is null or length(p_email) > 320
    or p_code_hmac is null
    or p_code_hmac !~ '^[0-9a-f]{64}$'
    or not exists (
      select 1 from auth.sessions s
      where s.id = p_session_id
        and s.user_id = p_user_id
        and (s.not_after is null or s.not_after > now())
    ) then
    return 'invalid_session';
  end if;

  select max(c.created_at), count(*)::integer
    into v_last_sent, v_recent_count
    from private.email_mfa_challenges c
   where c.user_id = p_user_id
     and c.created_at > now() - interval '1 hour';

  if v_last_sent > now() - interval '60 seconds' then
    return 'cooldown';
  end if;
  if v_recent_count >= 5 then
    return 'rate_limited';
  end if;

  update private.email_mfa_challenges
     set expires_at = now(), consumed_at = coalesce(consumed_at, now())
   where session_id = p_session_id and consumed_at is null;

  insert into private.email_mfa_challenges (
    id, user_id, session_id, email, code_hmac, expires_at
  ) values (
    p_challenge_id, p_user_id, p_session_id, lower(trim(p_email)),
    p_code_hmac, now() + interval '5 minutes'
  );

  return 'issued';
end;
$$;

revoke all on function public.issue_email_mfa_challenge(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_email_mfa_challenge(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.verify_email_mfa_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_code_hmac text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge private.email_mfa_challenges%rowtype;
begin
  select c.* into v_challenge
    from private.email_mfa_challenges c
   where c.id = p_challenge_id
     and c.user_id = p_user_id
     and c.session_id = p_session_id
   for update;

  if not found or v_challenge.consumed_at is not null
    or v_challenge.expires_at <= now() or v_challenge.attempts >= 5
    or not exists (
      select 1 from auth.sessions s
      where s.id = p_session_id and s.user_id = p_user_id
        and (s.not_after is null or s.not_after > now())
    ) then
    return 'invalid';
  end if;

  if p_code_hmac is null or p_code_hmac !~ '^[0-9a-f]{64}$'
    or v_challenge.code_hmac <> p_code_hmac then
    update private.email_mfa_challenges
       set attempts = attempts + 1
     where id = p_challenge_id;
    return 'invalid';
  end if;

  update private.email_mfa_challenges
     set consumed_at = now(), attempts = attempts + 1
   where id = p_challenge_id;

  insert into private.email_mfa_verified_sessions (user_id, session_id)
  values (p_user_id, p_session_id)
  on conflict (session_id) do update set verified_at = excluded.verified_at;

  return 'verified';
end;
$$;

revoke all on function public.verify_email_mfa_challenge(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.verify_email_mfa_challenge(uuid, uuid, uuid, text)
  to service_role;

create or replace function private.is_email_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.email_mfa_verified_sessions v
      join auth.sessions s on s.id = v.session_id and s.user_id = v.user_id
     where v.user_id = (select auth.uid())
       and v.session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
       and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function private.is_email_mfa_verified() from public, anon;
grant execute on function private.is_email_mfa_verified() to authenticated, service_role;

create or replace function public.is_email_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_email_mfa_verified());
$$;
revoke all on function public.is_email_mfa_verified() from public, anon;
grant execute on function public.is_email_mfa_verified() to authenticated;

create or replace function private.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    or (
      (select auth.jwt() -> 'amr' -> 0 ->> 'method') = 'password'
      and (select private.is_email_mfa_verified())
    )
  )
  and exists (
    select 1 from public.catalog_admins ca
    where ca.user_id = (select auth.uid())
  );
$$;
