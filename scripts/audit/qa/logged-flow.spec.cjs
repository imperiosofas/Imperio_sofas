/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright script */
// Logged-in QA against the LOCAL production build (http://127.0.0.1:3190)
// connected to the Supabase TEST project. Creates one temporary customer,
// runs cart/account/checkout(mock pay)/withdrawal + responsive checks, then
// deletes everything it created and restores the stock it consumed.
const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = path.resolve(__dirname, "..", "..", "..");
const { createClient } = require(
  path.join(REPO, "node_modules/@supabase/supabase-js"),
);
const env = {};
for (const l of fs
  .readFileSync(path.join(REPO, ".env.local"), "utf8")
  .split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("qsafyqsskwbjnailgoev"))
  throw new Error("not TEST");
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false },
  },
);

const BASE = "http://127.0.0.1:3190";
const SLUG = "poltrona-josy";
const SHOTS = path.join(require("os").tmpdir(), "imperio-qa-shots");
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const record = (id, status, note = "") => {
  results.push({ id, status, note });
  console.log(`[${status}] ${id} ${note}`);
};

let user;
const email = `audit-qa-${crypto.randomBytes(4).toString("hex")}@example.test`;
const password = `Qa-${crypto.randomBytes(12).toString("base64url")}9!`;

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.beforeAll(async () => {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
});

test.afterAll(async () => {
  const cleanup = {};
  const { data: orders } = await svc
    .from("orders")
    .select("id, status")
    .eq("customer_id", user.id);
  for (const o of orders ?? []) {
    // Restore stock consumed by a paid order before removing it.
    const { data: items } = await svc
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", o.id);
    // paid: stock was consumed (on_hand and reserved fell) -> give on_hand back.
    // pending_payment / needs_review: still reserved -> release the reservation.
    for (const it of items ?? []) {
      const { data: inv } = await svc
        .from("inventory")
        .select("on_hand, reserved, version")
        .eq("variant_id", it.variant_id)
        .single();
      const patch =
        o.status === "paid"
          ? { on_hand: inv.on_hand + it.quantity }
          : ["pending_payment", "needs_review"].includes(o.status)
            ? { reserved: Math.max(inv.reserved - it.quantity, 0) }
            : null;
      if (patch)
        await svc
          .from("inventory")
          .update({ ...patch, version: inv.version + 1 })
          .eq("variant_id", it.variant_id);
      cleanup[`stock:${it.variant_id}`] = { before: inv, patch };
    }
    await svc.from("order_events").delete().eq("order_id", o.id);
    await svc.from("order_payments").delete().eq("order_id", o.id);
    await svc.from("order_items").delete().eq("order_id", o.id);
    await svc.from("order_groups").delete().eq("order_id", o.id);
    const d = await svc.from("orders").delete().eq("id", o.id);
    cleanup[o.id] = d.error ? d.error.message : "deleted";
  }
  await svc.from("customer_profiles").delete().eq("user_id", user.id);
  const del = await svc.auth.admin.deleteUser(user.id);
  cleanup.user = del.error ? del.error.message : "deleted";
  fs.writeFileSync(
    path.join(require("os").tmpdir(), "imperio-logged-flow-results.json"),
    JSON.stringify({ results, cleanup }, null, 1),
  );
  console.log("CLEANUP", JSON.stringify(cleanup));
});

async function login(page) {
  await page.goto(`${BASE}/conta`);
  await page
    .getByLabel(/e-mail/i)
    .first()
    .fill(email);
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-password").press("Enter");
  await page
    .getByRole("button", { name: "Sair" })
    .first()
    .waitFor({ timeout: 30_000 });
}

test("logged-in customer flow", async ({ page }) => {
  const consoleErrors = [];
  page.on(
    "console",
    (m) => m.type() === "error" && consoleErrors.push(m.text()),
  );

  // B. login
  await login(page);
  await page.goto(`${BASE}/conta/perfil`);
  const onProfile =
    !page.url().includes("/conta?") &&
    (await page.locator('input[name="displayName"]').count()) > 0;
  record("B-login", onProfile ? "PASS" : "FAIL", page.url());

  // D. profile edit + persistence
  await page.locator('input[name="displayName"]').fill("Cliente Auditoria");
  await page.locator('input[name="contactPhone"]').fill("12999990000");
  await page.getByRole("button", { name: /Salvar alterações/ }).click();
  await page.waitForTimeout(2000);
  await page.reload();
  const savedName = await page
    .locator('input[name="displayName"]')
    .inputValue();
  record(
    "D-profile-persist",
    savedName === "Cliente Auditoria" ? "PASS" : "FAIL",
    `name=${savedName}`,
  );

  // F. another customer's / random order is not visible
  await page.goto(`${BASE}/pedido/${crypto.randomUUID()}`);
  const nf = await page.getByText(/não encontrad|404/i).count();
  record("F-random-order-404", nf > 0 ? "PASS" : "FAIL");

  // E. customer is denied on admin
  const adminResp = await page.goto(`${BASE}/admin/pedidos`);
  const adminDenied =
    adminResp.status() === 404 ||
    (await page.getByText(/não encontrad|404/i).count()) > 0;
  record(
    "E-customer-denied-admin",
    adminDenied ? "PASS" : "FAIL",
    `status=${adminResp.status()}`,
  );
  const xlsx = await page.request.get(`${BASE}/api/admin/reports/sales.xlsx`);
  record(
    "E-customer-denied-xlsx",
    [401, 403, 404].includes(xlsx.status()) ? "PASS" : "FAIL",
    `status=${xlsx.status()}`,
  );

  // A/C. product page + add to cart
  await page.goto(`${BASE}/produto/${SLUG}`);
  const hasPrice = (await page.getByText(/R\$\s?\d/).count()) > 0;
  record("A-product-page", hasPrice ? "PASS" : "FAIL");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/carrinho`);
  const inCart = (await page.getByText(/Josy/i).count()) > 0;
  record("C-add-to-cart", inCart ? "PASS" : "FAIL");

  // C. quantity +1, reload persistence, double click
  const inc = page.getByRole("button", { name: "Aumentar quantidade" }).first();
  await inc.click();
  await page.waitForTimeout(2500);
  await page.reload();
  const qtyText = await page
    .locator('button[aria-label^="Aumentar quantidade de"]')
    .first()
    .locator("xpath=preceding-sibling::span[1]")
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  record(
    "C-qty-persist",
    (qtyText ?? "").trim() === "2" ? "PASS" : "FAIL",
    `qty=${(qtyText ?? "").trim()}`,
  );
  await page
    .getByRole("button", { name: "Diminuir quantidade" })
    .first()
    .dblclick();
  await page.waitForTimeout(3000);
  await page.reload();
  const qtyAfter = await page
    .locator('button[aria-label^="Aumentar quantidade de"]')
    .first()
    .locator("xpath=preceding-sibling::span[1]")
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  record(
    "C-double-click-decrease",
    (qtyAfter ?? "").trim() === "1" ? "PASS" : "FAIL",
    `qty after dblclick=${(qtyAfter ?? "").trim()}`,
  );

  // Server-side price: cart line equals catalog price x qty (no client price field).
  const priceInputs = await page.locator('input[name*="price" i]').count();
  record("C-no-client-price-field", priceInputs === 0 ? "PASS" : "FAIL");

  // G. responsive (logged in)
  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of [
      "/carrinho",
      "/conta/perfil",
      "/checkout",
      `/produto/${SLUG}`,
    ]) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      await page.screenshot({
        path: path.join(SHOTS, `${w}x${h}${route.replace(/\//g, "_")}.png`),
        fullPage: true,
      });
      record(
        `G-${w}x${h}-${route}`,
        overflow <= 1 ? "PASS" : "FAIL",
        `overflow=${overflow}`,
      );
    }
  }
  await page.setViewportSize({ width: 1366, height: 900 });

  // Checkout: pickup + terms required + mock payment
  await page.goto(`${BASE}/checkout`);
  const lead = (await page.getByText(/Prazo:/).count()) > 0;
  record("ECO-checkout-lead-time", lead ? "PASS" : "FAIL");
  const footer = (await page.getByText(/CNPJ/).count()) > 0;
  record("ECO-checkout-seller-footer", footer ? "PASS" : "FAIL");
  const select = page.locator("select").first();
  if (await select.count()) {
    const opts = await select.locator("option").allTextContents();
    const val = await select
      .locator("option")
      .nth(opts.length > 1 ? 1 : 0)
      .getAttribute("value");
    if (val) await select.selectOption(val);
  }
  const submit = page.getByRole("button", { name: /Ir para o pagamento/ });
  await submit.click();
  await page.waitForTimeout(1500);
  const stillCheckout = page.url().includes("/checkout");
  record(
    "F-terms-required",
    stillCheckout ? "PASS" : "FAIL",
    "submit without terms stays on checkout",
  );
  await page.locator('input[name="acceptTerms"]').check();
  await page.locator('input[name="marketingWhatsapp"]').check();
  await submit.click();
  await page.waitForURL(/\/pedido\//, { timeout: 30_000 }).catch(() => {});
  const orderUrl = page.url();
  record(
    "F-order-created",
    /\/pedido\//.test(orderUrl) ? "PASS" : "FAIL",
    orderUrl,
  );

  const orderId = orderUrl.match(/pedido\/([0-9a-f-]{36})/)?.[1];
  if (orderId) {
    const { data: o } = await svc
      .from("orders")
      .select(
        "customer_id,total_cents,terms_accepted_at,marketing_whatsapp_consent_at,status",
      )
      .eq("id", orderId)
      .single();
    record("F-order-owner", o.customer_id === user.id ? "PASS" : "FAIL");
    record("F-terms-recorded", o.terms_accepted_at ? "PASS" : "FAIL");
    record(
      "LGPD-marketing-consent-recorded",
      o.marketing_whatsapp_consent_at ? "PASS" : "FAIL",
    );

    const approve = page.getByRole("button", {
      name: /Simular pagamento aprovado/,
    });
    if (await approve.count()) {
      await approve.click();
      await page.waitForTimeout(3000);
      await page.reload();
    }
    const { data: paid } = await svc
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    record(
      "F-mock-payment-paid",
      paid.status === "paid" ? "PASS" : "FAIL",
      `status=${paid.status}`,
    );

    // ECO-01 withdrawal
    const withdraw = page.getByRole("button", { name: "Desistir da compra" });
    if (await withdraw.count()) {
      await page.locator('textarea[name="reason"]').fill("Teste de auditoria");
      await withdraw.click();
      await page.waitForTimeout(3000);
      const protocol =
        (await page.getByText(/Desistência registrada/).count()) > 0;
      record("ECO-withdrawal-protocol", protocol ? "PASS" : "FAIL");
      const { data: w } = await svc
        .from("orders")
        .select("withdrawal_requested_at,withdrawal_reason")
        .eq("id", orderId)
        .single();
      record(
        "ECO-withdrawal-stored",
        w.withdrawal_requested_at &&
          w.withdrawal_reason === "Teste de auditoria"
          ? "PASS"
          : "FAIL",
      );
      await page.screenshot({
        path: path.join(SHOTS, "withdrawal.png"),
        fullPage: true,
      });
    } else {
      record("ECO-withdrawal-protocol", "FAIL", "button not shown");
    }
  }

  // B. logout -> protected page redirects
  await page.context().clearCookies();
  await page.goto(`${BASE}/conta/pedidos`);
  record(
    "B-after-logout-protected",
    /\/conta(\?|$)/.test(
      new URL(page.url()).pathname + new URL(page.url()).search,
    )
      ? "PASS"
      : "FAIL",
    page.url(),
  );

  record(
    "console-errors",
    consoleErrors.length ? "INFO" : "PASS",
    consoleErrors.slice(0, 5).join(" | "),
  );
});
