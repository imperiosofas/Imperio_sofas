-- Fix keyset pagination: the cursor must be the last row returned by the
-- descending page, not the newest row (which would repeat earlier pages).
create or replace function public.admin_list_catalog_storage_cleanup(
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (p_after_created_at is null) <> (p_after_id is null) then
    raise exception 'invalid_cleanup_cursor' using errcode = '22023';
  end if;

  return (
    with pending_jobs as materialized (
      select o.id as cleanup_id, o.product_id, p.name as product_name, o.status,
        o.attempts, o.next_attempt_at, o.last_error_code, o.created_at,
        (
          (o.status = 'pending' and o.next_attempt_at <= now())
          or (o.status = 'processing' and o.lease_until <= now())
        ) as retry_ready
      from private.catalog_storage_cleanup_outbox o
      left join public.products p on p.id = o.product_id
      where (
        o.status = 'pending'
        or (o.status = 'processing' and o.lease_until <= now())
      )
        and (
          p_after_created_at is null
          or (o.created_at, o.id) < (p_after_created_at, p_after_id)
        )
      order by o.created_at desc, o.id desc
      limit 26
    ), page as (
      select * from pending_jobs
      order by created_at desc, cleanup_id desc
      limit 25
    )
    select jsonb_build_object(
      'jobs', coalesce((
        select jsonb_agg(to_jsonb(page) order by page.created_at desc, page.cleanup_id desc)
        from page
      ), '[]'::jsonb),
      'has_more', (select count(*) > 25 from pending_jobs),
      'next_cursor', (
        select jsonb_build_object('created_at', page.created_at, 'id', page.cleanup_id)
        from page
        order by page.created_at asc, page.cleanup_id asc
        limit 1
      )
    )
  );
end;
$$;

revoke all on function public.admin_list_catalog_storage_cleanup(timestamptz, uuid) from public, anon;
grant execute on function public.admin_list_catalog_storage_cleanup(timestamptz, uuid) to authenticated;
