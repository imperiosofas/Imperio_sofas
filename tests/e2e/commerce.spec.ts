import { expect, test } from "@playwright/test";

test("PDP pública usa dados reais e exige login nas ações pessoais", async ({
  page,
}) => {
  await page.goto("/produto/sofa-berlim");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sofá Berlim" }),
  ).toBeVisible();
  await expect(page.locator('[class*="heroImage"] img').first()).toBeVisible();
  await expect(page.locator('[class*="productPrice"]')).toContainText("R$");
  await page.getByRole("button", { name: "Adicionar aos favoritos" }).click();
  await expect(page).toHaveURL(/\/conta\?next=%2Fproduto%2Fsofa-berlim/);
  await page.goto("/produto/sofa-berlim");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page).toHaveURL(/\/conta\?next=%2Fproduto%2Fsofa-berlim/);
});

test("PDP e PLP não têm overflow nos viewports de referência", async ({
  page,
}) => {
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
    for (const route of ["/loja", "/produto/sofa-berlim"]) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${route} em ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("PDP oferece variante, preço e detalhes sem avaliações falsas", async ({
  page,
}) => {
  await page.goto("/produto/sofa-berlim");
  await expect(
    page
      .getByRole("group", { name: "Escolha a medida" })
      .getByRole("button", { pressed: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade" }),
  ).toBeVisible();
  await page.getByText("Dimensões", { exact: true }).click();
  await expect(page.getByText("Largura", { exact: true }).last()).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "Seja o primeiro a avaliar" })
      .or(page.getByRole("link", { name: /avaliações/ })),
  ).toHaveCount(1);
});
