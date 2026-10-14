# DEP-002 — dependency advisory revalidation

Date: 2026-10-13  
Branch: `codex/final-dep002`  
Base: `8af0f4786d376ac9136f04eb2c8a421bfe157213`

## Verdict

**APPROVED — narrow update warranted.** The lockfile resolved `sharp@0.35.4`, inside the affected range for GHSA-wq5f-xc86-pv6w / CVE-2026-96889. Updated only `sharp` to `^0.35.5`, the advisory's first patched release. Also moved it from `devDependencies` to `dependencies`: `src/features/admin/actions.ts` imports it in a server action used at runtime, so relying on a development-only direct dependency was not appropriate. No broad upgrade or `npm audit fix` was run.

The patch applies to the installed `sharp`/libvips bundle on glibc Linux. The advisory describes memory corruption in librsvg with possible RCE under runtime-specific conditions and states `sharp@0.35.5` supplies librsvg 2.63.2. The app's image endpoint is admin-authorized and UI/type validation accepts JPEG, PNG, and WebP; those checks are not treated as proof that untrusted bytes cannot be SVG, so the vulnerable image decoder was relevant defense-in-depth for this server processing path. The upgrade does not change that path or expand who can call it. The independent reviewer noted that the MIME value originates from the client, so byte-level SVG rejection remains a separate hardening opportunity; it was not added to this narrow dependency change.

## Dependency and advisory evidence

- Before: lock resolved `sharp@0.35.4`; npm audit reported GHSA-wq5f-xc86-pv6w, range `<0.35.5`, severity High, patched `>=0.35.5`.
- After: lock resolves `sharp@0.35.5`; `npm ls sharp --all` reports direct `sharp@0.35.5`, deduped with Next.js's optional dependency. `npm ls sharp --omit=dev` also reports it in the production dependency tree.
- Runtime: local Node `v24.15.0`; `sharp@0.35.5` requires Node `>=20.9.0`, so the local runtime satisfies the package engine. Next.js `16.3.8` declares the compatible optional range `^0.35.4`.
- The official advisory says the fixed prebuilt bundle contains librsvg `2.63.2`: [GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
- The official `sharp` release record confirms `v0.35.5`: [sharp releases](https://github.com/lovell/sharp/releases/tag/v0.35.5).
- The official installation guide documents the Node-API v9 runtime prerequisite: [sharp installation](https://sharp.pixelplumbing.com/install/).

### npm audit snapshots

| Command                |                                Before |                                 After | `sharp` after |
| ---------------------- | ------------------------------------: | ------------------------------------: | ------------- |
| `npm audit --omit=dev` |                                7 High |                                6 High | No advisory   |
| `npm audit`            | 25 total (19 High, 4 Moderate, 2 Low) | 24 total (18 High, 4 Moderate, 2 Low) | No advisory   |

Both commands still exit non-zero because unrelated advisories remain. The production-only report still lists `@next/eslint-plugin-next`, `braces`, `eslint-config-next`, `fast-glob`, `micromatch`, and `source-map-js`; the full report includes those and additional tooling/test dependency advisories. They were not upgraded as part of DEP-002.

## Targeted image pipeline check

Used the same transformation sequence as the admin upload action: `sharp(input, { limitInputPixels: 100_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer()`. Read inputs from existing repository assets; wrote no image files.

| Input sample                                    | Detected input format | Output              | Result |
| ----------------------------------------------- | --------------------- | ------------------- | ------ |
| `src/assets/store/originals/wagner-contato.jpg` | JPEG                  | WebP, 64,110 bytes  | PASS   |
| `public/imperio-sofas-logo.png`                 | PNG                   | WebP, 32,976 bytes  | PASS   |
| `public/og.webp`                                | WebP                  | WebP, 114,090 bytes | PASS   |

The native processing test ran with `sharp@0.35.5` and verified each output by reading its metadata back as WebP.

## Validation

- `npm audit --omit=dev`: executed; 6 unrelated High findings remain, `sharp` absent.
- `npm audit`: executed; 24 unrelated findings remain (18 High, 4 Moderate, 2 Low), `sharp` absent.
- `npm ls sharp --all`: PASS, `sharp@0.35.5` direct and deduped under Next.
- `npm ls sharp --omit=dev`: PASS, `sharp@0.35.5` present in production dependency tree.
- JPEG/PNG/WebP processing: PASS (table above).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with two existing `<img>` warnings in `src/components/StorePhoto.tsx` and `src/sections/Catalog.tsx`; no lint errors.
- `npm run build`: PASS on Next.js 16.3.8.
- `git diff --check`: PASS.
- Install note: an initial `npm ci` attempt hit Windows `ENOTEMPTY` while removing `node_modules/ajv-formats`. A subsequent `npm ci --ignore-scripts --no-audit --no-fund` completed sufficiently to resolve the installed graph; `npm ls` and native image conversions confirmed the installed `sharp@0.35.5`. No manual deletion of `node_modules` was performed.

## Scope and disposition

Changed paths are limited to `package.json`, `package-lock.json`, and this report. No application source, migrations, environment files, secrets, Supabase state, Vercel configuration, or deployment state were changed. The build-generated `next-env.d.ts` change was restored to its original tracked content.

**Independent review:** APPROVE for code and security/supply-chain scope. The reviewer confirmed the affected/fixed versions, lockfile integrity, absence of unrelated package upgrades, admin authorization around the upload action, and in-memory JPEG/PNG/WebP transforms. Remaining audit findings and client-controlled MIME limitations are recorded above. No push or deploy was performed.
