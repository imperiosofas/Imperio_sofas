# DB-002 — Catalog Storage cleanup integrity

**Branch:** `codex/final-db002`  
**Base:** `8af0f47`  
**Status:** implementation prepared; migration deliberately not applied.

## Finding and change

The old product-delete flow deleted `product_media` and the product in Postgres, then called Storage `remove`. If Storage failed, the database no longer retained a durable retry path. The single-image flow had the same ordering and ignored the Storage error.

The candidate migration adds a private `catalog_storage_cleanup_outbox`. Authorized delete RPCs enqueue a row transactionally before deleting metadata. Each row is bound to its source media UUID, product UUID, fixed `catalog-images` bucket, and a strict product-scoped object path. Claim/finish RPCs issue short-lived claim tokens, track attempts, make failures retryable, and make duplicate completed work idempotent. A protected admin page uses stable `(created_at, id)` keyset pagination (25 jobs per page), with an explicit continuation cursor and no overall cap; admins can traverse the entire pending queue independently of product/media rows and retry by opaque cleanup UUID. The list RPC returns `retry_ready`, computed against database `now()`, so render-time UI checks and retry-button disabled state use a stable server-derived value instead of `Date.now()`. Product deletion can also be repeated to rediscover pending jobs; repeating single-media removal returns its existing job. Storage is still removed only through the Supabase Storage API.

The app-side worker uses the authenticated admin session already required by `requireCatalogAdmin`; it receives a path only from the database claim RPC, verifies the product-scoped path again, checks exact object existence, calls `storage.from("catalog-images").remove([path])`, verifies absence again, then records success/failure. The finish RPC no longer accepts a client-supplied success boolean: its security-definer body checks `storage.objects` for the exact bucket/path and completes only if that row is absent; otherwise it returns the job to pending. An already-missing object is treated as complete. Every failed attempt gets a database-enforced exponential cooldown starting at two minutes, doubling per attempt and capped at 24 hours; early claims return busy before the app contacts Storage. Storage errors are reduced to fixed error codes; the object path and raw provider error are not logged or persisted as diagnostic text.

## Supabase security review

- Admin authorization: each public RPC checks `private.is_catalog_admin()`; grants are revoked from `PUBLIC` and `anon`, then granted only to `authenticated` where needed.
- Outbox: lives in `private`, RLS enabled, no table privileges for `PUBLIC`, `anon`, or `authenticated`; no client-side direct access.
- Ownership: enqueue validates the exact `product_media` row, media UUID, product UUID, and path prefix/filename format before creating a job. A foreign product/media pair is rejected.
- Bucket/path: bucket ID is fixed to `catalog-images`; the bucket's private setting and existing Storage policies are unchanged. The app never accepts an arbitrary path from form data.
- Privileged keys: no secret/service-role client or environment key was added or referenced. The worker uses the authenticated request client only.
- RLS/MFA: no existing catalog or Storage policy is weakened; no MFA setting or migration state was changed.
- SQL never deletes from `storage.objects`; only the Storage API removes objects, consistent with [Supabase Delete Objects](https://supabase.com/docs/guides/storage/management/delete-objects).
- Completion proof reads the exact `storage.objects` metadata row only; Supabase documents Storage metadata as read-only and permits direct reads, while all object operations remain API-only ([Storage schema](https://supabase.com/docs/guides/storage/schema/design)).

The public `SECURITY DEFINER` RPCs are intentionally narrow, pin `search_path` to empty, explicitly re-check admin membership, and have execution privileges revoked from public/anonymous roles. The internal enqueue helper is private and has no role grants.

## Tests and gates

| Check                 | Result              | Notes                                                                                                                                                                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cleanup unit tests    | PASS (9/9)          | `node --test tests/catalog-storage-cleanup.test.mjs`; covers retry by durable ID after metadata deletion, object-still-present refusal, and no Storage call when a claim is busy                       |
| pgTAP migration tests | NOT RUN             | Migration is intentionally unapplied; 32 assertions cover admin pagination, DB-derived retry readiness, post-deletion discovery, exponential backoff, auth, ownership, and the `storage.objects` proof |
| Typecheck             | BLOCKED_ENVIRONMENT | Worktree had no dependencies. Interrupted `npm ci` left an incomplete local install; direct `tsc` could not resolve Next types/CSS. The new helper had no reported type errors.                        |
| ESLint                | BLOCKED_ENVIRONMENT | Could not complete with the incomplete dependency tree; stopped instead of using ad hoc package versions.                                                                                              |
| Prettier              | PASS                | Targeted changed app/test/report files checked; formatted only the admin cleanup page and this report. SQL has no parser in configured Prettier.                                                       |
| Build                 | BLOCKED_ENVIRONMENT | Not run: incomplete dependency install / missing Next package types.                                                                                                                                   |
| Remote DB / Storage   | NOT TOUCHED         | No remote query or mutation in this task                                                                                                                                                               |

## Preserved workspace state

At task start, the supplied migration path existed as an untracked, zero-byte file and `supabase/.temp/` contained the pre-existing `cli-latest` artifact. The migration was filled in place rather than removed or replaced. `.temp/` was not read beyond its entry name, modified, or cleaned. The base branch is unchanged; all implementation is in this isolated worktree.

## Apply plan (owner-controlled)

1. Review the migration and pgTAP test diff.
2. Apply the migration only to an approved local database/test environment; do not use `db reset` as part of this change.
3. Run `supabase test db` against that disposable/local database and require all 32 assertions to pass.
4. Verify `catalog-images` is still private and the existing product-media/admin Storage policies are unchanged.
5. Exercise a product-image delete with the Storage API available, force a Storage API failure, and confirm the outbox remains pending and the admin repeat action completes it on retry.
6. Only after those checks, consider integrating the branch. No migration application, remote mutation, push, deploy, or Vercel operation is authorized by this task.

## Current conclusion

The independent reviews approved the implementation with caveats: pending work is reachable from the admin navigation and keyset pagination has no overall row cap; retries are database-throttled with bounded exponential backoff; finish success is based on a server-side absence query rather than caller input; and retry readiness is derived from database time instead of impure render-time clock calls. The implementation commits are `430899c` and follow-up `e4c9c47`, integrated on `integration/final-hardening`. pgTAP/runtime validation remains **BLOCKED_ENVIRONMENT** because Supabase CLI, Docker, and `psql` are unavailable. The migration has **not** been applied to local or remote Supabase; do not apply it until it passes on a disposable local Supabase instance, including owner permissions for the exact `storage.objects` read. No push or deployment occurred.
