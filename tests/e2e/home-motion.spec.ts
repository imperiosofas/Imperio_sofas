import { expect, test } from "@playwright/test";

test("the same dock bead travels between routes and follows browser back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const bead = page.locator('[class*="goldBead"]');
  await expect(bead).toHaveCSS("opacity", "1");
  const original = await bead.elementHandle();
  const start = (await bead.boundingBox())!.x;
  await page.locator('nav[class*="dockBar"] a[href="/loja"]').click();
  await expect(page).toHaveURL(/\/loja$/);
  await expect
    .poll(async () => (await bead.boundingBox())!.x)
    .toBeGreaterThan(start + 80);
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[class*="goldBead"]'),
    ),
  ).toBe(true);
  await page.locator('nav[class*="dockBar"] a[href="/conta"]').click();
  await expect(page).toHaveURL(/\/conta$/);
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[class*="goldBead"]'),
    ),
  ).toBe(true);
  await page.goBack();
  await expect(
    page.locator('nav[class*="dockBar"] a[aria-current="page"]'),
  ).toHaveAttribute("href", "/loja");
});

test("reduced motion exposes all story content without a sticky scrub", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-story-stage]")).toHaveCSS(
    "position",
    "relative",
  );
  for (const scene of ["hero", "comfort", "collection"]) {
    await expect(page.locator(`[data-story-copy="${scene}"]`)).toHaveCSS(
      "opacity",
      "1",
    );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
