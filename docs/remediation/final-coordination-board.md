# Final hardening coordination board

Date: 2026-10-13

## Coordinator first return

| Field                      | State                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BASE_COMMIT                | `8af0f47` (`feat: validate atomic cart and stock privacy`)                                                                                                                            |
| CURRENT_INTEGRATION_BRANCH | `integration/audit-remediation` — worktree has pre-existing tracked and untracked changes; preserved untouched                                                                        |
| FINAL_INTEGRATION_BRANCH   | `integration/final-hardening` — clean worktree created from exactly `8af0f47`                                                                                                         |
| WORKTREE_SAFE              | YES — isolated integration tree is clean; original tree remains untouched                                                                                                             |
| EXISTING_CANDIDATES_FOUND  | YES — inventoried below; candidates at `b13a344` or earlier, mostly dirty/unreviewed/blocked; none are approved for direct integration into this final wave                           |
| CLOSED_FINDINGS_CONFIRMED  | DEP-001, TEST-001, NAV-001/NAV-002/AUTH-001, DB-001, DATA-001, CODE-001, CODE-002 (revalidate at final gate)                                                                          |
| PENDING_FINDINGS           | PERF-001 (BLOCKED_ENVIRONMENT), SEC-001 (BLOCKED_OWNER), DB-002 local pgTAP/runtime proof (BLOCKED_ENVIRONMENT), BUNDLE-001 (BLOCKED_ENVIRONMENT), DOC-001/DX-001/CODE-004 (DEFERRED) |
| CONFLICT_MATRIX_READY      | YES — see `final-conflict-matrix.md`                                                                                                                                                  |
| WAVE1_AGENTS               | Image performance; Admin performance; Auth hardening; PLP DB measurement                                                                                                              |
| WAVE2_AGENTS               | Dependency review; Landing architecture; Storage integrity; Runtime config; Accessibility                                                                                             |
| OWNER_ACTIONS_REQUIRED     | SEC-001 only if the official setting requires dashboard/planning action; no MFA reactivation; all work restricted to the declared TEST/DEV Supabase                                   |

## Worktree and change preservation

The active original integration worktree is dirty. It contains 20 tracked modifications and untracked artifacts/reports including `.next-*`, `docs/qa/`, and `supabase/.temp/`. No cleanup, restore, staging, or application edits were performed there. The separate `integration/final-hardening` worktree is based on `8af0f47` and starts clean.

Existing implementation worktrees were checked. Available candidates include `perf/store-images`, `perf/admin-catalog`, `perf/plp-db-performance`, `fix/dependency-advisories`, `fix/editorial-catalog-source`, `chore/docs-current-state`, and previously completed foundation/navigation/import/security worktrees. Several are dirty; current reports classify image/admin/PLP/dependency/editorial/docs candidates as blocked or incomplete. Candidate worktrees based at `b13a344` are stale relative to `8af0f47`; their reports/designs may be reused as evidence, but their code is not considered approved or integrated. The `fix/foundation-next` worktree has broad uncommitted changes and is explicitly excluded from candidate reuse.

## Environment snapshot

- `.env.local` exists in the original integration checkout; `SUPABASE_SECRET_KEY` is present, and the file is ignored by Git. No value was read into output or passed to a client.
- Connected Supabase project identity matches the owner-declared TEST/DEV project `imperiosofas` (`qsafyqsskwbjnailgoev`), state `ACTIVE_HEALTHY`.
- Remote migration inventory is aligned through `20261013220402` (`atomic_cart_add`); 23 entries are listed, including stock privacy and atomic cart migrations.
- Storage bucket `catalog-images` is confirmed private (`public=false`).
- Supabase table inventory reports 7 categories, 51 products, 71 variants, 71 inventory rows, and 107 product-media rows; all listed commerce/catalog tables have RLS enabled. These are aggregate/schema facts only; no customer row content was read.

## Closed items to revalidate, not reimplement

- DEP-001: Next 16.3.8 foundation update.
- TEST-001: deterministic E2E suite (previously 31/31).
- NAV-001/NAV-002/AUTH-001: previously integrated navigation/loading behavior.
- DB-001: migration history alignment.
- DATA-001: customer stock privacy.
- CODE-001: atomic cart increment.
- CODE-002: importer dry-run safety.

The `8af0f47` integration commit includes CODE-001 and DATA-001 validation. Prior summaries report local TEST Supabase migrations applied and pgTAP/concurrency passing. This wave will not rerun or mutate Supabase until credential/environment availability and project identity are verified without exposing secrets; database work remains limited to the owner-declared TEST/DEV project.

## Finding matrix and status policy

Each finding transitions through READY → IN_PROGRESS → REVIEW (plus security/performance review where applicable) → APPROVED → MERGED. Failed gates return to the implementer as REJECTED. Environment limitations are BLOCKED_ENVIRONMENT, owner-controlled external settings are BLOCKED_OWNER. Measure-first findings can conclude NO_CHANGE_RECOMMENDED with evidence.

| Finding                                | Initial disposition                                                                              | Required independent review            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| LAT-001 private catalog image delivery | READY after paired baseline measurement                                                          | Code + security + performance          |
| PERF-001 admin server pagination       | READY only with safe authenticated admin session; otherwise blocked with concrete evidence plan  | Code + security + performance          |
| SEC-001 leaked-password protection     | Verify feature/plan/API; dashboard change only if official, safe, TEST-only and no surprise cost | Code + security                        |
| PERF-002 PLP SQL                       | Measure only; no speculative SQL/index change                                                    | DB + security + performance if changed |
| DEP-002 dependency advisories          | Revalidate current lockfile/audits; reuse candidate findings, not unapproved diff                | Code + security                        |
| ARCH-001 landing commercial source     | Preserve visual/motion; derive commercial fields only from catalog                               | Code + security + E2E                  |
| DB-002 Storage cleanup                 | Design/review before schema work; migration only after proof and safe cleanup plan               | Code + security + DB                   |
| ENV-001 runtime configuration          | Explicit dev/test/future-production behavior and tests                                           | Code + security                        |
| Accessibility contrast                 | Fix only reproduced issues; preserve identity/motion                                             | Accessibility + E2E                    |
| DOC/DX/CODE-004                        | Update docs/ignore/helper only for verified facts; never delete artifacts                        | Code + security for code helper        |
| BUNDLE-001                             | Measure route impact first; no change if marginal                                                | Performance                            |

## Wave 1 final dispositions

| Finding  | Agent     | Branch / isolated worktree                                     | Status                                                                                                                                                                                                                                                                    |
| -------- | --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAT-001  | Confucius | `perf/store-images-final` / `imperio-sofas-vale-lat001`        | APPROVED WITH CAVEATS — code, security, and performance reviews approved; 3 reload samples at 390×844/Fast 3G/CPU 4× show p50 image elements 17→10 and page-wide signed image requests 19→12; exact bytes and per-request attribution unavailable; LCP delta inconclusive |
| PERF-001 | Parfit    | `perf/admin-server-pagination` / `imperio-sofas-vale-perf001`  | BLOCKED_ENVIRONMENT — local `/admin/produtos` redirects to `/conta?next=%2Fadmin`; no already-authorized admin session, so no private catalog/admin benchmark or speculative pagination                                                                                   |
| SEC-001  | Carson    | `fix/leaked-password-protection` / `imperio-sofas-vale-sec001` | OWNER_ACTION_REQUIRED — current Supabase plan is Free; feature requires Pro+; independent security review APPROVE; no setting/MFA change                                                                                                                                  |
| PERF-002 | Aristotle | `perf/plp-sql-measure` / `imperio-sofas-vale-perf002`          | NO_CHANGE_RECOMMENDED — independent review APPROVE; 3 runs per read-only RPC case and current 51-product/71-variant sample do not justify SQL/index changes                                                                                                               |

## Wave 2 assignments

| Finding       | Agent                              | Branch / isolated worktree                                     | Status                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEP-002       | Lorentz                            | `codex/final-dep002` / `imperio-sofas-vale-final-dep002`       | INTEGRATED — approved sharp update and advisory evidence; commit `0d5d604`, report cleanup `24a7053`                                                                                                                                           |
| ARCH-001      | Hooke / Archimedes                 | `codex/final-arch001` / `imperio-sofas-vale-final-arch001`     | INTEGRATED WITH CAVEATS — commit `9e6ca15`; independent review APPROVE WITH CAVEATS. Full source manifest is unavailable for re-hashing in this checkout, and local E2E has no published Supabase fixture; the provenance subset is committed. |
| DB-002        | Darwin / Kant / Einstein / Aquinas | `codex/final-db002` / `imperio-sofas-vale-final-db002`         | INTEGRATED WITH CAVEATS — commits `14ea830`, `4fd0343`; retries are paginated, backed off, and server-verified. Independent reviews APPROVE WITH CAVEATS; pgTAP is BLOCKED_ENVIRONMENT; migration remains unapplied.                           |
| ENV-001       | Locke / reviewer Halley            | `codex/final-env001` / `imperio-sofas-vale-final-env001`       | APPROVED + INTEGRATED — code/security APPROVE; commit `d82937b`; production must set `APP_ENV=production` and run `npm run check:production`                                                                                                   |
| Accessibility | Ohm / Dirac                        | `codex/final-a11y` / `imperio-sofas-vale-final-a11y`           | INTEGRATED — commit `f2d8f45`; only the two reproduced footer/location text opacities changed; independent review APPROVE; focused and final Axe E2E have zero violations on `/`, `/loja`, `/conta`.                                           |
| BUNDLE-001    | Plato                              | `codex/final-bundle001` / `imperio-sofas-vale-final-bundle001` | BLOCKED_ENVIRONMENT — route measurements not completed because concurrent dependency installs left candidate dependencies unavailable; no code/report change                                                                                   |

## Integration and execution rules

- Implementers use isolated branches/worktrees based on this final integration HEAD; ownership is disjoint per `final-conflict-matrix.md`.
- Every implementation has a different read-only code reviewer; security-sensitive work has a separate security reviewer.
- No self-approval, no patching rejected work directly on integration.
- No push, deployment, Vercel access, `main` merge, destructive reset, mass format, bucket-public change, RLS weakening, MFA reactivation, or commercial-term invention.
- Test Supabase fixtures require before-count inventory, stable `TEST_` identifiers, guaranteed cleanup, after-count verification, and migration record. Never delete legitimate rows.
- Wave 2 starts only after all Wave 1 work is approved or explicitly classified BLOCKED/NO_CHANGE with evidence and no unresolved conflict.
- Final completion requires all hard gates in the task prompt; blocked environment/owner states must be surfaced, not relabeled PASS.
