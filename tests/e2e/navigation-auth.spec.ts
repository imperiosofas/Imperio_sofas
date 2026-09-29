import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getSafeAuthReturnTo } from "../../src/lib/auth-return-to";

const phoneViewports = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
];

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

for (const viewport of phoneViewports) {
  test(`touch navigation and auth remain usable at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();

    await page.goto("/");
    const dock = page.locator("nav[class*='dockBar']");
    await expect(dock).toBeVisible();
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
    const stage = page.locator("[data-auth-stage]");
    const emailInput = page.locator("#auth-email");
    await expect(emailInput).toBeVisible();
    if (viewport.width === 390) {
      await page.screenshot({ path: "test-results/auth-390-login-email.png" });
    }
    await expect(page.locator("#auth-password")).toHaveCount(0);
    expect(
      await emailInput.evaluate((input) => getComputedStyle(input).fontSize),
    ).toBe("16px");
    expect((await emailInput.boundingBox())?.height).toBeGreaterThanOrEqual(52);
    expect(
      (
        await page
          .getByRole("button", { name: "Continuar com e-mail" })
          .boundingBox()
      )?.height,
    ).toBeGreaterThanOrEqual(52);

    await emailInput.fill("cliente@example.invalid");
    await page.getByRole("button", { name: "Continuar com e-mail" }).click();
    await expect(stage).toHaveAttribute("data-auth-step", "password");
    await expect(page.locator("#auth-password")).toBeFocused();
    if (viewport.width === 390) {
      await page.screenshot({
        path: "test-results/auth-390-login-password.png",
      });
    }
    expect(
      (await page.getByRole("button", { name: "Mostrar senha" }).boundingBox())
        ?.height,
    ).toBeGreaterThanOrEqual(48);
    expect(
      (
        await stage
          .getByRole("button", { name: "Entrar", exact: true })
          .boundingBox()
      )?.height,
    ).toBeGreaterThanOrEqual(52);
    const passwordBox = await page.locator("#auth-password").boundingBox();
    expect(passwordBox).not.toBeNull();
    expect(passwordBox!.y).toBeGreaterThanOrEqual(0);
    expect(passwordBox!.y + passwordBox!.height).toBeLessThanOrEqual(
      viewport.height,
    );

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const shellTop = (await page.locator("[data-auth-shell]").boundingBox())!
        .y;
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await page.locator("#auth-tab-register").click();
      await expect(stage).toHaveAttribute("data-auth-mode", "register");
      await expect(stage).toHaveAttribute("data-auth-step", "email");
      await expect(
        page.getByRole("heading", { name: "Crie sua conta." }),
      ).toBeVisible();
      if (viewport.width === 390) {
        await page.screenshot({
          path: "test-results/auth-390-signup-email.png",
        });
      }
      expect(
        Math.abs(
          (await page.locator("[data-auth-shell]").boundingBox())!.y - shellTop,
        ),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore),
      ).toBeLessThanOrEqual(2);
      await expect(dock).toBeVisible();

      await page.locator("#auth-email").fill("novo-cliente@example.invalid");
      await page.getByRole("button", { name: "Continuar com e-mail" }).click();
      await expect(page.locator("#auth-confirm-password")).toBeVisible();
      if (viewport.width === 390) {
        await page.screenshot({
          path: "test-results/auth-390-signup-password.png",
        });
      }
      await expect(page.locator('input[autocomplete="name"]')).toHaveCount(0);
      await page.locator("#auth-tab-login").click();
      await expect(stage).toHaveAttribute("data-auth-mode", "login");
      await expect(stage).toHaveAttribute("data-auth-step", "email");
      await expect(page.locator("#auth-email")).toBeVisible();
    }

    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.evaluate(() => document.documentElement.clientWidth),
    );

    await context.close();
  });
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`auth stage transforms between account states at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await page.goto("/conta");

    const stage = page.locator("[data-auth-stage]");
    await expect(stage).toBeVisible();
    await expect(page.locator("#auth-email")).toBeVisible();
    await expect(stage.locator("video, canvas")).toHaveCount(0);

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await page.locator("#auth-tab-register").click();
      await expect(stage).toHaveAttribute("data-auth-step", "email");
      await expect(stage).toHaveAttribute("data-auth-mode", "register");
      await expect(
        page.getByRole("heading", { name: "Crie sua conta." }),
      ).toBeVisible();
      await page.locator("#auth-email").fill("novo-cliente@example.invalid");
      await page.getByRole("button", { name: "Continuar com e-mail" }).click();
      await expect(page.locator("#auth-password")).toBeVisible();
      await expect(page.locator("#auth-confirm-password")).toBeVisible();

      await page.locator("#auth-tab-login").click();
      await expect(stage).toHaveAttribute("data-auth-step", "email");
      await expect(stage).toHaveAttribute("data-auth-mode", "login");
      await expect(page.locator("#auth-email")).toBeVisible();
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
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

test("account shell keeps its form and dock clear at 768x1024", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/conta");
  await expect(page.locator("[data-auth-shell]")).toBeVisible();
  await expect(page.locator(".site-header__desktop-nav")).toBeHidden();
  await expect(page.locator("nav[class*='dockBar']")).toBeVisible();
  await expect(page.locator("#auth-email")).toBeVisible();
  expect(
    await page
      .locator("#auth-email")
      .evaluate((input) => getComputedStyle(input).fontSize),
  ).toBe("16px");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(768);
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
  test.skip(
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    "O ambiente de teste tem Supabase configurado; não enviar tentativas reais de autenticação nesta verificação de UI.",
  );
  await page.goto("/conta");
  await expect(page.locator("#auth-email")).toBeVisible();
  await page.locator("#auth-email").fill("cliente@example.invalid");
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill("Senha-forte-123!");
  await page
    .locator("[data-auth-stage]")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page.locator("#auth-stage-error")).toContainText(
    "Não foi possível acessar sua conta",
  );
});

test("cart redirects anonymous visitors to account with a safe return path", async ({
  page,
}) => {
  await page.goto("/carrinho");
  await expect(page).toHaveURL(/\/conta\?next=%2Fcarrinho$/);
  await expect(page.locator("#auth-email")).toBeVisible();
});

test("authentication return destinations reject external and ambiguous URLs", () => {
  expect(getSafeAuthReturnTo("/carrinho")).toBe("/carrinho");
  expect(getSafeAuthReturnTo("/conta/seguranca")).toBe("/conta/seguranca");
  for (const value of [
    "https://example.com",
    "//example.com",
    "/carrinho?redirect=https://example.com",
    "/\\example.com",
  ]) {
    expect(getSafeAuthReturnTo(value)).toBe("/conta");
  }
});

test("social provider buttons are shown only when explicitly enabled", async ({
  page,
}) => {
  await page.goto("/conta");
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const googleEnabled =
    supabaseConfigured &&
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
  const appleEnabled =
    supabaseConfigured && process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true";
  await expect(
    page.getByRole("button", { name: "Continuar com Google" }),
  ).toHaveCount(googleEnabled ? 1 : 0);
  await expect(
    page.getByRole("button", { name: "Continuar com Apple" }),
  ).toHaveCount(appleEnabled ? 1 : 0);
});

test("OAuth callback hides provider errors and rejects unsafe return paths", async ({
  page,
}) => {
  await page.goto(
    "/auth/callback?error=access_denied&error_description=provider-secret&next=https%3A%2F%2Fexample.com",
  );
  await expect(page).toHaveURL(/\/conta\?erro=oauth$/);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível continuar com este provedor",
  );
  await expect(page.getByRole("main")).not.toContainText("provider-secret");
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

  await page.locator("#auth-tab-register").click();
  await expect(page.locator("[data-auth-stage]")).toHaveAttribute(
    "data-auth-mode",
    "register",
  );
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
