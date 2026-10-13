# DEP-001 — Next.js advisory triage and patch

- Date: 2026-10-13
- Branch: `fix/foundation-next`
- Starting commit: `e3c475afa51d9746d2c8371803c970927f8afbbd`

## Scope and outcome

Updated `next` and `eslint-config-next` from `16.3.6` to the smallest available patched release in the existing `16.3` line, `16.3.8`. Both dependencies are exact-pinned so a clean install resolves the verified release. React remains `19.2.8`. No application code, proxy/auth behavior, Supabase, database, migrations, Vercel settings, MFA, or feature behavior was changed.

Registry check on 2026-10-13 confirmed `next@16.3.8` was the latest published stable patch in the `16.3` line. `16.4` was available but not selected: it changes feature/tooling behavior and is unnecessary to cover the advisories addressed by `16.3.8`.

The official [16.3.8 release notes](https://github.com/vercel/next.js/releases/tag/v16.3.8) list these fixes:

| Advisory            | Issue                                               | Project precondition/exposure review                                                                                                       |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GHSA-cjq9-62q9-8jv4 | Image Optimization SSRF (High)                      | No `images.remotePatterns` are configured. The advisory says apps without configured remote patterns are not affected; patched regardless. |
| GHSA-f87g-xv8r-7p7x | Metadata image `dynamicParams` disclosure           | No `opengraph-image`/`twitter-image` route files or `generateStaticParams` metadata route were found. Patched regardless.                  |
| GHSA-4jqv-mc3x-m676 | SSG/ISR cache poisoning in self-hosted apps         | Pages Router SSG/ISR precondition is absent; this project uses App Router.                                                                 |
| GHSA-mcj8-r9mp-w47p | SSG/ISR cross-user cache poisoning                  | No root catch-all route combined with SSG/ISR routes was found; storefront dynamic routes explicitly use `force-dynamic`.                  |
| GHSA-3w37-wq28-93x7 | Pending `use cache` fill can mix Draft Mode content | No `use cache` directive or Draft Mode usage was found.                                                                                    |
| GHSA-h694-7cp9-m8p3 | Nested `use cache` root-param cache leak            | No `use cache` usage was found.                                                                                                            |
| GHSA-39w2-rjm5-chcv | Development server MCP information disclosure (Low) | Development-server-only surface; not a production server endpoint. Patched regardless.                                                     |

The package advisories already fixed before 16.3.6 were also checked: `GHSA-vcvr-r3jv-pc5j` (`next/og` RCE) is fixed in 16.3.6; the AVIF optimization RCE and Windows-hosted RCE are fixed in 16.3.3; rewrite SSRF and the Turbopack proxy bypass are fixed in 16.2.11. The project has no Next `rewrites()`/`redirects()` configuration or `i18n.locales`; `proxy.ts` remains unchanged and performs session refresh only, with authorization continuing in server-side access checks.

### Scheduled advisory residual

The official [Next.js notice](https://nextjs.org/blog) dated October 8 announced an out-of-band update for October 14, 2026 addressing two Critical and one High issues in upstream dependencies. On the date of this run (October 13), that update had not yet been published and no corrected version could be selected from its undisclosed details. This is an explicit pending follow-up; re-check the official notice and registry on/after October 14 before treating dependency security as current. No speculative canary or feature-line upgrade was made.

## npm audit evidence

Counts are npm's package-level advisory counts, not the number of individual CVEs. Runtime means `npm audit --omit=dev`; all means the full lockfile.

| Check                     | Before (16.3.6)                                        | After (16.3.8)                  |
| ------------------------- | ------------------------------------------------------ | ------------------------------- |
| Runtime total             | 8 (8 high)                                             | 7 (7 high)                      |
| Full tree total           | 26 (20 high, 4 moderate, 2 low)                        | 25 (19 high, 4 moderate, 2 low) |
| `next` package advisories | 6 high-severity package finding with 6 advisory titles | None reported for `next`        |

The remaining runtime findings include the `eslint-config-next` / `@next/eslint-plugin-next` → `fast-glob`/`micromatch`/`braces` chain, `sharp` (`CVE-2026-96889`, via `librsvg`), and `source-map-js`. The full tree also retains advisories in Lighthouse, Puppeteer, MCP SDK, `basic-ftp`, `extract-zip`, `tmp`, `uuid`, and related transitive packages. These are outside the narrowly-scoped Next.js framework advisory fix and were not mass-upgraded. Note that `eslint-config-next` is currently declared under `dependencies`, so npm includes its lint-only dependency chain in the runtime audit; dependency classification/remediation is a separate follow-up, not silently folded into this change.

## Installation and gates

- `npm ci` before changes: PASS.
- `npm ci` after lockfile update: PASS (746 packages installed; npm reports 25 remaining vulnerabilities).
- Resolved direct versions: `next@16.3.8`, `eslint-config-next@16.3.8`, `react@19.2.8`, `react-dom@19.2.8`.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors and 2 pre-existing `<img>` warnings (`src/components/StorePhoto.tsx`, `src/sections/Catalog.tsx`).
- `npm run format:check`: PASS after normalizing the 93 flagged working-tree files from CRLF to LF. The mismatch was checkout line-ending policy, not source formatting: `core.autocrlf=true`, while these files were checked out as CRLF here and LF in the integration checkout. Before writing, Prettier output with `endOfLine: lf` was compared in memory against CRLF→LF-only content for all 93 files; all matched exactly. Afterwards, `git hash-object --path` matched each corresponding base blob (93/93), proving there is no semantic/content delta from normalization. `git diff` contains no changes for those paths.
- `npm run build`: PASS on Next.js 16.3.8; all listed routes compiled.
- Deterministic E2E subset: PASS — `CI=1 npx playwright test tests/e2e/home-motion.spec.ts -g 'reduced motion keeps the landing readable and the collection native'` (1 passed). This exercises the local static landing only and does not sign in, mutate catalog/cart data, or access Supabase.

The build/E2E regenerated `next-env.d.ts` to refer to `.next/types/*` and `.next-e2e/dev/types/*`; this is incidental generated state and was restored to its exact starting contents. It is not part of the DEP-001 diff. Final `git diff --name-only` was checked to exclude `next-env.d.ts` and all unrelated content changes.

## Changed files and disposition

- `package.json`: exact pins for `next` and `eslint-config-next` at `16.3.8`.
- `package-lock.json`: matching Next, eslint config/plugin, SWC, and integrity-resolved lock entries only.
- `docs/remediation/agents/foundation-next.md`: this evidence report.
- Working-tree line endings: 93 pre-existing files now LF-only for Prettier compatibility; normalized text is byte-identical to Prettier output and each Git path-filtered object hash matches the base. These do not appear as content diffs.

- Independent code/security review: NOT RUN (not independently approved).
- All required gates: PASS after line-ending normalization.
- Push/deploy: NOT RUN.
- Wave 1/other agents: NOT STARTED.

## Remaining blockers and risks

1. Re-check the announced October 14 Next.js upstream security release and upgrade to its patched version if applicable.
2. Remediate/triage the remaining runtime and dev advisories separately; DEP-001 did not claim the entire dependency tree is vulnerability-free.
