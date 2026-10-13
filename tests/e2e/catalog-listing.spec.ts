import { expect, test } from "@playwright/test";

test("@local PLP local vazio mantém estado vazio e filtros na URL", async ({
  page,
}) => {
  await page.goto("/loja", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Loja", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 modelos")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Nenhum modelo disponível no momento.",
    }),
  ).toBeVisible();
  await page.goto("/loja?max=500", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Nenhum modelo encontrado." }),
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Nenhum modelo encontrado." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sofás", exact: true }),
  ).toHaveAttribute("href", "/loja/sofas");
  await page.goto("/loja/sofas", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Sofás", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Nenhum modelo disponível no momento.",
    }),
  ).toBeVisible();
});

test("@local drawer mobile filtra e remove um chip sem catálogo remoto", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/loja");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Filtrar produtos" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("plp-mobile-drawer.png"),
  });
  const filterDialog = page.getByRole("dialog", { name: "Filtrar produtos" });
  await filterDialog.getByText("Preço", { exact: true }).click();
  await filterDialog.getByLabel("Até (R$)").fill("500");
  await filterDialog.getByRole("button", { name: "Ver produtos" }).click();
  await expect(page).toHaveURL(/max=500/);
  await page
    .locator('[aria-label="Filtros aplicados"]')
    .getByRole("link", { name: /Até R\$ 500/ })
    .click();
  await expect(page).toHaveURL(/\/loja$/);
  await page.getByRole("button", { name: "Ordenar" }).click();
  await page
    .getByRole("dialog", { name: "Ordenar por" })
    .getByRole("link", { name: "Menor preço" })
    .click();
  await expect(page).toHaveURL(/sort=price_asc/);
  await page.screenshot({ path: test.info().outputPath("plp-mobile.png") });
});

test("@local PLP não cria overflow nas larguras solicitadas", async ({
  page,
}) => {
  await page.goto("/loja");
  for (const [width, height] of [
    [360, 800],
    [375, 812],
    [390, 844],
    [414, 896],
    [430, 932],
    [768, 1024],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("heading", { name: "Loja", exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px horizontal overflow`).toBeLessThanOrEqual(1);
    if (width === 390 || width === 1440) {
      await page.screenshot({
        path: test.info().outputPath(`plp-${width}.png`),
      });
    }
  }
});

test("@local touch mobile mantém o estado vazio acima da bottom nav", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3114",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/loja");
  await expect(
    page.getByRole("heading", {
      name: "Nenhum modelo disponível no momento.",
    }),
  ).toBeVisible();
  await expect(page.locator(".site-header__desktop-nav")).toBeHidden();
  await expect(page.locator('[class*="dockRoot"]')).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath("plp-touch-mobile.png"),
  });
  await context.close();
});
