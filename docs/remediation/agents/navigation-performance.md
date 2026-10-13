# Navigation and account feedback workstream

Date: 2026-10-13
Branch: `perf/navigation-rsc`
Starting HEAD: `c3c6fe695d71f75f4a4c192f6c2fa7fe702bb5a2`

## Scope delivered

- Added route-local App Router `loading.tsx` boundaries for `/loja/[categoria]`, `/produto/[slug]` and `/admin/produtos/[id]`. Shared skeletons are responsive, screen-reader announced, and disable shimmer under reduced motion. The admin fallback is nested inside `AdminShell`; route/layout/action authorization was not changed.
- Replaced the profile email-change anchor with `next/link` to `/conta/seguranca#email`, preserving the target fragment.
- Removed pathname-driven cart-summary refresh from `BottomNavigation`. It now makes one initial read, refreshes after sign-in and the existing `cart:changed` event, and clears on sign-out. Request generations prevent a response from an earlier auth state or superseded cart read from overwriting the current badge.
- No edits to `tests/e2e/**`, commerce actions, migrations, `CatalogProductGrid.tsx`, Supabase data, or deployment configuration.

## Measurements

Harness was the same Playwright browser page and test code before and after, touch emulation at 390×844, local Next development server, settled home route, tap/click on the bottom-nav `Loja` destination. “Feedback” is the first observed >1 CSS px movement of the gold bead. “Content” is the first observation of URL `/loja` together with `main h1=Loja`. Request count is `GET /api/cart/summary` started during the click-to-content transition. The Supabase URL was an invalid local-only endpoint; no remote service was contacted.

| Measurement                             | Before |                 After | Interpretation                                                                                                                                                    |
| --------------------------------------- | -----: | --------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click → motion feedback                 | 101 ms | 153 ms; repeat 203 ms | No improvement established; development timing varied.                                                                                                            |
| Click → `/loja` heading                 | 416 ms | 870 ms; repeat 935 ms | Slower in the two after samples; no speedup claim. Dev compilation/streaming and browser-sampling variance make these unsuitable as production latency estimates. |
| Cart-summary requests during navigation |      2 |                     0 | Confirmed reduction: route transitions no longer trigger cart-summary reads.                                                                                      |

The two timing metrics are reported as observed, not as a performance win. A production-build trace is still needed before making a route-latency claim. The user-visible route loading fallback is structurally provided by Next's segment boundary; the category route was prefetched in browser QA, so the transient skeleton itself was not reliably visible during that navigation.

## Behavioral checks

- Local response interception returned `authenticated: true` and a cart count. After the initial summary response, navigation to Loja, changing sort to `?sort=price_asc`, navigating to Conta, and browser Back produced zero additional summary requests. The query string and cart badge were preserved.
- Dispatching the existing `cart:changed` event caused exactly one summary request and updated the badge to the returned count. A separate settled-page check observed one initial summary request.
- `/loja/sofas` returned HTTP 200 with heading `Sofás`. Admin route access was not browser-tested because no authenticated admin session was used; its authorization code was left unchanged.
- In the original navigation workstream, no E2E tests were edited or executed because that surface belongs to TEST-001. The later NAV-001 follow-up below ran the existing focused dock test unchanged.

## Validation

- `npm ci`: no longer blocking; install completed sufficiently to run checks, and `npm ls next --depth=0` reports `next@16.3.8`. No npm install process remained active.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors; 2 pre-existing `<img>` warnings in `StorePhoto.tsx` and `sections/Catalog.tsx`.
- `npm run format:check`: PASS after all source and documentation edits.
- `npm run build`: PASS; Next 16.3.8 compiled, typechecked, generated static pages, and listed the category, PDP and admin product routes as dynamic.

No commit, push, merge, remote write, deploy, migration, or additional agent was used.

## NAV-001 follow-up — initial touch-dock bead measurement

The integration regression was reported and reproduced at 390×844 touch: the
dock was 390px wide and the active `/` link center was 48.75px while the bead
remained at x=0 with opacity 0. `BottomNavigation` now stores dock width in
React state, measures synchronously in `useLayoutEffect` before paint, and uses
`ResizeObserver` for later changes. No synthetic resize is required.

Added a separate focused test, `tests/e2e/navigation-initial-indicator.spec.ts`;
existing TEST-001 files and assertions remain untouched. It asserts first
navigation at exactly 390×844 touch, Home active, bead opacity 1, and bead/link
centers within 1px. It performs no viewport resize. The separate
`playwright.navigation.config.ts` starts the existing production build on
loopback with inherited variables blanked, `.env*` key names neutralized,
Supabase values set to empty/local-only values, and only a minimal OS variable
allowlist restored. The browser test blocks all non-loopback requests and
`/api/cart/summary`.

**Targeted result:** `npx playwright test --config
playwright.navigation.config.ts` — **1 passed**. The test checks geometry after
the first hydration-visible state and observed offset 0px (bead center 48.75px,
Home center 48.75px); no synthetic resize was dispatched. No remote service,
Supabase call/write, or deployment was used.

**Gates:** typecheck PASS; lint PASS (2 pre-existing `<img>` warnings); format
PASS, including the new config and test; production build PASS. The build emits
two generated-CSS optimization warnings for transformed utility classes; this
is separate from the nav change. A separate ordinary dev-server E2E attempt is
blocked by a Turbopack generated-CSS parse error, so only the isolated
production-build test is counted as E2E proof.

Generated `next-env.d.ts` and `tsconfig.json` references were restored to their
pre-build state. Generated build outputs were preserved, not cleaned. No
commit, push, merge, migration, remote write, or deployment was performed.

### Security-review follow-up — scrub before Playwright runner startup

The reviewer correctly noted that scrubbing only `webServer.env` does not
sanitize the Playwright config/runner or its workers. Added
`scripts/run-isolated-navigation-playwright.mjs` as the required entrypoint:
it constructs a fresh child environment from a narrow Windows OS/runtime
allowlist, blanks keys found in local `.env*` files, adds only local test
values, then starts the Playwright CLI. The config process inherits only this
sanitized environment; the web server and workers inherit from that runner.
The runner config and test worker both fail if a seeded throwaway inherited
sentinel reaches them. The sentinel value is not logged.

**Security recheck:** focused E2E passed **1/1** through the wrapper; both
runner and worker sentinel assertions passed. Browser requests remain restricted
to loopback and `/api/cart/summary` is blocked. No secret is logged, and no
remote request/write is part of the test.

**Sanitized gates:** `npm run typecheck` PASS; `npm run lint` PASS (2 existing
`<img>` warnings); `npm run format:check` PASS; dedicated Prettier check PASS;
`npm run build` PASS. Build repeated the two generated-CSS optimization
warnings noted above. The build temporarily modified `next-env.d.ts` and
`tsconfig.json`; both were restored to their pre-run contents afterward.

### Independent review follow-up — build provenance and read-only formatting

The focused Playwright wrapper and sanitized gate script now both set
`NEXT_DIST_DIR=.next-nav-security-review`. The build creates that fresh output
and Playwright's `next start` serves that exact output; earlier `.next-nav-*`
directories were neither reused nor removed. Verification sequence: sanitized
`npm run build` PASS, then `node
scripts/run-isolated-navigation-playwright.mjs --config
playwright.navigation.config.ts` PASS (**1/1**) against the same directory.

The `-FormatOnly` branch uses the project's `npm run format:check` plus
read-only `prettier --check` for the changed config, test, runner, and report.
It performs no formatting writes and does not check or modify `tsconfig.json`.
Generated references in `next-env.d.ts` and `tsconfig.json` remain restored.

The gate runner snapshots the full caller process environment and current
location before sanitizing/changing either, then restores both in `finally`.
Location-restore errors are suppressed so they cannot mask an original gate
failure. A harmless sentinel and caller cwd were checked after successful
`-FormatOnly` and after an intentional first-gate failure:
`SUCCESS_ENV_AND_CWD_RESTORE=PASS`, `FAILURE_ENV_AND_CWD_RESTORE=PASS`. The
sentinel was not printed. `-FormatOnly` passed the project format gate and
read-only checks for all changed/new supported source/config/test/report
files. No build or E2E rerun was needed for this PowerShell-only follow-up.
