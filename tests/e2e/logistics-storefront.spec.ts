import { expect, test } from "@playwright/test";

test("CEP route rejects malformed postal codes without provider fallback", async ({
  page,
}) => {
  const response = await page.request.get("/api/logistics/cep?cep=12");
  expect(response.status()).toBe(400);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toEqual({ status: "invalid" });
});

test("customer delivery area requires an authenticated account", async ({
  page,
}) => {
  await page.goto("/conta/entregas");
  await expect(page).toHaveURL(/\/conta\?next=%2Fconta%2Fentregas$/);
  await expect(page.locator("#auth-email")).toBeVisible();
});
