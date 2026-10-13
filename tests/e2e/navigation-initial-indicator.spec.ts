import { expect, test } from "@playwright/test";

test("mobile home dock bead is centered on its first load", async ({
  browser,
}) => {
  expect(process.env.NAV_ISOLATION_SENTINEL).toBeUndefined();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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

  await page.goto("/");
  const nav = page.locator('nav[class*="dockBar"]');
  const activeLink = nav.locator('a[aria-current="page"]');
  const bead = page.locator('[class*="goldBead"]');

  await expect(nav).toBeVisible();
  await expect(activeLink).toHaveAttribute("href", "/");
  await expect(bead).toHaveCSS("opacity", "1");

  const firstLoadGeometry = await page.evaluate(() => {
    const dock = document.querySelector('nav[class*="dockBar"]');
    const selected = dock?.querySelector('a[aria-current="page"]');
    const indicator = document
      .querySelector('[class*="goldBead"]')
      ?.getBoundingClientRect();
    const selectedBounds = selected?.getBoundingClientRect();
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;

    if (!dock || !indicator || !selectedBounds) return null;

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dockWidth: dock.getBoundingClientRect().width,
      beadCenter: indicator.left + indicator.width / 2,
      activeLinkCenter: selectedBounds.left + selectedBounds.width / 2,
      navigationType: navigationEntry?.type,
    };
  });

  expect(firstLoadGeometry).not.toBeNull();
  expect(firstLoadGeometry).toMatchObject({
    viewportWidth: 390,
    viewportHeight: 844,
    dockWidth: 390,
    navigationType: "navigate",
  });
  expect(
    Math.abs(
      firstLoadGeometry!.beadCenter - firstLoadGeometry!.activeLinkCenter,
    ),
  ).toBeLessThanOrEqual(1);

  await context.close();
});
