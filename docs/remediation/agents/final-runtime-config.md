# ENV-001 — Runtime configuration hardening

**Base:** `8af0f47`
**Branch:** `codex/final-env001`
**Scope:** explicit `APP_ENV` / `CATALOG_SOURCE` resolution; no remote or credential changes.

## Behavior

Runtime selection is centralized in `src/lib/env/runtime-config.mjs` and shared by the server environment parser, catalog repository selector, and production-readiness check.

| Runtime input                                                    | Result                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Development/test with `APP_ENV` and `CATALOG_SOURCE` unset       | Safe local defaults (`local` / `local`) retained                         |
| `NODE_ENV=production` with `APP_ENV` unset/empty                 | Fails with a generic configuration error                                 |
| `NODE_ENV=production` with `CATALOG_SOURCE` unset/empty          | Fails; production runtime selection must be explicit                     |
| `APP_ENV=staging` or `production` with source unset              | Fails; source must be explicit                                           |
| `APP_ENV=staging` or `production` with `CATALOG_SOURCE=local`    | Fails; these environments require Supabase                               |
| Unsupported `APP_ENV` or `CATALOG_SOURCE`                        | Fails with allowed-value guidance; invalid values are not echoed         |
| Explicit local runtime (`APP_ENV=local`, `CATALOG_SOURCE=local`) | Local catalog remains available, including for a local `next start` test |

`.env.example` documents the local defaults and explicit staging/production settings. `check:production` uses the same resolver, so a missing or invalid runtime selection cannot silently skip its production checks.

## Security and scope

- The new resolver reads only `NODE_ENV`, `APP_ENV`, and `CATALOG_SOURCE`; it does not access credential values.
- No privileged key was added to public environment variables, browser code, or client bundles. No secret value was read, printed, or written.
- Post-build static bundle scan found no privileged Supabase key names in `.next/static`.
- No `.env.local`, Supabase remote setting/schema/data, Storage bucket, migration, Vercel setting, or deployment was changed.

## Validation

- Runtime-config unit tests: **5 passed**.
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**, 0 errors and two pre-existing `<img>` warnings in `StorePhoto.tsx` and `Catalog.tsx`.
- Targeted Prettier check for changed code/test files and this report: **passed**. `.env.example` is not a supported Prettier parser input and is therefore excluded.
- `npm run format:check`: **fails on 101 repository files outside this ENV-001 diff**; none of the touched source/test files appear in that failure list. No global formatting was applied.
- `git diff --check`: **passed** (Git emits only its configured LF→CRLF informational warnings for three touched files).
- `npm run build`: **passed** after the final resolver/test adjustment.
- `next-env.d.ts`: build-generated route type imports were restored by a focused patch to the exact base contents; it is clean and excluded from the commit.

## Disposition

No remote action was needed. Local implementation gates pass; the repository-wide format gate remains a documented pre-existing baseline issue. Commit only the ENV-001 files and this report; do not push or deploy.
