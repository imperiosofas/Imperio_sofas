import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectBeadCenteredOnActiveRoute(
  page: Page,
  bead: Locator,
  href: string,
) {
  const activeLink = page.locator(
    'nav[class*="dockBar"] a[aria-current="page"]',
  );
  await expect(activeLink).toHaveAttribute("href", href);
  await expect
    .poll(async () => {
      const [beadBox, linkBox] = await Promise.all([
        bead.boundingBox(),
        activeLink.boundingBox(),
      ]);
      if (!beadBox || !linkBox) return Number.POSITIVE_INFINITY;
      return Math.abs(
        beadBox.x + beadBox.width / 2 - (linkBox.x + linkBox.width / 2),
      );
    })
    .toBeLessThan(2);
}

async function revealAndLoadFullPage(page: Page) {
  const targets = [
    page.locator("#diferenciais"),
    page.locator("#catalogo"),
    page.getByRole("heading", {
      name: "Confiança construída em cada sala.",
    }),
    page.locator("#localizacao"),
    page.locator("#contato"),
    page.getByRole("contentinfo"),
  ];

  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
  }

  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLImageElement>("img[loading=lazy]")
      .forEach((image) => {
        image.loading = "eager";
      });
  });
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images, (image) =>
        image.decode().catch(() => undefined),
      ),
    );
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("the same dock bead travels between routes and follows browser back", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.goto("/");
  const dock = page.locator('nav[class*="dockBar"]');
  await expect(dock).toBeVisible();
  await expect
    .poll(async () => (await dock.boundingBox())?.width ?? 0)
    .toBeGreaterThan(0);
  const bead = page.locator('[class*="goldBead"]');
  await expectBeadCenteredOnActiveRoute(page, bead, "/");
  const original = await bead.elementHandle();
  await page.locator('nav[class*="dockBar"] a[href="/loja"]').click();
  await expect(page).toHaveURL(/\/loja$/);
  await expectBeadCenteredOnActiveRoute(page, bead, "/loja");
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[class*="goldBead"]'),
    ),
  ).toBe(true);
  await page.locator('nav[class*="dockBar"] a[href="/conta"]').click();
  await expect(page).toHaveURL(/\/conta$/);
  await expectBeadCenteredOnActiveRoute(page, bead, "/conta");
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[class*="goldBead"]'),
    ),
  ).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/loja$/);
  await expectBeadCenteredOnActiveRoute(page, bead, "/loja");
  expect(
    await original!.evaluate(
      (element) => element === document.querySelector('[class*="goldBead"]'),
    ),
  ).toBe(true);
  await expect(
    page.locator('nav[class*="dockBar"] a[aria-current="page"]'),
  ).toHaveAttribute("href", "/loja");
  await context.close();
});

test("@local reduced motion keeps the landing readable and the collection native", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#inicio h1")).toContainText("Seu conforto merece");
  await expect(page.locator("[data-hero-scene] [data-hero-word]")).toHaveCount(
    6,
  );
  await expect(page.locator("[data-collection-viewport]")).toHaveCount(1);
  for (const section of [
    "inicio",
    "diferenciais",
    "catalogo",
    "localizacao",
    "contato",
  ]) {
    await expect(page.locator(`#${section}`)).toHaveCount(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("@local restored landing fits the reference viewports and keeps the touch dock", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
  ]) {
    const mobileContext = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "no-preference",
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto("/");
    await expect(mobilePage.locator("#inicio h1")).toContainText(
      "Seu conforto merece",
    );
    for (const section of [
      "inicio",
      "diferenciais",
      "catalogo",
      "localizacao",
      "contato",
    ]) {
      await expect(mobilePage.locator(`#${section}`)).toHaveCount(1);
    }
    expect(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await expect(
      mobilePage.locator('nav[class*="dockBar"]'),
      `bottom navigation should be visible at ${viewport.width}px`,
    ).toBeVisible();

    if (viewport.width === 390) {
      const collection = mobilePage.locator("[data-collection-viewport]");
      await expect(collection).toBeVisible();
      const canSwipeCollection = await collection.evaluate((element) => {
        const viewport = element as HTMLElement;
        return viewport.scrollWidth > viewport.clientWidth;
      });
      expect(canSwipeCollection).toBe(true);
      await collection.evaluate((element) => {
        const viewport = element as HTMLElement;
        viewport.scrollLeft = viewport.clientWidth;
      });
      await expect
        .poll(() =>
          collection.evaluate((element) => (element as HTMLElement).scrollLeft),
        )
        .toBeGreaterThan(0);
      await collection.evaluate((element) => {
        (element as HTMLElement).scrollLeft = 0;
      });
      await mobilePage.evaluate(() => document.fonts.ready);
      await revealAndLoadFullPage(mobilePage);
      await mobilePage.screenshot({
        path: testInfo.outputPath("restored-home-390.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    await mobileContext.close();
  }

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto("/");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await desktopPage.setViewportSize(viewport);
    await expect(desktopPage.locator("#inicio h1")).toContainText(
      "Seu conforto merece",
    );
    expect(
      await desktopPage.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await expect(desktopPage.locator('nav[class*="dockBar"]')).toBeHidden();

    if (viewport.width === 1440) {
      await desktopPage.evaluate(() => document.fonts.ready);
      await revealAndLoadFullPage(desktopPage);
      await desktopPage.screenshot({
        path: testInfo.outputPath("restored-home-1440.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await desktopContext.close();
});
