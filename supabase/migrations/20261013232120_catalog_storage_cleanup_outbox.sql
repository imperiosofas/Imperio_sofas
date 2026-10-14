-- Recoverable, admin-only cleanup queue for private catalog Storage objects.
-- This migration records ownership before metadata/product deletion and never
-- edits storage.objects: objects are removed only through the Storage API.

create table private.catalog_storage_cleanup_outbox (
  id uuid primary key default gen_random_uuid(),
  source_media_id uuid not null unique,
  product_id uuid not null,
  bucket_id text not null default 'catalog-images'
    check (bucket_id = 'catalog-images'),
  storage_path text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_by uuid,
  claim_token uuid,
  lease_until timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'storage_list_failed', 'storage_remove_failed', 'path_ownership_mismatch'
    )
  ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint catalog_storage_cleanup_path_owned check (
    storage_path ~ (
      '^products/' || product_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
    )
  ),
  constraint catalog_storage_cleanup_claim_state check (
    (status = 'processing' and claimed_by is not null and claim_token is not null and lease_until is not null)
    or (status <> 'processing' and claimed_by is null and claim_token is null and lease_until is null)
  ),
  constraint catalog_storage_cleanup_completed_state check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

alter table private.catalog_storage_cleanup_outbox enable row level security;
revoke all on table private.catalog_storage_cleanup_outbox from public, anon, authenticated;

create index catalog_storage_cleanup_pending_idx
  on private.catalog_storage_cleanup_outbox (next_attempt_at, created_at)
  where status = 'pending';
create index catalog_storage_cleanup_product_pending_idx
  on private.catalog_storage_cleanup_outbox (product_id, created_at)
  where status <> 'completed';

create or replace function private.enqueue_catalog_storage_cleanup(
  p_product_id uuid,
  p_media_id uuid,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing private.catalog_storage_cleanup_outbox%rowtype;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_storage_path !~ (
    '^products/' || p_product_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$'
  ) then
    raise exception 'invalid_catalog_storage_path' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.product_media pm
    where pm.id = p_media_id
      and pm.product_id = p_product_id
      and pm.storage_path = p_storage_path
  ) then
    raise exception 'catalog_media_ownership_mismatch' using errcode = '42501';
  end if;

  select * into v_existing
  from private.catalog_storage_cleanup_outbox o
  where o.source_media_id = p_media_id;
  if found then
    if v_existing.product_id <> p_product_id
      or v_existing.storage_path <> p_storage_path
      or v_existing.bucket_id <> 'catalog-images' then
      raise exception 'catalog_media_ownership_mismatch' using errcode = '42501';
    end if;
    return v_existing.id;
  end if;

  insert into private.catalog_storage_cleanup_outbox (
    source_media_id, product_id, bucket_id, storage_path
  ) values (
    p_media_id, p_product_id, 'catalog-images', p_storage_path
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.enqueue_catalog_storage_cleanup(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.admin_remove_catalog_product_media(
  p_product_id uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_path text;
  v_count integer;
  v_cleanup_id uuid;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select p.status into v_status
  from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  select pm.storage_path into v_path
  from public.product_media pm
  where pm.id = p_media_id and pm.product_id = p_product_id
  for update;
  if not found then
    -- A retry after a successful metadata delete returns the same durable job.
    select o.id into v_cleanup_id
    from private.catalog_storage_cleanup_outbox o
    where o.source_media_id = p_media_id and o.product_id = p_product_id;
    if found then
      return jsonb_build_object('outcome', 'queued', 'cleanup_id', v_cleanup_id);
    end if;
    raise exception 'catalog_media_not_found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_count
  from public.product_media pm where pm.product_id = p_product_id;
  if v_status = 'active' and v_count <= 1 then
    raise exception 'published_product_requires_media'
      using errcode = '23514', hint = 'Tire o produto da loja ou adicione outra imagem antes de remover esta.';
  end if;

  v_cleanup_id := private.enqueue_catalog_storage_cleanup(p_product_id, p_media_id, v_path);
  delete from public.product_media pm
  where pm.id = p_media_id and pm.product_id = p_product_id;
  return jsonb_build_object('outcome', 'queued', 'cleanup_id', v_cleanup_id);
end;
$$;
revoke all on function public.admin_remove_catalog_product_media(uuid, uuid) from public, anon;
grant execute on function public.admin_remove_catalog_product_media(uuid, uuid) to authenticated;

create or replace function public.admin_claim_catalog_storage_cleanup(p_cleanup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job private.catalog_storage_cleanup_outbox%rowtype;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_job
  from private.catalog_storage_cleanup_outbox o
  where o.id = p_cleanup_id
    and (
      (o.status = 'pending' and o.next_attempt_at <= now())
      or (o.status = 'processing' and o.lease_until <= now())
    )
  for update skip locked;
  if not found then
    if exists (
      select 1 from private.catalog_storage_cleanup_outbox o
      where o.id = p_cleanup_id and o.status = 'completed'
    ) then
      return jsonb_build_object('outcome', 'completed');
    end if;
    if exists (select 1 from private.catalog_storage_cleanup_outbox o where o.id = p_cleanup_id) then
      return jsonb_build_object('outcome', 'busy');
    end if;
    return jsonb_build_object('outcome', 'missing');
  end if;

  update private.catalog_storage_cleanup_outbox o
  set status = 'processing',
      attempts = o.attempts + 1,
      claimed_by = (select auth.uid()),
      claim_token = gen_random_uuid(),
      lease_until = now() + interval '5 minutes'
  where o.id = p_cleanup_id
  returning * into v_job;

  return jsonb_build_object(
    'outcome', 'claimed',
    'claim_token', v_job.claim_token,
    'product_id', v_job.product_id,
    'bucket_id', v_job.bucket_id,
    'storage_path', v_job.storage_path
  );
end;
$$;
revoke all on function public.admin_claim_catalog_storage_cleanup(uuid) from public, anon;
grant execute on function public.admin_claim_catalog_storage_cleanup(uuid) to authenticated;

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
        o.attempts, o.next_attempt_at, o.last_error_code, o.created_at
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
        limit 1 offset 24
      )
    )
  );
end;
$$;
revoke all on function public.admin_list_catalog_storage_cleanup(timestamptz, uuid) from public, anon;
grant execute on function public.admin_list_catalog_storage_cleanup(timestamptz, uuid) to authenticated;

create or replace function public.admin_finish_catalog_storage_cleanup(
  p_cleanup_id uuid,
  p_claim_token uuid,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed boolean;
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_error_code is not null and p_error_code not in (
      'storage_list_failed', 'storage_remove_failed', 'path_ownership_mismatch'
    ) then
    raise exception 'invalid_cleanup_result' using errcode = '22023';
  end if;

  update private.catalog_storage_cleanup_outbox o
  set status = case
        when p_error_code is not null then 'pending'
        when exists (
          select 1 from storage.objects so
          where so.bucket_id = o.bucket_id and so.name = o.storage_path
        ) then 'pending'
        else 'completed'
      end,
      completed_at = case
        when p_error_code is null and not exists (
          select 1 from storage.objects so
          where so.bucket_id = o.bucket_id and so.name = o.storage_path
        ) then now()
        else null
      end,
      next_attempt_at = case
        when p_error_code is not null or exists (
          select 1 from storage.objects so
          where so.bucket_id = o.bucket_id and so.name = o.storage_path
        ) then now() + least(
          interval '24 hours',
          interval '2 minutes' * power(
            2::double precision,
            least(greatest(o.attempts - 1, 0), 11)
          )
        )
        else now()
      end,
      claimed_by = null,
      claim_token = null,
      lease_until = null,
      last_error_code = case
        when p_error_code is not null then p_error_code
        when exists (
          select 1 from storage.objects so
          where so.bucket_id = o.bucket_id and so.name = o.storage_path
        ) then 'storage_remove_failed'
        else null
      end
  where o.id = p_cleanup_id
    and o.status = 'processing'
    and o.claim_token = p_claim_token
    and o.claimed_by = (select auth.uid());
  if not found then return false; end if;

  select o.status = 'completed' into v_completed
  from private.catalog_storage_cleanup_outbox o
  where o.id = p_cleanup_id;
  return coalesce(v_completed, false);
end;
$$;
revoke all on function public.admin_finish_catalog_storage_cleanup(uuid, uuid, text) from public, anon;
grant execute on function public.admin_finish_catalog_storage_cleanup(uuid, uuid, text) to authenticated;

create or replace function public.admin_delete_catalog_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleanup_ids uuid[];
begin
  if not (select private.is_catalog_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product_id for update) then
    select coalesce(array_agg(o.id order by o.created_at), '{}'::uuid[])
    into v_cleanup_ids
    from private.catalog_storage_cleanup_outbox o
    where o.product_id = p_product_id and o.status <> 'completed';
    if cardinality(v_cleanup_ids) > 0 then
      return jsonb_build_object('outcome', 'already_deleted', 'cleanup_ids', to_jsonb(v_cleanup_ids));
    end if;
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.product_variants v join public.cart_items ci on ci.variant_id = v.id
    where v.product_id = p_product_id
  ) or exists (select 1 from public.product_reviews r where r.product_id = p_product_id)
  then
    update public.products set status = 'archived' where id = p_product_id;
    return jsonb_build_object('outcome', 'archived', 'cleanup_ids', '[]'::jsonb);
  end if;

  begin
    select coalesce(array_agg(private.enqueue_catalog_storage_cleanup(
      p_product_id, pm.id, pm.storage_path
    )), '{}'::uuid[])
    into v_cleanup_ids
    from public.product_media pm
    where pm.product_id = p_product_id;

    delete from public.product_media where product_id = p_product_id;
    delete from public.inventory where variant_id in (
      select id from public.product_variants where product_id = p_product_id
    );
    delete from public.product_variants where product_id = p_product_id;
    delete from public.products where id = p_product_id;
  exception when foreign_key_violation then
    update public.products set status = 'archived' where id = p_product_id;
    return jsonb_build_object('outcome', 'archived', 'cleanup_ids', '[]'::jsonb);
  end;

  return jsonb_build_object('outcome', 'deleted', 'cleanup_ids', to_jsonb(v_cleanup_ids));
end;
$$;
revoke all on function public.admin_delete_catalog_product(uuid) from public, anon;
grant execute on function public.admin_delete_catalog_product(uuid) to authenticated;
