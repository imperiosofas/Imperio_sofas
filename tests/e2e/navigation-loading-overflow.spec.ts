import { expect, test } from "@playwright/test";

test("tablet product loading skeleton stays within the viewport", async ({
  browser,
}) => {
  expect(process.env.NAV_ISOLATION_SENTINEL).toBeUndefined();

  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    isMobile: false,
    hasTouch: false,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isLoopback =
      requestUrl.hostname === "127.0.0.1" ||
      requestUrl.hostname === "localhost" ||
      requestUrl.hostname === "[::1]";

    if (!isLoopback || requestUrl.pathname === "/api/cart/summary") {
      await route.abort();
      return;
    }

    await route.continue();
  });

  await page.addInitScript(() => {
    type SkeletonSample = {
      viewportWidth: number;
      documentWidth: number;
      skeletonLeft: number;
      skeletonRight: number;
      skeletonWidth: number;
    };

    const samples: SkeletonSample[] = [];
    Object.assign(window, { __productLoadingSamples: samples });

    const collect = () => {
      const skeleton =
        document.querySelector<HTMLElement>('[aria-busy="true"]');
      if (skeleton) {
        const bounds = skeleton.getBoundingClientRect();
        samples.push({
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          skeletonLeft: bounds.left,
          skeletonRight: bounds.right,
          skeletonWidth: bounds.width,
        });
      }
      requestAnimationFrame(collect);
    };

    new MutationObserver(collect).observe(document, {
      childList: true,
      subtree: true,
    });
    requestAnimationFrame(collect);
  });

  await page.goto("/produto/sofa-berlim", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const samples = (
      window as typeof window & {
        __productLoadingSamples?: {
          viewportWidth: number;
          documentWidth: number;
          skeletonLeft: number;
          skeletonRight: number;
          skeletonWidth: number;
        }[];
      }
    ).__productLoadingSamples;

    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      loadingSamples: samples ?? [],
      finalLoadingFallbackVisible: Boolean(
        document.querySelector('[aria-busy="true"]'),
      ),
    };
  });

  expect(result.viewportWidth).toBe(768);
  expect(
    result.loadingSamples.length,
    "the direct product navigation should naturally render its route loading fallback",
  ).toBeGreaterThan(0);
  expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth);
  for (const sample of result.loadingSamples) {
    expect(sample.viewportWidth).toBe(768);
    expect(sample.documentWidth).toBeLessThanOrEqual(sample.viewportWidth);
    expect(sample.skeletonLeft).toBeGreaterThanOrEqual(0);
    expect(sample.skeletonRight).toBeLessThanOrEqual(sample.viewportWidth);
  }

  await context.close();
});
