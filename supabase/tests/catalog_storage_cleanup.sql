begin;
create extension if not exists pgtap with schema extensions;
select plan(32);
insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', false)
on conflict (id) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('11111111-1111-4111-8111-111111111111', null, 'authenticated', 'authenticated', 'storage-admin@example.invalid', '', now(), now(), now(), '{}', '{}'),
  ('22222222-2222-4222-8222-222222222222', null, 'authenticated', 'authenticated', 'storage-customer@example.invalid', '', now(), now(), now(), '{}', '{}');
insert into public.catalog_admins(user_id)
values ('11111111-1111-4111-8111-111111111111');
insert into public.products (id, category_id, name, slug)
select '33333333-3333-4333-8333-333333333333', c.id, 'TEST Cleanup image owner', 'test-cleanup-image-owner'
from public.categories c where c.slug = 'sofas';
insert into public.products (id, category_id, name, slug)
select '44444444-4444-4444-8444-444444444444', c.id, 'TEST Cleanup foreign owner', 'test-cleanup-foreign-owner'
from public.categories c where c.slug = 'sofas';
insert into public.products (id, category_id, name, slug)
select '55555555-5555-4555-8555-555555555555', c.id, 'TEST Cleanup whole product', 'test-cleanup-whole-product'
from public.categories c where c.slug = 'sofas';
insert into public.product_media (id, product_id, storage_path, alt_text)
values
  ('66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333', 'products/33333333-3333-4333-8333-333333333333/77777777-7777-4777-8777-777777777777.webp', 'TEST owned'),
  ('88888888-8888-4888-8888-888888888888', '44444444-4444-4444-8444-444444444444', 'products/44444444-4444-4444-8444-444444444444/99999999-9999-4999-8999-999999999999.webp', 'TEST foreign'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'products/55555555-5555-4555-8555-555555555555/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', 'TEST whole product');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.admin_remove_catalog_product_media('33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666')$$,
  '42501', null, 'non-admin cannot remove catalog media'
);
select is((select count(*)::integer from public.product_media where id = '66666666-6666-4666-8666-666666666666'), 1, 'unauthorized attempt leaves media intact');
select throws_ok(
  $$select public.admin_claim_catalog_storage_cleanup('00000000-0000-4000-8000-000000000000')$$,
  '42501', null, 'non-admin cannot claim cleanup jobs'
);
select throws_ok(
  $$select public.admin_list_catalog_storage_cleanup()$$,
  '42501', null, 'non-admin cannot list cleanup jobs'
);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.admin_remove_catalog_product_media('33333333-3333-4333-8333-333333333333', '88888888-8888-4888-8888-888888888888')$$,
  'P0002', null, 'media id from another product is rejected without exposing its path'
);
select is((select count(*)::integer from public.product_media where id = '88888888-8888-4888-8888-888888888888'), 1, 'foreign product media remains intact');

create temporary table cleanup_test_result as
select public.admin_remove_catalog_product_media(
  '33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666'
) as result;
select is((select result->>'outcome' from cleanup_test_result), 'queued', 'authorized removal queues cleanup before deleting metadata');
select is((select count(*)::integer from public.product_media where id = '66666666-6666-4666-8666-666666666666'), 0, 'queued removal deletes only the owned metadata');
select is(
  (public.admin_remove_catalog_product_media('33333333-3333-4333-8333-333333333333', '66666666-6666-4666-8666-666666666666')->>'cleanup_id'),
  (select result->>'cleanup_id' from cleanup_test_result),
  'duplicate remove retry returns the same durable cleanup job'
);
select is(
  jsonb_array_length(public.admin_list_catalog_storage_cleanup()->'jobs'),
  1,
  'admin can find a pending cleanup using the durable outbox after media deletion'
);
select ok(
  (
    select (job->>'retry_ready')::boolean
    from jsonb_array_elements(public.admin_list_catalog_storage_cleanup()->'jobs') as jobs(job)
    where job->>'cleanup_id' = (select result->>'cleanup_id' from cleanup_test_result)
  ),
  'list RPC reports an immediately retryable pending job using database time'
);

reset role;
insert into private.catalog_storage_cleanup_outbox (
  source_media_id, product_id, bucket_id, storage_path, created_at
)
select gen_random_uuid(),
  '33333333-3333-4333-8333-333333333333',
  'catalog-images',
  'products/33333333-3333-4333-8333-333333333333/' || gen_random_uuid() || '.webp',
  now() - make_interval(secs => series.n)
from generate_series(1, 27) as series(n);
set local role authenticated;
create temporary table cleanup_page_one as
select public.admin_list_catalog_storage_cleanup() as result;
select is(jsonb_array_length((select result->'jobs' from cleanup_page_one)), 25, 'first queue page returns its fixed page size');
select ok((select (result->>'has_more')::boolean from cleanup_page_one), 'first queue page exposes a continuation cursor');
create temporary table cleanup_page_two as
select public.admin_list_catalog_storage_cleanup(
  (select (result->'next_cursor'->>'created_at')::timestamptz from cleanup_page_one),
  (select (result->'next_cursor'->>'id')::uuid from cleanup_page_one)
) as result;
select is(jsonb_array_length((select result->'jobs' from cleanup_page_two)), 3, 'next cursor exposes every remaining pending job');
select is((select (result->>'has_more')::boolean from cleanup_page_two), false, 'last queue page has no further cursor');

create temporary table cleanup_claim_first as
select public.admin_claim_catalog_storage_cleanup((select (result->>'cleanup_id')::uuid from cleanup_test_result)) as result;
select is((select result->>'outcome' from cleanup_claim_first), 'claimed', 'pending cleanup is claimed');
select is((select result->>'bucket_id' from cleanup_claim_first), 'catalog-images', 'claim is fixed to the private catalog bucket');
create temporary table cleanup_failure as
select public.admin_finish_catalog_storage_cleanup(
  (select (result->>'cleanup_id')::uuid from cleanup_test_result),
  (select (result->>'claim_token')::uuid from cleanup_claim_first), 'storage_remove_failed'
) as finished;
select ok((select finished from cleanup_failure), 'storage failure is recorded as retryable');
reset role;
select ok(
  (select next_attempt_at > now() + interval '1 minute'
    from private.catalog_storage_cleanup_outbox
    where id = (select (result->>'cleanup_id')::uuid from cleanup_test_result)),
  'first failed attempt schedules a bounded cooldown'
);
set local role authenticated;
select is(
  public.admin_claim_catalog_storage_cleanup((select (result->>'cleanup_id')::uuid from cleanup_test_result))->>'outcome',
  'busy',
  'immediate repeated claim is blocked during cooldown'
);
select ok(
  not (
    select (job->>'retry_ready')::boolean
    from jsonb_array_elements(public.admin_list_catalog_storage_cleanup()->'jobs') as jobs(job)
    where job->>'cleanup_id' = (select result->>'cleanup_id' from cleanup_test_result)
  ),
  'list RPC reports a failed job as not ready during its cooldown using database time'
);
reset role;
update private.catalog_storage_cleanup_outbox
set next_attempt_at = now()
where id = (select (result->>'cleanup_id')::uuid from cleanup_test_result);
set local role authenticated;

create temporary table cleanup_claim_retry as
select public.admin_claim_catalog_storage_cleanup((select (result->>'cleanup_id')::uuid from cleanup_test_result)) as result;
select is((select result->>'outcome' from cleanup_claim_retry), 'claimed', 'failed cleanup can be retried');
select isnt((select result->>'claim_token' from cleanup_claim_retry), (select result->>'claim_token' from cleanup_claim_first), 'each retry receives a fresh claim token');

reset role;
insert into storage.objects (bucket_id, name, metadata)
values (
  'catalog-images',
  'products/33333333-3333-4333-8333-333333333333/77777777-7777-4777-8777-777777777777.webp',
  '{}'::jsonb
);
set local role authenticated;
select is(
  public.admin_finish_catalog_storage_cleanup(
    (select (result->>'cleanup_id')::uuid from cleanup_test_result),
    (select (result->>'claim_token')::uuid from cleanup_claim_retry), null
  ),
  false,
  'finish refuses success while the Storage object still exists'
);
reset role;
select ok(
  (select next_attempt_at > now() + interval '3 minutes'
    from private.catalog_storage_cleanup_outbox
    where id = (select (result->>'cleanup_id')::uuid from cleanup_test_result)),
  'repeated failure increases the exponential retry delay'
);
update private.catalog_storage_cleanup_outbox
set next_attempt_at = now()
where id = (select (result->>'cleanup_id')::uuid from cleanup_test_result);
set local role authenticated;
create temporary table cleanup_claim_after_proof as
select public.admin_claim_catalog_storage_cleanup((select (result->>'cleanup_id')::uuid from cleanup_test_result)) as result;
select is((select result->>'outcome' from cleanup_claim_after_proof), 'claimed', 'rejected success leaves the job available for retry');
reset role;
delete from storage.objects
where bucket_id = 'catalog-images'
  and name = 'products/33333333-3333-4333-8333-333333333333/77777777-7777-4777-8777-777777777777.webp';
set local role authenticated;
select ok(public.admin_finish_catalog_storage_cleanup(
  (select (result->>'cleanup_id')::uuid from cleanup_test_result),
  (select (result->>'claim_token')::uuid from cleanup_claim_after_proof), null
), 'successful retry marks the job complete');
select is(
  public.admin_claim_catalog_storage_cleanup((select (result->>'cleanup_id')::uuid from cleanup_test_result))->>'outcome',
  'completed', 'duplicate retry after completion is idempotent'
);

create temporary table cleanup_product_result as
select public.admin_delete_catalog_product('55555555-5555-4555-8555-555555555555') as result;
select is((select result->>'outcome' from cleanup_product_result), 'deleted', 'product deletion creates cleanup ledger entry transactionally');
select is(
  public.admin_delete_catalog_product('55555555-5555-4555-8555-555555555555')->>'outcome',
  'already_deleted', 'duplicate product delete exposes only pending cleanup IDs for retry'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(public.admin_list_catalog_storage_cleanup()->'jobs') as job
    where job->>'product_id' = '55555555-5555-4555-8555-555555555555'
  ),
  'admin can still discover cleanup jobs after the product row is deleted'
);
set local role anon;
select throws_ok($$select * from private.catalog_storage_cleanup_outbox$$, '42501', null, 'anonymous users cannot read the private cleanup outbox');

select * from finish();
rollback;
