# PERF-002 — PLP database performance investigation

**Status:** `NO_CHANGE_RECOMMENDED`

**Branch:** `perf/plp-sql-measure`

**Base:** `8af0f4786d376ac9136f04eb2c8a421bfe157213`

**Date:** 2026-10-13

## Scope and method

Read-only investigation of database calls made by `/loja` and category PLPs. No application SQL, index, migration, fixture, or remote configuration was changed. No synthetic catalog rows or 5,000-row benchmark were created.

The listing page calls `get_catalog_categories()` and `get_catalog_listing(...)`; it also requests published review summaries for the returned product IDs. Authenticated users additionally make a filtered `product_favorites` select for those IDs. Anonymous PLP requests skip that favorites query. The PLP does not call the legacy `get_catalog_products()` listing RPC.

Supabase MCP project metadata returned project `imperiosofas`, ref `qsafyqsskwbjnailgoev`, region `us-east-1`, Postgres 17.6, healthy. That ref matches the previously owner-declared TEST project. The provider metadata itself does not label the project TEST, so this designation is owner-attested rather than independently encoded by Supabase. Read-only catalog checks returned 51 products (51 active), 7 categories, 71 variants, and 107 media rows.

Measurements used only read-only SQL and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against SQL functions verified in `pg_proc` as `STABLE` and inspected as SELECT-only. The function definitions use `SECURITY DEFINER`, so the outer explain plan shows the RPC boundary (`Result`/`Function Scan`) rather than its internal relational nodes. No `pgrst.db_plan_enabled` setting was changed; enabling Data API `.explain()` would require a project configuration write. Server-side execution times below exclude HTTP/PostgREST/client/network latency.

Current Supabase documentation consulted: [Debugging performance issues](https://supabase.com/docs/guides/database/debugging-performance) and [Row Level Security performance](https://supabase.com/docs/guides/database/row-level-security-performance).

## RPC timings

Three sequential measured executions per case were rerun on 2026-10-13 after rechecking the remote function definitions. Values are Postgres `Execution Time`; medians and observed ranges are in milliseconds. The individual planning/execution times and exact SQL appear in [Reproducible evidence](#reproducible-evidence). These are a small-sample snapshot, not p95/p99 or an end-to-end benchmark.

| PLP call / parameters                                   |    Median |   Observed range | Outer plan                     | Buffers / temp                          |
| ------------------------------------------------------- | --------: | ---------------: | ------------------------------ | --------------------------------------- |
| `get_catalog_categories()`                              |  1.202 ms |   1.137–1.229 ms | `Function Scan`, 7 rows        | 400 shared hits, 0 reads; no temp I/O   |
| `get_catalog_listing(NULL, …, 'newest', 1, 12)`         | 11.040 ms | 10.629–12.817 ms | `Result`, 1 JSON row           | 1,574 shared hits, 0 reads; no temp I/O |
| `get_catalog_listing('sofas', …, 'newest', 1, 12)`      |  8.380 ms |   8.259–9.337 ms | `Result`, 1 JSON row           | 1,558 shared hits, 0 reads; no temp I/O |
| `get_catalog_listing(NULL, 'sofa', …, 'newest', 1, 12)` |  8.910 ms |   8.515–9.162 ms | `Result`, 1 JSON row           | 1,587 shared hits, 0 reads; no temp I/O |
| `get_product_review_summary(12 active product IDs)`     |  1.227 ms |   1.166–1.353 ms | `Function Scan`, 1 summary row | 205 shared hits, 0 reads; no temp I/O   |

Planning time stayed below 0.5 ms in the RPC wrappers. No authenticated test identity was supplied, so the user-scoped favorites read was not benchmarked under an invented identity.

## Relational plan evidence

The `sale` aggregation in `get_catalog_listing` was separately explained using the exact read-only relational aggregate expressions from the current remote function definition. It processed the actual 71 variants and 71 inventory rows. The full SQL and raw text-format plan are in [Reproducible evidence](#reproducible-evidence):

| Plan node                   | Actual rows | Actual startup–total (ms) |        Buffers |
| --------------------------- | ----------: | ------------------------: | -------------: |
| Aggregate                   |   51 groups |               0.218–0.318 | 19 shared hits |
| Sort                        |          71 |               0.200–0.206 | 19 shared hits |
| Hash Join                   |          71 |               0.073–0.152 | 13 shared hits |
| Seq Scan `product_variants` |          71 |               0.015–0.076 | 12 shared hits |
| Seq Scan `inventory`        |          71 |               0.011–0.022 |   1 shared hit |

The variant/inventory sequential scans are over 71 rows each and take fractions of a millisecond; at this observed cardinality they are appropriate and do not justify an index. Existing supporting indexes include `products(category_id, status)`, `product_variants(product_id, is_active)`, `inventory(variant_id)` (primary key), `product_media(product_id, position)`, and the partial published-review index `(product_id, created_at DESC)`.

## Findings and verdict

- **Confirmed performance failure:** none observed at the current 51-product catalog size.
- **Potential scaling considerations (not failures):** listing recomputes a sale aggregate over all sellable variants, evaluates substring search, sorts filtered rows, and returns facets/count alongside the page. The current catalog makes this inexpensive. Re-measure with representative organic growth before changing indexes or RPC design; do not infer behavior at 5,000 rows from this sample.
- **N+1:** the PLP issues a bounded listing RPC, one category RPC, and at most one batched review-summary call. Favorites, when authenticated, are fetched with one filtered request for the page IDs. No per-product database call was found in the PLP path.
- **Plan visibility limitation:** the production function’s security-definer boundary hides the internal plan in `EXPLAIN` output. The read-only aggregate subquery plan was captured separately; enabling PostgREST explain was intentionally avoided because it would mutate project configuration. This limits internal plan attribution but not the measured RPC execution time.
- **Decision:** `NO_CHANGE_RECOMMENDED` for the current observed workload. No index or SQL edits are justified by these measurements.

## Reproducible evidence

The prior command output was not available as a raw artifact in this continuation, so the measurements below were safely rerun. SQL function identity was checked first against the owner-declared TEST project. `pg_get_functiondef()` canonical definitions were fingerprinted using PostgreSQL `md5()`; these are provenance fingerprints, not security hashes.

| Remote function                     | Exact identity arguments                                                                                                                                            | Return type                                                           | Attributes before analysis                          | `pg_get_functiondef` chars / MD5          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| `public.get_catalog_categories`     | _(none)_                                                                                                                                                            | `TABLE(slug text, name text, description text)`                       | SQL, `STABLE`, `SECURITY DEFINER`, `search_path=""` | 321 / `95f316a1f53310ab331241f648347b50`  |
| `public.get_catalog_listing`        | `p_category_slug text, p_query text, p_min_price_cents integer, p_max_price_cents integer, p_widths_mm integer[], p_sort text, p_page integer, p_page_size integer` | `jsonb`                                                               | SQL, `STABLE`, `SECURITY DEFINER`, `search_path=""` | 5281 / `a0322ee241d838675c19c91f8c83e58a` |
| `public.get_product_review_summary` | `p_product_ids uuid[]`                                                                                                                                              | `TABLE(product_id uuid, review_count bigint, average_rating numeric)` | SQL, `STABLE`, `SECURITY DEFINER`, `search_path=""` | 512 / `e3c2ab46eb93d51aea54054441b53879`  |

The SQL definitions were inspected as SELECT-only before executing `EXPLAIN ANALYZE`. Project metadata rechecked as `imperiosofas` / `qsafyqsskwbjnailgoev`, Postgres `17.6`; catalog counts remained 51 products (51 active), 7 categories, 71 variants, 107 media.

### Raw remote function-definition evidence

The following source is the literal `pg_get_functiondef(oid)` output returned by Supabase for the TEST-attested project ref above (no application-side reconstruction). Each OID was joined to `pg_proc` and `pg_language` in the same SELECT that returned its identity arguments, return type, `provolatile`, `prosecdef`, `proconfig`, MD5 fingerprint, source length, and a scan of `prosrc` for write/DDL command tokens. All three were SQL-language `STABLE` functions and the scan returned no write/DDL token. The displayed bodies are SELECT/CTE expressions only. These checks were performed before their corresponding `EXPLAIN ANALYZE` runs. The MD5 values are provenance fingerprints, not security hashes. No customer/user rows were queried or included.

**Critical attribution:** the aggregate SQL and raw plan immediately below correspond to the `sale` CTE shown verbatim inside `public.get_catalog_listing(...)` below: it selects from `product_variants`, joins `inventory`, applies the same predicates, and groups by `pv.product_id`. Thus the relational explain is not an unrelated approximation of the function body.

#### `public.get_catalog_categories()`

Remote catalog identity: `get_catalog_categories()` (zero identity arguments); return type `TABLE(slug text, name text, description text)`; `pg_proc.provolatile = s` (**STABLE**); language `sql`; `SECURITY DEFINER = true`; `search_path=""`; definition length 321; PostgreSQL `md5(pg_get_functiondef(oid)) = 95f316a1f53310ab331241f648347b50`; write/DDL-token scan of `prosrc`: none. Metadata, scan result, fingerprint, and source below were selected in the same read-only query from this function OID.

```sql
CREATE OR REPLACE FUNCTION public.get_catalog_categories()
 RETURNS TABLE(slug text, name text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.slug, c.name, c.description
  from public.categories as c
  where c.is_active
  order by c.position, c.name;
$function$
```

#### `public.get_catalog_listing(p_category_slug text, p_query text, p_min_price_cents integer, p_max_price_cents integer, p_widths_mm integer[], p_sort text, p_page integer, p_page_size integer)`

Remote catalog identity: `get_catalog_listing(p_category_slug text, p_query text, p_min_price_cents integer, p_max_price_cents integer, p_widths_mm integer[], p_sort text, p_page integer, p_page_size integer)`; return type `jsonb`; `pg_proc.provolatile = s` (**STABLE**); language `sql`; `SECURITY DEFINER = true`; `search_path=""`; definition length 5281; PostgreSQL `md5(pg_get_functiondef(oid)) = a0322ee241d838675c19c91f8c83e58a`; write/DDL-token scan of `prosrc`: none. Metadata, scan result, fingerprint, and source below were selected in the same read-only query from this function OID.

```sql
CREATE OR REPLACE FUNCTION public.get_catalog_listing(p_category_slug text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_min_price_cents integer DEFAULT NULL::integer, p_max_price_cents integer DEFAULT NULL::integer, p_widths_mm integer[] DEFAULT NULL::integer[], p_sort text DEFAULT 'newest'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with sale as (
    select pv.product_id,
      min(pv.width_mm)::integer as width_mm,
      coalesce(array_agg(distinct pv.width_mm order by pv.width_mm)
        filter (where pv.width_mm is not null and pv.width_mm > 0), '{}'::integer[]) as widths_mm,
      min(pv.price_cents)::integer as price_cents,
      max(pv.price_cents)::integer as max_price_cents,
      count(distinct pv.price_cents)::integer as price_count,
      bool_and(i.low_stock_threshold > 0
        and i.on_hand - i.reserved <= i.low_stock_threshold) as all_sellable_low_stock
    from public.product_variants pv
    join public.inventory i on i.variant_id = pv.id
    where pv.is_active and nullif(trim(pv.sku), '') is not null
      and pv.price_cents > 0 and i.on_hand > i.reserved
    group by pv.product_id
  ), base as (
    select p.id, p.slug, p.name, p.description, p.created_at,
      c.slug as category_slug, sale.width_mm, sale.widths_mm,
      sale.price_cents, sale.max_price_cents, sale.price_count,
      sale.all_sellable_low_stock
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    join sale on sale.product_id = p.id
    where p.status = 'active'
      and (p_category_slug is null or c.slug = p_category_slug)
      and (nullif(trim(p_query), '') is null
        or position(lower(left(trim(p_query), 100)) in lower(p.name)) > 0
        or exists (
          select 1 from public.product_variants search_variant
          join public.inventory search_stock on search_stock.variant_id = search_variant.id
          where search_variant.product_id = p.id and search_variant.is_active
            and nullif(trim(search_variant.sku), '') is not null
            and search_variant.price_cents > 0 and search_stock.on_hand > search_stock.reserved
            and (position(lower(left(trim(p_query), 100)) in lower(coalesce(search_variant.fabric, ''))) > 0
              or position(lower(left(trim(p_query), 100)) in lower(coalesce(search_variant.color, ''))) > 0
              or position(lower(left(trim(p_query), 100)) in lower(search_variant.sku)) > 0)
        ))
  ), filtered as (
    select * from base
    where (p_min_price_cents is null or max_price_cents >= p_min_price_cents)
      and (p_max_price_cents is null or price_cents <= p_max_price_cents)
      and (p_widths_mm is null or cardinality(p_widths_mm) = 0 or widths_mm && p_widths_mm)
  ), ordered as (
    select *, row_number() over (
      order by
        case when p_sort = 'price_asc' then price_cents end asc,
        case when p_sort = 'price_desc' then price_cents end desc,
        case when p_sort = 'name_asc' then name end asc,
        case when p_sort not in ('price_asc', 'price_desc', 'name_asc') then created_at end desc,
        id asc
    ) as ordinal
    from filtered
  ), paged as (
    select * from ordered
    where ordinal > (greatest(1, least(coalesce(p_page, 1), 100000)) - 1)
      * greatest(1, least(coalesce(p_page_size, 12), 24))
      and ordinal <= greatest(1, least(coalesce(p_page, 1), 100000))
      * greatest(1, least(coalesce(p_page_size, 12), 24))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'widths', coalesce((
      select jsonb_agg(jsonb_build_object('width_mm', width_mm, 'count', product_count) order by width_mm)
      from (
        select w.width_mm, count(*) as product_count
        from base b cross join lateral unnest(b.widths_mm) w(width_mm)
        group by w.width_mm
      ) facets
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pg.id, 'slug', pg.slug, 'name', pg.name,
        'description', pg.description, 'category_slug', pg.category_slug,
        'width_mm', pg.width_mm, 'widths_mm', pg.widths_mm,
        'price_cents', pg.price_cents, 'max_price_cents', pg.max_price_cents,
        'price_count', pg.price_count,
        'stock_status', case when pg.all_sellable_low_stock then 'low_stock' else 'available' end,
        'media', coalesce(media.items, '[]'::jsonb)
      ) order by pg.ordinal)
      from paged pg
      left join lateral (
        select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'alt', m.alt_text) order by m.position, m.id) as items
        from public.product_media m
        where m.product_id = pg.id and (m.variant_id is null or exists (
          select 1 from public.product_variants mv
          join public.inventory mi on mi.variant_id = mv.id
          where mv.id = m.variant_id and mv.product_id = pg.id and mv.is_active
            and nullif(trim(mv.sku), '') is not null and mv.price_cents > 0
            and mi.on_hand > mi.reserved
        ))
      ) media on true
    ), '[]'::jsonb)
  );
$function$
```

#### `public.get_product_review_summary(p_product_ids uuid[])`

Remote catalog identity: `get_product_review_summary(p_product_ids uuid[])`; return type `TABLE(product_id uuid, review_count bigint, average_rating numeric)`; `pg_proc.provolatile = s` (**STABLE**); language `sql`; `SECURITY DEFINER = true`; `search_path=""`; definition length 512; PostgreSQL `md5(pg_get_functiondef(oid)) = e3c2ab46eb93d51aea54054441b53879`; write/DDL-token scan of `prosrc`: none. Metadata, scan result, fingerprint, and source below were selected in the same read-only query from this function OID.

```sql
CREATE OR REPLACE FUNCTION public.get_product_review_summary(p_product_ids uuid[])
 RETURNS TABLE(product_id uuid, review_count bigint, average_rating numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.product_id, count(*)::bigint, round(avg(r.rating), 1)
  from public.product_reviews r join public.products p on p.id = r.product_id
  where r.status = 'published' and p.status = 'active'
    and r.product_id = any(p_product_ids)
  group by r.product_id;
$function$
```

### Exact statements and raw timing samples

The exact statements sent to the read-only SQL interface were:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM public.get_catalog_categories();
```

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT public.get_catalog_listing(NULL, NULL, NULL, NULL, NULL, 'newest', 1, 12);
```

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT public.get_catalog_listing('sofas', NULL, NULL, NULL, NULL, 'newest', 1, 12);
```

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT public.get_catalog_listing(NULL, 'sofa', NULL, NULL, NULL, 'newest', 1, 12);
```

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM public.get_product_review_summary(
  ARRAY(
    SELECT id
    FROM public.products
    WHERE status = 'active'
    ORDER BY id
    LIMIT 12
  )
);
```

In RPC terms, the listing cases used these exact parameters in order: `(NULL, NULL, NULL, NULL, NULL, 'newest', 1, 12)`, `('sofas', NULL, NULL, NULL, NULL, 'newest', 1, 12)`, and `(NULL, 'sofa', NULL, NULL, NULL, 'newest', 1, 12)`. Review-summary input was the first 12 active product UUIDs ordered by `id`; IDs and returned business data are intentionally omitted.

Raw planning/execution milliseconds (`planning / execution`), in run order:

| Statement                |            Run 1 |            Run 2 |            Run 3 |
| ------------------------ | ---------------: | ---------------: | ---------------: |
| Categories               |  `0.043 / 1.202` |  `0.044 / 1.137` |  `0.055 / 1.229` |
| Listing, all categories  | `0.032 / 12.817` | `0.031 / 10.629` | `0.036 / 11.040` |
| Listing, `sofas`         |  `0.031 / 8.380` |  `0.033 / 9.337` |  `0.032 / 8.259` |
| Listing, search `sofa`   |  `0.030 / 8.910` |  `0.032 / 9.162` |  `0.050 / 8.515` |
| Review summary, 12 UUIDs |  `0.435 / 1.353` |  `0.429 / 1.166` |  `0.500 / 1.227` |

For each case all three runs had zero shared reads, zero temp reads/writes, and constant shared-hit counts: categories 400; all-category listing 1574; `sofas` listing 1558; search listing 1587; review summary 205. The wrapper plan roots were respectively `Function Scan` (7 rows), `Result` (1 row), `Result` (1 row), `Result` (1 row), and `Function Scan` (1 row). Because these SQL functions are security-definer, those wrapper plans do not expose nested statements.

### Aggregate query and complete EXPLAIN output

The following SELECT is the `sale` aggregate in the verified `get_catalog_listing` definition, run directly to expose relational plan nodes. It does not mutate catalog data.

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT pv.product_id,
       min(pv.width_mm)::integer AS width_mm,
       coalesce(array_agg(DISTINCT pv.width_mm ORDER BY pv.width_mm)
         FILTER (WHERE pv.width_mm IS NOT NULL AND pv.width_mm > 0), '{}'::integer[]) AS widths_mm,
       min(pv.price_cents)::integer AS price_cents,
       max(pv.price_cents)::integer AS max_price_cents,
       count(DISTINCT pv.price_cents)::integer AS price_count,
       bool_and(i.low_stock_threshold > 0
         AND i.on_hand - i.reserved <= i.low_stock_threshold) AS all_sellable_low_stock
FROM public.product_variants pv
JOIN public.inventory i ON i.variant_id = pv.id
WHERE pv.is_active
  AND nullif(trim(pv.sku), '') IS NOT NULL
  AND pv.price_cents > 0
  AND i.on_hand > i.reserved
GROUP BY pv.product_id;
```

Raw `EXPLAIN ANALYZE` output:

```text
GroupAggregate  (cost=15.95..16.90 rows=21 width=65) (actual time=0.218..0.318 rows=51 loops=1)
  Group Key: pv.product_id
  Buffers: shared hit=19
  ->  Sort  (cost=15.95..16.00 rows=21 width=36) (actual time=0.200..0.206 rows=71 loops=1)
        Sort Key: pv.product_id, pv.width_mm
        Sort Method: quicksort  Memory: 28kB
        Buffers: shared hit=19
        ->  Hash Join  (cost=2.05..15.49 rows=21 width=36) (actual time=0.073..0.152 rows=71 loops=1)
              Hash Cond: (pv.id = i.variant_id)
              Buffers: shared hit=13
              ->  Seq Scan on product_variants pv  (cost=0.00..13.24 rows=71 width=40) (actual time=0.015..0.076 rows=71 loops=1)
                    Filter: (is_active AND (price_cents > 0) AND (NULLIF(TRIM(BOTH FROM sku), ''::text) IS NOT NULL))
                    Buffers: shared hit=12
              ->  Hash  (cost=1.79..1.79 rows=21 width=28) (actual time=0.044..0.044 rows=71 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 13kB
                    Buffers: shared hit=1
                    ->  Seq Scan on inventory i  (cost=0.00..1.79 rows=21 width=28) (actual time=0.011..0.022 rows=71 loops=1)
                          Filter: (on_hand > reserved)
                          Buffers: shared hit=1
Planning:
  Buffers: shared hit=272
Planning Time: 0.904 ms
Execution Time: 0.497 ms
```

## Safety, isolation, and review

- Supabase project ref matched the previously owner-declared TEST project; only read-only catalog metadata, `SELECT`, and `EXPLAIN ANALYZE` of verified `STABLE` SELECT-only functions were used.
- No writes, fixtures, migration, index change, project setting change, integration, push, deploy, Vercel, or production access occurred.
- The worktree was created separately at the requested path and exact base commit. The pre-existing `perf/plp-db-performance` candidate branch/worktree was not touched.
- An independent reviewer rejected the updated report on provenance because raw function-body evidence was missing. The evidence below has now been added from a fresh read-only `pg_get_functiondef` query. A fresh independent review is requested; its result is pending. No approval is claimed.

## Evidence summary

```text
PROJECT_REF_MATCH = YES
TEST_IDENTITY = OWNER_ATTESTED (project metadata does not label TEST)
PRODUCTS = 51 (51 active)
CATEGORIES = 7
VARIANTS = 71
MEDIA = 107
PLP_RPC_TIMINGS = COLLECTED (3 runs per case)
EXPLAIN_ANALYZE = READ_ONLY SELECT/STABLE FUNCTIONS ONLY
SCALING_FIXTURES = NONE
SQL_OR_INDEX_CHANGES = NONE
VERDICT = NO_CHANGE_RECOMMENDED
PEER_REVIEW = PENDING (fresh independent review requested after adding raw remote function definitions)
REMOTE_WRITES = NONE
```
