/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright script */
// Admin-side QA on the LOCAL production build + Supabase TEST.
// Temporary customer + temporary admin (row in catalog_admins via service key),
// both deleted at the end; stock and price are verified back to the original.
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
  { auth: { persistSession: false } },
);
const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:3190";
const SLUG = "poltrona-josy";
const results = [];
const record = (id, status, note = "") => {
  results.push({ id, status, note });
  console.log(`[${status}] ${id} ${note}`);
};
const mk = () => ({
  email: `audit-${crypto.randomBytes(4).toString("hex")}@example.test`,
  password: `Qa-${crypto.randomBytes(12).toString("base64url")}9!`,
});
const cust = mk();
const adm = mk();
let variantId, priceBefore, stockBefore;

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.beforeAll(async () => {
  for (const u of [cust, adm]) {
    const { data, error } = await svc.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw error;
    u.id = data.user.id;
  }
  const ins = await svc.from("catalog_admins").insert({ user_id: adm.id });
  if (ins.error) throw ins.error;
  const { data: p } = await svc
    .from("products")
    .select("id")
    .eq("slug", SLUG)
    .single();
  const { data: v } = await svc
    .from("product_variants")
    .select("id, price_cents")
    .eq("product_id", p.id)
    .single();
  variantId = v.id;
  priceBefore = v.price_cents;
  const { data: inv } = await svc
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", v.id)
    .single();
  stockBefore = inv;
});

test.afterAll(async () => {
  const cleanup = {};
  const { data: orders } = await svc
    .from("orders")
    .select("id, status")
    .eq("customer_id", cust.id);
  for (const o of orders ?? []) {
    const { data: items } = await svc
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", o.id);
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
            : null; // refunded with restock: already returned by the admin action
      if (patch)
        await svc
          .from("inventory")
          .update({ ...patch, version: inv.version + 1 })
          .eq("variant_id", it.variant_id);
    }
    for (const t of [
      "order_events",
      "order_payments",
      "order_items",
      "order_groups",
    ])
      await svc.from(t).delete().eq("order_id", o.id);
    const d = await svc.from("orders").delete().eq("id", o.id);
    cleanup[o.id] = d.error ? d.error.message : "deleted";
  }
  // Price must be back to the original value whatever happened.
  const { data: v } = await svc
    .from("product_variants")
    .select("price_cents")
    .eq("id", variantId)
    .single();
  if (v.price_cents !== priceBefore)
    await svc
      .from("product_variants")
      .update({ price_cents: priceBefore })
      .eq("id", variantId);
  const { data: inv } = await svc
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", variantId)
    .single();
  cleanup.stock = { before: stockBefore, after: inv };
  cleanup.price = { before: priceBefore, after: v.price_cents };
  for (const u of [cust, adm]) {
    await svc.from("customer_profiles").delete().eq("user_id", u.id);
    const del = await svc.auth.admin.deleteUser(u.id);
    cleanup[u.email.split("@")[0]] = del.error ? del.error.message : "deleted";
  }
  fs.writeFileSync(
    path.join(require("os").tmpdir(), "imperio-admin-flow-results.json"),
    JSON.stringify({ results, cleanup }, null, 1),
  );
  console.log("CLEANUP", JSON.stringify(cleanup));
});

async function login(page, u) {
  await page.goto(`${BASE}/conta`);
  await page
    .getByLabel(/e-mail/i)
    .first()
    .fill(u.email);
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill(u.password);
  await page.locator("#auth-password").press("Enter");
  await page
    .getByRole("button", { name: "Sair" })
    .first()
    .waitFor({ timeout: 30_000 });
}

test("admin flow", async ({ browser }) => {
  // Customer: paid order + withdrawal request.
  const c = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const cp = await c.newPage();
  await login(cp, cust);
  await cp.goto(`${BASE}/produto/${SLUG}`);
  await cp.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await cp.waitForTimeout(2500);
  await cp.goto(`${BASE}/checkout`);
  const select = cp.locator("select").first();
  if (await select.count()) {
    const val = await select.locator("option").nth(1).getAttribute("value");
    if (val) await select.selectOption(val);
  }
  await cp.locator('input[name="acceptTerms"]').check();
  await cp.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await cp.waitForURL(/\/pedido\//, { timeout: 30_000 });
  const orderId = cp.url().match(/pedido\/([0-9a-f-]{36})/)[1];
  await cp.getByRole("button", { name: /Simular pagamento aprovado/ }).click();
  await cp.waitForTimeout(3000);
  await cp.reload();
  await cp.locator('textarea[name="reason"]').fill("Teste admin");
  await cp.getByRole("button", { name: "Desistir da compra" }).click();
  await cp.waitForTimeout(3000);
  const { data: mid } = await svc
    .from("inventory")
    .select("on_hand")
    .eq("variant_id", variantId)
    .single();
  record(
    "setup-paid-and-withdrawn",
    mid.on_hand === stockBefore.on_hand - 1 ? "PASS" : "FAIL",
    `on_hand=${mid.on_hand}`,
  );
  await c.close();

  // Admin.
  const a = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const ap = await a.newPage();
  await login(ap, adm);
  await ap.goto(`${BASE}/admin/pedidos/${orderId}`);
  const sees =
    (await ap.getByText(/pediu para desistir da compra/).count()) > 0;
  record("ADM-sees-withdrawal", sees ? "PASS" : "FAIL");
  await ap
    .getByLabel("Motivo do estorno")
    .fill("Arrependimento - teste auditoria");
  await ap.locator('input[name="restock"]').check();
  await ap.getByRole("button", { name: "Registrar estorno" }).click();
  await ap.waitForTimeout(3500);
  const { data: o } = await svc
    .from("orders")
    .select("status, cancel_reason")
    .eq("id", orderId)
    .single();
  record(
    "ADM-refund-status",
    o.status === "refunded" ? "PASS" : "FAIL",
    `status=${o.status}`,
  );
  const { data: inv } = await svc
    .from("inventory")
    .select("on_hand")
    .eq("variant_id", variantId)
    .single();
  record(
    "ADM-refund-restock",
    inv.on_hand === stockBefore.on_hand ? "PASS" : "FAIL",
    `on_hand=${inv.on_hand}`,
  );
  await ap.reload();
  const formGone =
    (await ap.getByRole("button", { name: "Registrar estorno" }).count()) === 0;
  record("ADM-refund-once", formGone ? "PASS" : "FAIL");

  // ARC-01: quick edit with "399.00" must keep R$ 399,00 (bug saved R$ 39.900,00).
  await ap.goto(`${BASE}/admin/produtos`);
  await ap.getByLabel("Buscar produtos por nome, slug ou SKU").fill("Josy");
  await ap.getByLabel("Buscar produtos por nome, slug ou SKU").press("Enter");
  await ap.waitForTimeout(2500);
  await ap.getByLabel("Ações para Poltrona Josy").click();
  await ap.getByRole("button", { name: "Edição rápida" }).click();
  const typed = `${Math.floor(priceBefore / 100)}.${String(priceBefore % 100).padStart(2, "0")}`;
  await ap.locator('input[name="price-0"]').fill(typed);
  await ap
    .locator("dialog")
    .getByRole("button", { name: /Salvar/ })
    .click();
  await ap.waitForTimeout(3500);
  const { data: v } = await svc
    .from("product_variants")
    .select("price_cents")
    .eq("id", variantId)
    .single();
  record(
    "ARC-01-quick-edit-price",
    v.price_cents === priceBefore ? "PASS" : "FAIL",
    `typed=${typed} saved=${v.price_cents} expected=${priceBefore}`,
  );
  await a.close();
});
