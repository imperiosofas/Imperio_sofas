import { expect, test } from "@playwright/test";

test("analytics export rejects invalid category and unauthenticated requests safely", async ({
  request,
}) => {
  const invalidCategory = await request.get(
    "/api/admin/reports/analytics.xlsx?category=not-a-uuid",
  );
  expect(invalidCategory.status()).toBe(400);
  expect(invalidCategory.headers()["cache-control"]).toContain("no-store");
  expect(invalidCategory.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(invalidCategory.json()).resolves.toEqual({
    error: "O filtro de categoria é inválido.",
  });

  const duplicateCategory = await request.get(
    "/api/admin/reports/analytics.xlsx?category=123e4567-e89b-42d3-a456-426614174000&category=123e4567-e89b-42d3-a456-426614174000",
  );
  expect(duplicateCategory.status()).toBe(400);

  const unauthenticated = await request.get(
    "/api/admin/reports/analytics.xlsx",
  );
  expect(unauthenticated.status()).toBe(401);
  expect(unauthenticated.headers()["cache-control"]).toContain("no-store");
  expect(unauthenticated.headers()["content-type"]).toContain(
    "application/json",
  );
  await expect(unauthenticated.json()).resolves.toEqual({
    error: "Autentique-se para baixar este relatório.",
  });
});
