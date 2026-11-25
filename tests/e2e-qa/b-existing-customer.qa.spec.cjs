/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright spec */
// Scenario B — existing customer: login, profile edit, password change
// (/conta/seguranca), orders history, open previous order, new purchase.
const { test } = require("@playwright/test");
const path = require("path");
const h = require("./qa-helpers.cjs");

const { record, save } = h.recorder("b-existing-customer");
const u = h.mkCreds("qa-b");
const cleanupLog = {};

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await h.createUser(u);
});
test.afterAll(async () => {
  await h.deleteUser(u, cleanupLog);
  save({ cleanup: cleanupLog });
  console.log("CLEANUP", JSON.stringify(cleanupLog));
});

async function buyJosy(page) {
  await h.addJosyToCart(page);
  await h.fillCheckoutPickup(page);
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForURL(/\/pedido\//, { timeout: 30_000 });
  const id = page.url().match(/pedido\/([0-9a-f-]{36})/)[1];
  await page
    .getByRole("button", { name: /Simular pagamento aprovado/ })
    .click();
  await page.waitForTimeout(3000);
  return id;
}

test("Scenario B - existing customer", async ({ page, browser }) => {
  const B = h.BASE;
  // B1 login
  await h.login(page, u);
  record("B1-login", "PASS", page.url());

  // Previous purchase (history fixture made through the UI)
  const firstOrder = await buyJosy(page);
  const { data: fo } = await h.svc
    .from("orders")
    .select("status, order_number")
    .eq("id", firstOrder)
    .single();
  record(
    "B2-previous-purchase",
    fo.status === "paid" ? "PASS" : "FAIL",
    `order=${fo.order_number} status=${fo.status}`,
  );

  // B3 profile edit
  await page.goto(`${B}/conta/perfil`);
  await page.locator('input[name="displayName"]').fill("Cliente QA Existente");
  await page.locator('input[name="contactPhone"]').fill("(12) 99999-1234");
  await page.getByRole("button", { name: /Salvar alterações/ }).click();
  await page.waitForTimeout(2500);
  const feedback = await page
    .locator('[role="status"], [role="alert"]')
    .allInnerTexts();
  await page.reload();
  const name = await page.locator('input[name="displayName"]').inputValue();
  const phone = await page.locator('input[name="contactPhone"]').inputValue();
  const { data: prof } = await h.svc
    .from("customer_profiles")
    .select("*")
    .eq("user_id", u.id)
    .maybeSingle();
  record(
    "B3-profile-edit",
    name === "Cliente QA Existente" && /99999.?1234/.test(phone)
      ? "PASS"
      : "FAIL",
    `ui name=${name} phone=${phone} db=${JSON.stringify({ n: prof?.display_name, p: prof?.contact_phone })} msg=${feedback.join("|")}`,
  );

  // B3b invalid profile inputs
  await page.locator('input[name="displayName"]').fill("");
  await page.locator('input[name="contactPhone"]').fill("abc");
  await page.getByRole("button", { name: /Salvar alterações/ }).click();
  await page.waitForTimeout(2500);
  const invMsg = await page
    .locator('[role="status"], [role="alert"]')
    .allInnerTexts();
  const validity = await page
    .locator('input[name="contactPhone"]')
    .evaluate((e) => e.validationMessage);
  const { data: prof2 } = await h.svc
    .from("customer_profiles")
    .select("display_name, contact_phone")
    .eq("user_id", u.id)
    .maybeSingle();
  record(
    "B3b-profile-invalid",
    prof2?.contact_phone !== "abc" ? "PASS" : "FAIL",
    `db after=${JSON.stringify(prof2)} msg=${invMsg.join("|")} native=${validity}`,
  );

  // B4 password change
  await page.goto(`${B}/conta/seguranca`);
  const newPass = `${u.password}X2`;
  // B4a mismatch
  await page.locator("#account-current-password").fill(u.password);
  await page.locator("#account-new-password").fill(newPass);
  await page.locator("#account-confirm-password").fill(newPass + "z");
  await page.getByRole("button", { name: /Alterar senha/ }).click();
  await page.waitForTimeout(1000);
  const mm = await page.locator('[role="alert"]').allInnerTexts();
  record(
    "B4a-password-mismatch",
    mm.some((t) => /não corresponde/.test(t)) ? "PASS" : "FAIL",
    mm.join("|"),
  );
  // B4b wrong current password
  await page.locator("#account-current-password").fill("wrong-password-123");
  await page.locator("#account-confirm-password").fill(newPass);
  await page.getByRole("button", { name: /Alterar senha/ }).click();
  await page.waitForTimeout(4000);
  const wc = await page
    .locator('[role="alert"], [role="status"]')
    .allInnerTexts();
  record(
    "B4b-password-wrong-current",
    wc.some((t) => /senha atual não confere/.test(t)) ? "PASS" : "FAIL",
    wc.join("|"),
  );
  // B4c valid change
  await page.locator("#account-current-password").fill(u.password);
  await page.getByRole("button", { name: /Alterar senha/ }).click();
  await page.waitForTimeout(5000);
  const pc = await page
    .locator('[role="alert"], [role="status"]')
    .allInnerTexts();
  const needsCode = (await page.locator("#account-reauth-code").count()) > 0;
  await page.screenshot({
    path: path.join(h.OUT, "B4-password.png"),
    fullPage: true,
  });
  let changed = pc.some((t) => /alterada com sucesso/.test(t));
  record(
    "B4c-password-change",
    changed ? "PASS" : needsCode ? "INFO" : "FAIL",
    `reauthCodeRequested=${needsCode} msg=${pc.join("|")}`,
  );
  // Verify which password works now (separate context)
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  const tryLogin = async (pw) => {
    try {
      await h.login(p2, { email: u.email, password: pw });
      return true;
    } catch {
      return false;
    }
  };
  const newWorks = await tryLogin(newPass);
  await ctx.clearCookies();
  const oldWorks = await tryLogin(u.password);
  await ctx.close();
  record(
    "B4d-password-effective",
    changed
      ? newWorks && !oldWorks
        ? "PASS"
        : "FAIL"
      : !newWorks && oldWorks
        ? "INFO"
        : "FAIL",
    `newWorks=${newWorks} oldWorks=${oldWorks}`,
  );
  if (newWorks) u.password = newPass;

  // B5 orders history + open previous order
  await page.goto(`${B}/conta/pedidos`);
  const link = page.locator(`a[href="/pedido/${firstOrder}"]`);
  const listed = (await link.count()) > 0;
  record(
    "B5-orders-history",
    listed ? "PASS" : "FAIL",
    await page
      .locator("main")
      .innerText()
      .then((t) => t.replace(/\s+/g, " ").slice(0, 200)),
  );
  if (listed) {
    await link.first().click();
    await page.waitForURL(new RegExp(`/pedido/${firstOrder}`));
    const h1 = await page.locator("h1").first().innerText();
    const hasItem = (await page.getByText(/Josy/).count()) > 0;
    record(
      "B6-open-previous-order",
      /confirmado/i.test(h1) && hasItem ? "PASS" : "FAIL",
      `h1=${h1}`,
    );
  }

  // B7 new purchase
  const second = await buyJosy(page);
  const { data: so } = await h.svc
    .from("orders")
    .select("status")
    .eq("id", second)
    .single();
  await page.goto(`${B}/conta/pedidos`);
  const count = await page.locator('a[href^="/pedido/"]').count();
  record(
    "B7-new-purchase",
    so.status === "paid" && count >= 2 ? "PASS" : "FAIL",
    `status=${so.status} ordersListed=${count}`,
  );
});
