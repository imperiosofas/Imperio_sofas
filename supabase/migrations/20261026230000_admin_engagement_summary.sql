-- Admin-only engagement summary for reviews and favorites. Favorites are
-- private to each customer (RLS), so this definer function returns only
-- aggregate counts and never exposes which customer saved which product.
create or replace function public.admin_get_engagement_summary ()
returns jsonb
language plpgsql
stable
security definer
set search_path = '' as $function$
declare
  v_summary jsonb;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'reviews', (
      select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where r.status = 'published'),
        'hidden', count(*) filter (where r.status = 'hidden'),
        'last_7_days', count(*) filter (where r.created_at >= now() - interval '7 days'),
        'average_rating', coalesce(round(avg(r.rating) filter (where r.status = 'published'), 1), 0),
        'distribution', jsonb_build_object(
          '5', count(*) filter (where r.status = 'published' and r.rating = 5),
          '4', count(*) filter (where r.status = 'published' and r.rating = 4),
          '3', count(*) filter (where r.status = 'published' and r.rating = 3),
          '2', count(*) filter (where r.status = 'published' and r.rating = 2),
          '1', count(*) filter (where r.status = 'published' and r.rating = 1)
        )
      )
      from public.product_reviews as r
    ),
    'favorites', (
      select jsonb_build_object(
        'total', count(*),
        'customers', count(distinct f.user_id),
        'products', count(distinct f.product_id),
        'last_7_days', count(*) filter (where f.created_at >= now() - interval '7 days')
      )
      from public.product_favorites as f
    ),
    'top_favorited', coalesce((
      select jsonb_agg(t order by t.favorites desc, t.name)
      from (
        select
          p.id as product_id,
          p.name,
          p.slug,
          p.status,
          count(f.*)::int as favorites,
          (select count(*)::int from public.product_reviews as r
            where r.product_id = p.id and r.status = 'published') as review_count,
          (select round(avg(r.rating), 1) from public.product_reviews as r
            where r.product_id = p.id and r.status = 'published') as average_rating
        from public.product_favorites as f
        join public.products as p on p.id = f.product_id
        group by p.id, p.name, p.slug, p.status
        order by count(f.*) desc, p.name
        limit 10
      ) as t
    ), '[]'::jsonb)
  ) into v_summary;

  return v_summary;
end;
$function$;

revoke execute on function public.admin_get_engagement_summary () from public, anon;
grant execute on function public.admin_get_engagement_summary () to authenticated;
