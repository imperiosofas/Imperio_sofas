/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright helpers */
// Shared helpers for the functional QA suite (tests/e2e-qa).
// Targets the LOCAL production build at http://localhost:3190 connected to the
// Supabase TEST project. Every record created here is tracked and removed in cleanup.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const REPO = path.resolve(__dirname, "..", "..");
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
  throw new Error(
    "Refusing to run: .env.local is not the Supabase TEST project",
  );
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: { persistSession: false },
  },
);

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3190";
const SLUG = "poltrona-josy";
const OUT = path.join(os.tmpdir(), "imperio-e2e-qa");
fs.mkdirSync(OUT, { recursive: true });

function recorder(name) {
  const results = [];
  const record = (id, status, note = "") => {
    results.push({ id, status, note: String(note).slice(0, 500) });
    console.log(`[${status}] ${id} ${note}`);
  };
  const save = (extra = {}) =>
    fs.writeFileSync(
      path.join(OUT, `${name}-results.json`),
      JSON.stringify({ results, ...extra }, null, 1),
    );
  return { results, record, save };
}

const mkCreds = (prefix = "qa") => ({
  email: `${prefix}-${crypto.randomBytes(4).toString("hex")}@example.test`,
  password: `Qa-${crypto.randomBytes(12).toString("base64url")}9!`,
});

async function createUser(u) {
  const { data, error } = await svc.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error) throw error;
  u.id = data.user.id;
  return u;
}

async function inventorySnapshot() {
  const { data, error } = await svc
    .from("inventory")
    .select("variant_id, on_hand, reserved");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.variant_id, r]));
}

async function deleteOrdersOf(userId, log = {}) {
  const { data: orders } = await svc
    .from("orders")
    .select("id, status, cancelled_at")
    .eq("customer_id", userId);
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
          : // needs_review only still holds stock when it came straight from
            // pending_payment; from cancelled/expired the hold was released.
            o.status === "pending_payment" ||
              (o.status === "needs_review" && !o.cancelled_at)
            ? { reserved: Math.max(inv.reserved - it.quantity, 0) }
            : null;
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
    log[`order:${o.id}:${o.status}`] = d.error ? d.error.message : "deleted";
  }
  return log;
}

async function deleteUser(u, log = {}) {
  if (!u?.id) return log;
  await deleteOrdersOf(u.id, log);
  for (const t of [
    "product_favorites",
    "carts",
    "customer_profiles",
    "catalog_admins",
  ]) {
    const r = await svc.from(t).delete().eq("user_id", u.id);
    if (r.error && !/does not exist|schema cache/i.test(r.error.message))
      log[`${t}:${u.email}`] = r.error.message;
  }
  const del = await svc.auth.admin.deleteUser(u.id);
  log[`user:${u.email}`] = del.error ? del.error.message : "deleted";
  return log;
}

// Restore every variant to the baseline snapshot (safety net).
async function restoreInventory(baseline, log = {}) {
  const now = await inventorySnapshot();
  for (const [vid, b] of Object.entries(baseline)) {
    const n = now[vid];
    if (!n) continue;
    if (n.on_hand !== b.on_hand || n.reserved !== b.reserved) {
      const { data: inv } = await svc
        .from("inventory")
        .select("version")
        .eq("variant_id", vid)
        .single();
      await svc
        .from("inventory")
        .update({
          on_hand: b.on_hand,
          reserved: b.reserved,
          version: inv.version + 1,
        })
        .eq("variant_id", vid);
      log[`restore:${vid}`] = { from: n, to: b };
    }
  }
  return log;
}

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

async function addJosyToCart(page) {
  await page.goto(`${BASE}/produto/${SLUG}`);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(2500);
}

async function fillCheckoutPickup(page) {
  await page.goto(`${BASE}/checkout`);
  const select = page.locator("select").first();
  if (await select.count()) {
    const opts = await select.locator("option").count();
    const val = await select
      .locator("option")
      .nth(opts > 1 ? 1 : 0)
      .getAttribute("value");
    if (val) await select.selectOption(val);
  }
  await page.locator('input[name="acceptTerms"]').check();
}

module.exports = {
  REPO,
  svc,
  BASE,
  SLUG,
  OUT,
  recorder,
  mkCreds,
  createUser,
  inventorySnapshot,
  deleteOrdersOf,
  deleteUser,
  restoreInventory,
  login,
  addJosyToCart,
  fillCheckoutPickup,
};

// Delete every product whose slug starts with "qa-produto-" (+ variants,
// inventory, media rows and storage objects).
async function deleteQaProducts() {
  const log = {};
  const { data: prods } = await svc
    .from("products")
    .select("id, slug")
    .like("slug", "qa-produto-%");
  for (const p of prods ?? []) {
    const { data: media } = await svc
      .from("product_media")
      .select("id, storage_path")
      .eq("product_id", p.id);
    const { data: files } = await svc.storage
      .from("catalog-images")
      .list(`products/${p.id}`);
    const paths = [
      ...(media ?? []).map((m) => m.storage_path),
      ...(files ?? []).map((f) => `products/${p.id}/${f.name}`),
    ];
    if (paths.length)
      await svc.storage.from("catalog-images").remove([...new Set(paths)]);
    await svc.from("product_media").delete().eq("product_id", p.id);
    const { data: vars } = await svc
      .from("product_variants")
      .select("id")
      .eq("product_id", p.id);
    for (const v of vars ?? []) {
      await svc.from("cart_items").delete().eq("variant_id", v.id);
      await svc.from("inventory").delete().eq("variant_id", v.id);
    }
    await svc.from("product_favorites").delete().eq("product_id", p.id);
    await svc.from("product_reviews").delete().eq("product_id", p.id);
    await svc.from("product_variants").delete().eq("product_id", p.id);
    const d = await svc.from("products").delete().eq("id", p.id);
    log[p.slug] = d.error ? d.error.message : "deleted";
  }
  return log;
}
module.exports.deleteQaProducts = deleteQaProducts;
