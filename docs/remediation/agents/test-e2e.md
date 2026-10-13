# TEST-001 — deterministic local E2E

## Scope and starting state

- Worktree: `C:\Users\Thiago\Documents\Codex\2026-09-03\files-pasted-by-the-user-estou\outputs\imperio-sofas-vale-test-e2e`
- Branch: `fix/e2e-determinism`
- Starting HEAD: `c3c6fe695d71f75f4a4c192f6c2fa7fe702bb5a2`
- Initial worktree: clean.
- Scope kept to Playwright config and `tests/e2e/**`; no application feature source, Supabase remote, or remote catalog/customer/cart data was changed.
- The implementation checkpoint is `152611638c81caee543dff4a34f4769ed7661425`; this follow-up adds no commit, push, merge, or deployment.

## Isolation and deterministic test selection

Playwright defaults to `http://127.0.0.1:3114`, accepts only `http:` and `127.0.0.1`, `localhost`, or IPv6 loopback, normalizes URL's bracketed IPv6 hostname (`[::1]`) to `::1`, and uses that normalized value for Next's loopback bind. It starts its own local Next dev server without reusing another server and uses `.next-e2e` for build output.

Playwright 1.63.0 (`node_modules/playwright/lib/runner/index.js`) constructs the web-server child environment in this order: defaults, inherited `process.env`, then configured `webServer.env`. The config provides an empty value for every inherited key, copies back only the Windows/Node runtime allowlist (`PATH`, `SystemRoot`, `WINDIR`, `TEMP`, `TMP`, `PATHEXT`, `COMSPEC`, `USERPROFILE`), blanks all keys found in supported Next `.env*` files, then adds explicit local-test variables. It does not read or log environment values; the dotenv scanner retains key names only and strips a leading BOM before parsing. For the proof run, the parent had a harmless non-empty `E2E_ENV_SENTINEL` key; no child-env entry names that key explicitly. The preflight saw it as empty in the spawned web-server process, proving the generic inherited-key blanking. The parent key was removed in a PowerShell `finally` block. Browser-facing Supabase URL/key are explicitly empty. No `.env.local` exists in this worktree at validation time. Next 16.3.8 (`node_modules/@next/env/dist/index.js`) loads `.env.development.local`, `.env.local`, `.env.development`, and `.env` in development, but fills a dotenv key only when it is `undefined`; an existing empty override is preserved and blocks that dotenv value. The `@local` subset does not sign in, access remote Supabase/catalog data, or create persistent test records. It tests the empty PLP, URL filters, unavailable PDP UI with Supabase unconfigured, responsive layouts, and reduced-motion readability. **Draft invisibility was not tested.** The local catalog fixture is empty and the PDP path does not use it, so these E2E results cannot prove database draft visibility rules.

## Commands and results

| Command                                                                        | Result                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                       | PASS — completed; 746 packages added, 747 audited. npm reported 25 dependency advisories (2 low, 4 moderate, 19 high); no audit remediation was attempted because it is outside TEST-001. |
| `npx playwright test --grep '@local'` without a sentinel                       | PASS — 9 passed; helper is a no-op when the optional sentinel is absent, so a normal local run succeeds.                                                                                  |
| `npx playwright test --grep '@local'` with non-empty parent `E2E_ENV_SENTINEL` | PASS — 9 passed; no explicit child override exists, and preflight confirmed the generic env mapping blanked it. Parent variable cleaned in `finally`.                                     |
| `npx playwright test`                                                          | PASS — latest run 29/29 after configuring the custom mobile context explicitly and removing the synthetic resize; local-only sanitized server, no remote data or writes.                  |
| `npx playwright test --list --grep '@local'` with IPv6 loopback                | PASS — config accepts bracketed `[::1]` and normalizes it for the bind argument.                                                                                                          |
| Focused Node TCP bind on `::1`                                                 | PASS — the listener reported IPv6 loopback and closed immediately.                                                                                                                        |
| `npx playwright test --list` with `https://127.0.0.1:3114`                     | PASS — rejected before starting a server.                                                                                                                                                 |
| `npx playwright test --list` with `http://example.com:3114`                    | PASS — rejected before starting a server.                                                                                                                                                 |
| `npm run typecheck`                                                            | PASS — final run after environment isolation and motion-test changes.                                                                                                                     |
| `npm run lint`                                                                 | PASS — 0 errors; 2 existing `<img>` optimization warnings in `src/components/StorePhoto.tsx` and `src/sections/Catalog.tsx`.                                                              |
| `npm run format:check`                                                         | PASS — final run after report/config/helper/test changes.                                                                                                                                 |
| `npm run build`                                                                | PASS — final Next.js production build; generated `next-env.d.ts` restored to HEAD references afterward.                                                                                   |

## Changes

- Isolated Playwright from existing dev servers and remote Supabase/catalog access; constrained its base URL to loopback.
- Updated local storefront E2E assertions to the local empty PLP state and unavailable PDP UI without claiming that a database draft was hidden.
- Replaced the stale category interaction with a deterministic local route assertion/navigation; explicitly opened the collapsed price filter before using it.
- Document navigations in the filter/route test wait for `DOMContentLoaded`; content assertions still wait for the actual UI state without waiting for unrelated resources to finish loading.
- Kept the viewport sweep on one page navigation to avoid repeated server work at each size.
- Tagged only the safe local subset with `@local`; no tests were skipped or weakened by timeout-only changes.
- Replaced the dock test's immediate `opacity: 1` assertion with accessible active-route state plus a poll for the bead's center to align with the active link. The manually created browser context explicitly uses a 390×844 mobile viewport, touch, and `reducedMotion: "no-preference"`; the test waits only for the visible dock and nonzero measured width. No post-load viewport resize or debug logging remains. The same mounted bead is verified across `/` → `/loja` → `/conta` → browser back to `/loja`.
- Corrected the loopback host allowlist by stripping URL hostname brackets for IPv6 and binding the local server to the validated normalized loopback host.
- Hardened `webServer.env`: every inherited key is blank by default; only the minimal Windows/Node runtime allowlist is restored; dotenv keys are blanked; explicit local test values are applied last. A preflight checks an inherited unknown-name sentinel is empty in the spawned server without printing it; the sentinel has no explicit child-env override.
- Verified normalized IPv6 bind behavior with a focused loopback TCP listener. A full E2E attempt over IPv6 exposed Next dev-server HMR cross-origin rejection for the bracketed browser origin; the final 9-test E2E gate ran on IPv4 loopback.
- Coordinator reran both sentinel scenarios, `typecheck`, `lint`, `format:check`, and the default Turbopack build after the helper fix. Generated `next-env.d.ts` references were restored afterward; it is not part of the intended diff.
- Follow-up after integration: one run before the explicit context setting observed an initial 48.75px offset (bead at its x≈0 origin). With the explicit mobile context and no synthetic resize, the focused route-motion test passed 1/1 and the single full-suite rerun passed 29/29, including bead identity and alignment after browser Back. This transient earlier failure is recorded; no application source was changed and no finding reproduced in the final run.

## Residuals

- All 29 Playwright tests were executed against the isolated local server; no real authentication, remote catalog, or Supabase data was used.
- Draft invisibility remains explicitly unverified until a controlled test fixture/store path can exercise a real draft without remote data.
- `npm ci` surfaced the advisory counts above; assessing/upgrading dependencies is not included in this task.
- Lint has two pre-existing optimization warnings in application source, with no lint errors.
- No persistent test state was created, so no data cleanup was required. `next-env.d.ts` is restored to the baseline `.next/dev/types` references and excluded from the final diff.
