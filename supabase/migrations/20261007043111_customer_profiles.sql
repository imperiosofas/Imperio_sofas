-- Contact information is deliberately separate from Supabase Auth identity.
create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null or (
      display_name = btrim(display_name)
      and char_length(display_name) between 2 and 80
      and display_name !~ '[[:cntrl:]]'
    )
  ),
  contact_phone text check (
    contact_phone is null or contact_phone ~ '^\+55(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1-5]|6[1-9]|7[134579]|8[1-9]|9[1-9])([2-5][0-9]{7}|9[0-9]{8})$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

create policy "Customer reads own profile"
  on public.customer_profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Customer creates own profile"
  on public.customer_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Customer updates own profile"
  on public.customer_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.customer_profiles from anon;
grant select, insert, update on public.customer_profiles to authenticated;
