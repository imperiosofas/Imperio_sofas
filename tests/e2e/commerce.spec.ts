import { expect, test } from "@playwright/test";

test("@local PDP sem Supabase configurado mostra estado indisponível", async ({
  page,
}) => {
  await page.goto("/produto/sofa-berlim");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Esse caminho saiu da rota.",
    }),
  ).toBeVisible();
});

test("@local PDP e PLP não têm overflow nos viewports de referência", async ({
  page,
}) => {
  test.setTimeout(90_000);
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

test("@local PDP sem fonte configurada apresenta a tela de rota indisponível", async ({
  page,
}) => {
  await page.goto("/produto/sofa-berlim");
  await expect(
    page.getByRole("heading", { name: "Esse caminho saiu da rota." }),
  ).toBeVisible();
});
