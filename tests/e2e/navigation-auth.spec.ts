import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const phoneWidths = [320, 360, 375, 390, 430];

test("navigation follows layout from desktop to tablet", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("/");
  await expect(page.locator(".site-header__desktop-nav")).toBeVisible();
  await expect(page.locator("nav[class*='dockBar']")).toBeHidden();

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator(".site-header__desktop-nav")).toBeHidden();
  await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
});

test("mobile story keeps the product legible while scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Explorar a loja" });
  const dock = page.locator("nav[class*='dockBar']");
  const ctaBox = await cta.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.y - (ctaBox!.y + ctaBox!.height)).toBeGreaterThan(16);

  await page.setViewportSize({ width: 390, height: 844 });
  const range = await page
    .locator("[data-story-track]")
    .evaluate((element) => element.clientHeight - window.innerHeight);
  const stage = page.locator("[data-story-stage]");
  const media = page.locator("[data-story-media]");
  for (const progress of [0.45, 0.6, 0.93]) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      range * progress,
    );
    await expect
      .poll(async () => Math.round((await stage.boundingBox())!.y))
      .toBe(0);
    await expect(media).toBeVisible();
  }
  const collection = page.getByRole("link", { name: "Ver coleção de sofás" });
  await expect(collection).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-story-copy="collection"]')
        .evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(1);
  expect(
    (await collection.boundingBox())!.y +
      (await collection.boundingBox())!.height,
  ).toBeLessThan((await dock.boundingBox())!.y - 24);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const width of phoneWidths) {
  test(`touch navigation and auth remain usable at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
    await expect(page.locator(".site-header__desktop-nav")).toBeHidden();
    await expect(page.locator("nav[class*='dockBar'] a")).toHaveCount(3);
    await expect(
      page.locator("nav[class*='dockBar'] a[aria-current='page']"),
    ).toHaveAttribute("href", "/");
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.evaluate(() => document.documentElement.clientWidth),
    );

    await page.goto("/conta");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByLabel("Como podemos chamar você?")).toBeVisible();
    await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    const backToLogin = page.getByRole("button", {
      name: "Entrar",
      exact: true,
    });
    await backToLogin.scrollIntoViewIfNeeded();
    const scrollBeforeBack = await page.evaluate(() => window.scrollY);
    await backToLogin.click();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeBack);
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.evaluate(() => document.documentElement.clientWidth),
    );

    await context.close();
  });
}

test("touch tablet uses bottom navigation in portrait and landscape", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/loja");
  await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
  await expect(
    page.locator("nav[class*='dockBar'] a[aria-current='page']"),
  ).toHaveAttribute("href", "/loja");

  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
  await expect(page.locator(".site-header__desktop-nav")).toBeHidden();
  await context.close();
});

test("store and product routes keep Loja active", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/loja/sofas");
  await expect(
    page.locator("nav[class*='dockBar'] a[aria-current='page']"),
  ).toHaveAttribute("href", "/loja");

  await page.goto("/produto/berlim");
  await expect(
    page.locator("nav[class*='dockBar'] a[aria-current='page']"),
  ).toHaveAttribute("href", "/loja");
  await context.close();
});

test("unauthenticated account route shows login and fails closed without config", async ({
  page,
}) => {
  await page.goto("/conta");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar na minha conta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByLabel("Confirme sua senha")).toBeVisible();
  await expect(page.locator(".auth-card")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByLabel("Como podemos chamar você?").fill("Cliente de teste");
  await page.getByLabel("E-mail").fill("cliente@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("Senha-forte-123!");
  await page.getByLabel("Confirme sua senha").fill("Senha-forte-123!");
  await expect(page.getByLabel("E-mail")).toHaveValue(
    "cliente@example.invalid",
  );
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.locator(".auth-alert[role='alert']")).toContainText(
    "Não foi possível acessar sua conta",
  );
});

test("@a11y core routes and register state have no serious automated violations", async ({
  page,
}) => {
  for (const route of ["/", "/loja", "/conta"]) {
    await page.goto(route);
    await page.waitForTimeout(750);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const critical = results.violations.filter(
      (violation) => violation.impact === "critical",
    );
    const featureFindings = results.violations.flatMap((violation) =>
      violation.nodes
        .filter((node) =>
          node.target.some(
            (target) =>
              target.includes("bottom-navigation") || target.includes("auth-"),
          ),
        )
        .map((node) => ({
          rule: violation.id,
          impact: violation.impact,
          node,
        })),
    );
    console.info(
      `[axe] ${route}: ${results.violations.map((item) => `${item.id}(${item.impact}:${item.nodes.length})`).join(", ") || "sem violações"}`,
    );
    expect(critical, `${route}: findings críticos`).toEqual([]);
    expect(
      featureFindings,
      `${route}: findings na navegação/autenticação`,
    ).toEqual([]);
  }

  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForTimeout(750);
  const registerResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const registerFindings = registerResults.violations.flatMap((violation) =>
    violation.nodes
      .filter((node) =>
        node.target.some(
          (target) =>
            target.includes("auth-") || target.includes("bottom-navigation"),
        ),
      )
      .map((node) => ({ rule: violation.id, impact: violation.impact, node })),
  );
  expect(registerFindings).toEqual([]);
});
