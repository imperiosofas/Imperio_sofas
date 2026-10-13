begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profile-a@example.invalid'),
  ('b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'profile-b@example.invalid');

set local role anon;
select throws_ok($$select * from public.customer_profiles$$, '42501', null,
  'anonymous users cannot read customer profiles');
select throws_ok($$insert into public.customer_profiles(user_id) values ('a1111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'anonymous users cannot create customer profiles');

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
set local role authenticated;
insert into public.customer_profiles(user_id, display_name, contact_phone)
values ('a1111111-1111-4111-8111-111111111111', 'Cliente A', '+5512988887777');
select is((select display_name from public.customer_profiles), 'Cliente A', 'owner reads their own profile');
select is((select contact_phone from public.customer_profiles), '+5512988887777', 'contact phone is stored in the profile table');
select is((select count(*)::integer from public.customer_profiles where user_id = 'b2222222-2222-4222-8222-222222222222'),
  0, 'owner cannot read a different profile');
update public.customer_profiles set display_name = 'Alterado por A'
where user_id = 'b2222222-2222-4222-8222-222222222222';
select is((select display_name from public.customer_profiles where user_id = 'b2222222-2222-4222-8222-222222222222'),
  null::text, 'owner cannot update a different profile');
select throws_ok($$update public.customer_profiles set display_name = 'A' where user_id = auth.uid()$$,
  '23514', null, 'database rejects a name shorter than two characters');
select throws_ok($$update public.customer_profiles set contact_phone = '+5510988887777' where user_id = auth.uid()$$,
  '23514', null, 'database rejects a phone with an invalid area code');
select lives_ok($$update public.customer_profiles set display_name = 'Cliente A Atualizado', contact_phone = null where user_id = auth.uid()$$,
  'owner can update valid profile data and clear optional phone');

do $$
declare line text;
begin
  for line in select * from finish() loop
    if line like 'not ok%' or line like '# Looks like%' then
      raise exception 'pgtap failure: %', line;
    end if;
  end loop;
end;
$$;
rollback;
