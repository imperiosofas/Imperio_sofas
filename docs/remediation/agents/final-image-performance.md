# LAT-001 — Mobile catalog image delivery

## Status

**Code review: APPROVED. Performance review: APPROVED WITH CAVEATS. Security review: APPROVED.** Coordinator-reported reviewer verdicts: code reviewer (previous review) APPROVE; Chandrasekhar APPROVE WITH CAVEATS for performance; Maxwell APPROVE for security. This branch is isolated and is not integrated, pushed, or deployed. The supplied before/after evidence is local lab evidence, not a production guarantee. Performance review notes the request-to-secondary mapping limitation and rejects attribution of single-run LCP differences.

## Baseline (coordinator-provided)

Environment: exact base `8af0f47`, local development app at `/loja`, viewport 390×844, Fast 3G, CPU throttling 4×. No admin session was available; `/admin` redirected to the account sign-in screen.

| Metric                                 |                                                                                Baseline |
| -------------------------------------- | --------------------------------------------------------------------------------------: |
| LCP                                    |                                                                               13,047 ms |
| LCP TTFB                               |                                                                                3,931 ms |
| LCP image load duration                |                                                                                8,738 ms |
| LCP render delay                       |                                                                                   15 ms |
| CLS                                    |                                                                                       0 |
| Catalog image resources requested      |              20 across the first 10 products, including secondary hover images on touch |
| First catalog image                    |                                       `naturalWidth=1024`, approximately 9.8 s duration |
| Navigation `loadEventEnd`              |                                                                               20,676 ms |
| Chrome ImageDelivery estimate          |    approximately 2.1 MB of potential waste (estimate, not transferred-byte measurement) |
| Exact image bytes / LCP-resource bytes | Not available: cross-origin Resource Timing returned zero without `Timing-Allow-Origin` |
| First-card viewport visibility         |                                        Not separately captured in the supplied baseline |

No signed URL, query string, object path, or token is included in this report.

## Normalized local DOM/request comparison (coordinator-provided)

Three reload samples per revision compared the same local PLP route (`/loja`), viewport (390×844, DPR 3), mobile/touch emulation, Fast 3G, CPU 4×, and `ignoreCache=true`. Every sample covered the first 10 product cards. The table is DOM/request evidence only; it makes no latency attribution and is not a production guarantee.

Each sample below reports `cards / primary images / decorative secondary images / total image elements / loaded images / page-wide signed catalog image requests`:

| Reload sample | Baseline (`8af0f47`)       | After (`perf/store-images-final`) |
| ------------- | -------------------------- | --------------------------------- |
| 1             | 10 / 10 / 7 / 17 / 17 / 19 | 10 / 10 / 0 / 10 / 10 / 12        |
| 2             | 10 / 10 / 7 / 17 / 17 / 19 | 10 / 10 / 0 / 10 / 10 / 12        |
| 3             | 10 / 10 / 7 / 17 / 17 / 19 | 10 / 10 / 0 / 10 / 10 / 12        |

| Metric (p50, n=3 per revision)          |    Baseline |                          After | Observed change |
| --------------------------------------- | ----------: | -----------------------------: | --------------: |
| Total first-10 image elements           |          17 |                             10 |     −7 (−41.2%) |
| Page-wide signed catalog image requests |          19 |                             12 |     −7 (−36.8%) |
| Primary image elements                  |          10 |                             10 |       No change |
| Decorative secondary image elements     |           7 |                              0 |              −7 |
| Exact cross-origin transfer bytes       | Unavailable | Unavailable (`transferSize` 0) |  Cannot compare |

Across all three reloads, primary image elements remained at 10, decorative secondary elements were 7→0, and page-wide signed catalog image requests were 19→12. Thus the request count decreased alongside the decorative-secondary DOM count, but exact per-request causal mapping is not established. Exact cross-origin transfer sizes are unavailable because Resource Timing reports `transferSize=0`. Earlier single-run DOM observations (visibility and first-image position) are not part of these three-sample p50s.

Chandrasekhar's performance review approved these counts with caveats: no raw trace establishes which individual storage request maps to each decorative secondary image. The counts are reported as observed page-wide DOM/request evidence only, not a proven per-request mapping. No raw trace is supplied for the three reload samples.

### Earlier single-run trace observations (inconclusive for latency attribution)

Coordinator-provided trace values are preserved for context, but are not treated as a normalized latency comparison or evidence that this change caused an LCP improvement. These were single local runs; TTFB varied substantially, and exact cross-origin bytes were unavailable.

| Metric                               |            Baseline run | After run | Limitation                                                                     |
| ------------------------------------ | ----------------------: | --------: | ------------------------------------------------------------------------------ |
| LCP                                  |               13,047 ms |  7,093 ms | Single runs; no latency attribution                                            |
| TTFB                                 |                3,931 ms |  1,597 ms | Variable local development timing                                              |
| LCP image load duration              |                8,738 ms |  5,393 ms | Single-run trace values                                                        |
| LCP load delay                       | Not separately supplied |     80 ms | Baseline unavailable                                                           |
| LCP render delay                     |                   15 ms |     23 ms | Single-run trace values                                                        |
| CLS                                  |                       0 |         0 | Observed in these runs only                                                    |
| ImageDelivery estimated wasted bytes |                 ~2.1 MB |   ~1.2 MB | Browser estimate, not transferred-byte measurement                             |
| Trace image-resource count           |                      20 |        12 | Different capture summary from the normalized first-10 DOM/request table above |
| Navigation `loadEventEnd`            |               20,676 ms | 10,796 ms | Single-run values                                                              |

These latency observations are inconclusive and are not a production guarantee. The normalized DOM/request comparison above is the direct evidence for the scoped image-element/request change.

## Fine-pointer desktop verification (coordinator-provided)

Playwright check at 1440×900 reported `hover=true` and `finePointer=true`. Seven decorative secondary-image elements were available; the first secondary image loaded. Its computed opacity changed from 0 before hover to 1 after hovering the first card. No UI console errors were observed. This verifies the tested desktop hover transition, not a broad compatibility or performance guarantee.

## Change

- Added `HoverProductImage`, a leaf Client Component that subscribes to `(hover: hover) and (pointer: fine)` using `useSyncExternalStore` with a false server snapshot.
- The catalog grid continues to render its primary image exactly as before. Its decorative second image is now mounted only on a hover-capable fine pointer; coarse/touch clients render no secondary `<img>` element and therefore do not request its signed image resource.
- Fine-pointer desktop behavior retains the same signed source, `unoptimized` delivery, dimensions, CSS class, and hover opacity/scale effect. Since it mounts after hydration, the coordinator should check for any visible delay on the first desktop hover.
- No storage policy, bucket visibility, URL-signing code, catalog query, product data, landing section, or database state was changed.

## Validation in this worktree

| Check                                    | Result                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm run typecheck`                      | PASS                                                               |
| ESLint on both changed TSX files         | PASS                                                               |
| Prettier check on both changed TSX files | PASS                                                               |
| `npm run build`                          | PASS (Next.js 16.3.8)                                              |
| `git diff --check`                       | PASS                                                               |
| Build-generated `next-env.d.ts` change   | Restored to exact branch-HEAD content                              |
| Code review                              | APPROVED (previous reviewer)                                       |
| Normalized local DOM/request evidence    | APPROVED WITH CAVEATS (Chandrasekhar); no raw trace proves mapping |
| Single-run LCP observations              | Inconclusive; no latency attribution                               |
| Fine-pointer desktop hover verification  | PASS (coordinator-provided Playwright evidence)                    |
| Security review                          | APPROVED (Maxwell)                                                 |

## Integration follow-up

Keep any further browser evidence sanitized: do not print or preserve request URLs, and strip query strings from URL metadata before logging.

1. Treat the DOM/request data as three observed reload samples per revision; page-wide requests decreased alongside secondary-image DOM elements, but exact request-to-element mapping is unverified. Do not attribute single-run LCP differences to this change.
2. Preserve the private bucket and signed-image behavior. Exact image transfer bytes remain unverified because cross-origin Resource Timing exposed no byte sizes.
3. The desktop hover check confirms the transition in the tested run; it is not a broad compatibility or performance guarantee.
4. Code and security reviews are approved; performance is approved with caveats. Integration remains a separate coordinator decision.

## Scope boundary

No integration, push, deploy, Vercel action, database mutation, fixture mutation, or change to the dirty integration worktree or earlier `perf/store-images` candidate was performed.
