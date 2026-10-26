-- Reviews should show who wrote them. Customers can choose how their name
-- appears; otherwise it is derived from their profile as "First L." Admins get
-- a separate function with the contact details needed to reply to a customer.
drop function if exists public.save_product_review (uuid, integer, text);

create function public.save_product_review (
  p_product_id uuid,
  p_rating integer,
  p_comment text default null,
  p_display_name text default null
) returns void language plpgsql security definer
set search_path = '' as $function$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_source text;
  v_parts text[];
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_rating not between 1 and 5 or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'invalid review'; end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'active') then
    raise exception 'product unavailable'; end if;

  v_name := nullif(btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]]', '', 'g')), '');
  if v_name is not null then
    if char_length(v_name) not between 2 and 40 then raise exception 'invalid name'; end if;
  else
    select coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''))
    into v_source
    from auth.users as u
    left join public.customer_profiles as cp on cp.user_id = u.id
    where u.id = v_user;
    if v_source is not null then
      v_parts := regexp_split_to_array(regexp_replace(v_source, '[[:cntrl:]]', '', 'g'), '\s+');
      v_name := case
        when array_length(v_parts, 1) > 1
          then v_parts[1] || ' ' || upper(left(v_parts[array_length(v_parts, 1)], 1)) || '.'
        else v_parts[1]
      end;
    end if;
  end if;
  v_name := left(coalesce(v_name, 'Cliente'), 80);

  insert into public.product_reviews (product_id, user_id, rating, comment, display_name)
    values (p_product_id, v_user, p_rating, nullif(btrim(p_comment), ''), v_name)
  on conflict (user_id, product_id) do update set
    rating = excluded.rating,
    comment = excluded.comment,
    display_name = excluded.display_name,
    status = case when public.product_reviews.status = 'hidden' then 'hidden' else 'published' end;
end;
$function$;

revoke execute on function public.save_product_review (uuid, integer, text, text) from public, anon;
grant execute on function public.save_product_review (uuid, integer, text, text) to authenticated;

create or replace function public.admin_list_product_reviews (p_status text default null, p_limit integer default 100)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  product_slug text,
  product_status text,
  rating smallint,
  comment text,
  status text,
  created_at timestamptz,
  display_name text,
  customer_name text,
  customer_email text,
  customer_phone text
) language plpgsql stable security definer
set search_path = '' as $function$
#variable_conflict use_column
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('published', 'hidden') then
    raise exception 'invalid status';
  end if;

  return query
  select
    r.id,
    r.product_id,
    p.name,
    p.slug,
    p.status,
    r.rating,
    r.comment,
    r.status,
    r.created_at,
    r.display_name,
    cp.display_name,
    u.email::text,
    cp.contact_phone
  from public.product_reviews as r
  join public.products as p on p.id = r.product_id
  left join public.customer_profiles as cp on cp.user_id = r.user_id
  left join auth.users as u on u.id = r.user_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$function$;

revoke execute on function public.admin_list_product_reviews (text, integer) from public, anon;
grant execute on function public.admin_list_product_reviews (text, integer) to authenticated;
