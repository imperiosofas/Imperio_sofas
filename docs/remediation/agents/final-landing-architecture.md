# ARCH-001 — landing catalog integration

## Status

The scoped change is implemented on `codex/final-arch001`, based on `8af0f47`.
No commit was created; no package or lockfile, remote Supabase data, Vercel, or
deployment was changed.

## Product source verification

The editorial selection was checked against the local, previously audited
`legacy-catalog-inventory.json` (SHA-256
`67CCBC45449DAB0C239C077B3BCBE56B48EA31298867A934311C136FB1F97822`; totals:
7 categories, 51 products, 107 images, 35 explicit variants). The four matching
source records are Sofá Belize (`sofas-sofa-belize`), Sofá Berlim
(`Sofa-berlim`, normalized to `sofa-berlim`), Sofá Dallas
(`sofas-sofa-dallas`), and Sofá Máximo (`sofas-sofa-maximo`). They are captured
as a provenance-bearing subset in
[`tests/manifests/legacy-catalog-landing-subset.json`](../../../tests/manifests/legacy-catalog-landing-subset.json)
and verified by deriving the slugs from `sourceSlug`/name, not by restating
expected slugs in a self-referential product fixture. Sofá Berlin is a separate
source record and is not substituted for Sofá Berlim.

## Changes

- Landing editorial data stores only the manifest-verified slug and image
  `objectPosition`. Product name, price, dimensions, stock status, and image
  come from the published catalog query; installments and invented fallback
  data are absent.
- Each lookup settles independently. A rejected request increments a sanitized
  failure count while fulfilled catalog products remain visible. Partial
  failure is explicitly announced beside surviving cards; if all lookups fail,
  the existing collection stage shows an unavailable state.
- The local E2E repository contains drafts only. Its valid zero-card state is
  now asserted as “no published selection,” not accepted as an unclassified
  empty list. A focused partial-result test also requires one manifest-proven
  product to survive alongside a rejected lookup.
- Existing landing sections and collection motion/layout remain in place.

## Validation

| Check                                               | Result                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `node --test tests/landing-product-source.test.mjs` | PASS (4/4)                                                                |
| `npm run typecheck`                                 | PASS                                                                      |
| `npm run lint`                                      | PASS (0 errors; 2 `<img>` warnings in `StorePhoto.tsx` and `Catalog.tsx`) |
| Targeted Prettier check                             | PASS                                                                      |
| `git diff --check`                                  | PASS                                                                      |
| `npm run build`                                     | PASS                                                                      |
| `tests/e2e/home-motion.spec.ts`                     | 2 PASS, 1 FAIL                                                            |

The E2E failure is in the bottom-navigation route-transition test: after
clicking `/loja`, the URL remained `/`. This is outside the landing catalog
lookup changes and was not modified. The reduced-motion and responsive landing
smoke passed, including the explicit local no-published-selection state.

`package.json` and `package-lock.json` are unchanged. The build's generated
`next-env.d.ts` edit was restored. There are no remote database calls, commits,
pushes, or deployments in this work.
