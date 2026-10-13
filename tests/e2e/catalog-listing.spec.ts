import { expect, test } from "@playwright/test";

test("PLP mantém filtros na URL, categoria e PDP local", async ({ page }) => {
  await page.goto("/loja");
  await expect(
    page.getByRole("heading", { name: "Loja", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 modelo")).toBeVisible();
  await page.goto("/loja?max=500");
  await expect(
    page.getByRole("heading", { name: "Nenhum modelo encontrado." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nenhum modelo encontrado." }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("plp-empty.png") });
  await page.getByRole("link", { name: "Sofás", exact: true }).click();
  await expect(page).toHaveURL(/\/loja\/sofas$/);
  await expect(page.getByRole("link", { name: /Sofá Berlim/ })).toBeVisible();
  await page.getByRole("link", { name: /Sofá Berlim/ }).click();
  await expect(page).toHaveURL(/\/produto\/sofa-berlim$/);
});

test("drawer mobile filtra e remove um chip", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/loja");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Filtrar produtos" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("plp-mobile-drawer.png"),
  });
  await page
    .getByRole("dialog", { name: "Filtrar produtos" })
    .getByText("Largura")
    .click();
  await page
    .getByRole("dialog", { name: "Filtrar produtos" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Ver produtos" }).click();
  await expect(page).toHaveURL(/largura=10000/);
  await page
    .locator('[aria-label="Filtros aplicados"]')
    .getByRole("link", { name: /10,00 m/ })
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

test("PLP não cria overflow nas larguras solicitadas", async ({ page }) => {
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
    await page.goto("/loja");
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

test("touch mobile mantém produtos acima da bottom nav", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/loja");
  await expect(page.getByRole("link", { name: /Sofá Berlim/ })).toBeVisible();
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
