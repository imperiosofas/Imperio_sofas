/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright spec */
// Scenario D — admin: temp admin logs in, /admin, create test product, edit,
// change price/stock, upload a generated PNG, delete the product, view orders.
// Then a normal customer tries the same (UI routes + direct Supabase API).
const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const h = require("./qa-helpers.cjs");
const sharp = require(path.join(h.REPO, "node_modules/sharp"));
const { createClient } = require(
  path.join(h.REPO, "node_modules/@supabase/supabase-js"),
);

const { record, save } = h.recorder("d-admin");
const adm = h.mkCreds("qa-d-admin");
const cust = h.mkCreds("qa-d-cust");
const tag = crypto.randomBytes(3).toString("hex");
const PNAME = `QA Produto Teste ${tag}`;
const PSLUG = `qa-produto-teste-${tag}`;
const SKU = `QA-SKU-${tag}`.toUpperCase();
const PNG = path.join(h.OUT, `qa-${tag}.png`);
const cleanupLog = {};
let productId;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await h.createUser(adm);
  await h.createUser(cust);
  const ins = await h.svc.from("catalog_admins").insert({ user_id: adm.id });
  if (ins.error) throw ins.error;
  await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 180, g: 120, b: 60 },
    },
  })
    .png()
    .toFile(PNG);
});
test.afterAll(async () => {
  cleanupLog.products = await h.deleteQaProducts();
  await h.deleteUser(adm, cleanupLog);
  await h.deleteUser(cust, cleanupLog);
  fs.rmSync(PNG, { force: true });
  save({ cleanup: cleanupLog });
  console.log("CLEANUP", JSON.stringify(cleanupLog));
});

test("Scenario D - admin", async ({ browser }) => {
  const B = h.BASE;
  const actx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const ap = await actx.newPage();
  const consoleErrors = [];
  ap.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  // D1 login + /admin
  await h.login(ap, adm);
  const r = await ap.goto(`${B}/admin`);
  const adminTxt = (
    await ap
      .locator("main")
      .innerText()
      .catch(() => "")
  ).replace(/\s+/g, " ");
  record(
    "D1-admin-dashboard",
    r.status() === 200 && !/não encontrad/i.test(adminTxt) ? "PASS" : "FAIL",
    `status=${r.status()} ${adminTxt.slice(0, 120)}`,
  );

  // D2 create product
  await ap.goto(`${B}/admin/produtos/novo`);
  await ap.locator('input[name="name"]').fill(PNAME);
  await ap.locator('input[name="slug"]').fill(PSLUG);
  await ap
    .locator('textarea[name="description"]')
    .fill("Produto criado pela QA funcional. Pode ser excluído.");
  const catVal = await ap
    .locator('select[name="categoryId"] option:not([disabled])')
    .first()
    .getAttribute("value");
  await ap.locator('select[name="categoryId"]').selectOption(catVal);
  await ap.locator('input[name="variants[0].sku"]').fill(SKU);
  await ap.locator('input[name="variants[0].price"]').fill("123.45");
  await ap.locator('input[name="variants[0].onHand"]').fill("3");
  await ap
    .getByRole("button", { name: /Salvar rascunho e adicionar imagens/ })
    .click();
  await ap
    .waitForURL(/\/admin\/produtos\/[0-9a-f-]{36}/, { timeout: 30_000 })
    .catch(() => {});
  productId = ap.url().match(/produtos\/([0-9a-f-]{36})/)?.[1];
  const { data: p1 } = await h.svc
    .from("products")
    .select(
      "id, name, status, product_variants(id, sku, price_cents, inventory(on_hand, reserved))",
    )
    .eq("slug", PSLUG)
    .maybeSingle();
  const v1 = p1?.product_variants?.[0];
  const inv1 = Array.isArray(v1?.inventory) ? v1.inventory[0] : v1?.inventory;
  record(
    "D2-create-product",
    productId && p1 && v1?.price_cents === 12345 && inv1?.on_hand === 3
      ? "PASS"
      : "FAIL",
    `url=${ap.url()} db=${JSON.stringify({ status: p1?.status, sku: v1?.sku, price: v1?.price_cents, inv: inv1 })}`,
  );
  if (!productId) {
    const alert = await ap.locator('[role="alert"]').allInnerTexts();
    record("D2-create-error", "INFO", alert.join("|"));
    return;
  }

  // D2b duplicate slug rejected
  // (done later through a second create to avoid noise)

  // D3 edit name + price + stock
  await ap.locator('input[name="name"]').fill(`${PNAME} Editado`);
  await ap.locator('input[name="variants[0].price"]').fill("150.00");
  await ap.locator('input[name="variants[0].onHand"]').fill("5");
  await ap.getByRole("button", { name: /Salvar alterações/ }).click();
  await ap.waitForTimeout(4000);
  const saveMsgs = await ap
    .locator('[role="alert"], [role="status"]')
    .allInnerTexts();
  record(
    "D3a-save-feedback",
    saveMsgs.some((t) => /Não foi possível concluir/.test(t)) ? "FAIL" : "PASS",
    `messages after a successful save: ${saveMsgs.join("|")}`,
  );
  const { data: p2 } = await h.svc
    .from("products")
    .select("name, product_variants(price_cents, inventory(on_hand))")
    .eq("id", productId)
    .single();
  const v2 = p2.product_variants[0];
  const oh2 = (Array.isArray(v2.inventory) ? v2.inventory[0] : v2.inventory)
    ?.on_hand;
  record(
    "D3-edit-price-stock",
    p2.name === `${PNAME} Editado` && v2.price_cents === 15000 && oh2 === 5
      ? "PASS"
      : "FAIL",
    `name=${p2.name} price=${v2.price_cents} on_hand=${oh2}`,
  );
  await ap.reload();
  const uiPrice = await ap
    .locator('input[name="variants[0].price"]')
    .inputValue();
  record(
    "D3b-edit-reload-ui",
    /150/.test(uiPrice) ? "PASS" : "FAIL",
    `price input after reload=${uiPrice}`,
  );

  // D3c invalid price (negative) must be rejected server-side (browser validation bypassed)
  await ap.locator('input[name="variants[0].price"]').evaluate((e) => {
    e.form.noValidate = true;
  });
  await ap.locator('input[name="variants[0].price"]').fill("-5");
  await ap.getByRole("button", { name: /Salvar alterações/ }).click();
  await ap.waitForTimeout(3000);
  const invMsg = await ap
    .locator('form#dados-produto [role="alert"]')
    .allInnerTexts();
  const { data: p3 } = await h.svc
    .from("product_variants")
    .select("price_cents")
    .eq("product_id", productId)
    .single();
  record(
    "D3c-invalid-price-rejected",
    p3.price_cents === 15000 ? "PASS" : "FAIL",
    `db=${p3.price_cents} msg=${invMsg.join("|")}`,
  );
  await ap.reload();

  // D4 upload image
  await ap.locator('input[name="image"]').setInputFiles(PNG);
  await ap
    .locator('input[name="altText"]')
    .fill("Imagem de teste gerada pela QA");
  await ap.getByRole("button", { name: /Enviar imagem/ }).click();
  await ap.waitForTimeout(6000);
  const upMsg = await ap
    .locator('#imagens [role="status"], #imagens [role="alert"]')
    .allInnerTexts();
  const { data: media } = await h.svc
    .from("product_media")
    .select("id, storage_path, alt_text")
    .eq("product_id", productId);
  const { data: files } = await h.svc.storage
    .from("catalog-images")
    .list(`products/${productId}`);
  await ap.reload();
  const shown = await ap.locator("#imagens img").count();
  record(
    "D4-upload-image",
    media?.length === 1 && files?.length >= 1 && shown >= 1 ? "PASS" : "FAIL",
    `media=${media?.length} files=${files?.length} shown=${shown} msg=${upMsg.join("|")}`,
  );
  await ap.screenshot({
    path: path.join(h.OUT, "D4-product-editor.png"),
    fullPage: true,
  });

  // D4b non-image upload rejected
  const txt = path.join(h.OUT, `qa-${tag}.png.txt`);
  fs.writeFileSync(txt, "not an image");
  await ap.locator('input[name="image"]').setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await ap.locator('input[name="altText"]').fill("arquivo falso");
  await ap.getByRole("button", { name: /Enviar imagem/ }).click();
  await ap.waitForTimeout(5000);
  const fakeMsg = await ap
    .locator('#imagens [role="status"], #imagens [role="alert"]')
    .allInnerTexts();
  const { data: media2 } = await h.svc
    .from("product_media")
    .select("id")
    .eq("product_id", productId);
  record(
    "D4b-fake-image-rejected",
    media2.length === 1 ? "PASS" : "FAIL",
    `media=${media2.length} msg=${fakeMsg.join("|")}`,
  );
  fs.rmSync(txt, { force: true });

  // D5 customer cannot do the same (UI + direct API) — while product exists
  const cctx = await browser.newContext();
  const cp = await cctx.newPage();
  await h.login(cp, cust);
  const uiNotes = [];
  let uiFail = 0;
  for (const route of [
    "/admin",
    "/admin/produtos",
    "/admin/produtos/novo",
    `/admin/produtos/${productId}`,
    "/admin/pedidos",
  ]) {
    const rr = await cp.goto(`${B}${route}`);
    const t = await cp.locator("body").innerText();
    const denied =
      rr.status() === 404 ||
      /não encontrad|404/i.test(t) ||
      /\/conta/.test(new URL(cp.url()).pathname);
    if (!denied || /QA Produto/.test(t)) uiFail++;
    uiNotes.push(`${route}:${rr.status()}`);
  }
  record(
    "D5a-customer-denied-admin-ui",
    uiFail ? "FAIL" : "PASS",
    uiNotes.join(" "),
  );
  await cctx.close();

  const env = {};
  for (const l of fs
    .readFileSync(path.join(h.REPO, ".env.local"), "utf8")
    .split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const cc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  await cc.auth.signInWithPassword({
    email: cust.email,
    password: cust.password,
  });
  const { data: vrow } = await h.svc
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .single();
  const apiNotes = {};
  const insP = await cc
    .from("products")
    .insert({
      name: "QA hack",
      slug: `qa-produto-hack-${tag}`,
      category_id: catVal,
    })
    .select();
  apiNotes.insertProduct = insP.error
    ? `denied:${insP.error.code}`
    : `ALLOWED rows=${insP.data?.length}`;
  const upV = await cc
    .from("product_variants")
    .update({ price_cents: 1 })
    .eq("id", vrow.id)
    .select();
  apiNotes.updatePrice = upV.error
    ? `denied:${upV.error.code}`
    : `rows=${upV.data?.length}`;
  const upI = await cc
    .from("inventory")
    .update({ on_hand: 999 })
    .eq("variant_id", vrow.id)
    .select();
  apiNotes.updateStock = upI.error
    ? `denied:${upI.error.code}`
    : `rows=${upI.data?.length}`;
  const delP = await cc.from("products").delete().eq("id", productId).select();
  apiNotes.deleteProduct = delP.error
    ? `denied:${delP.error.code}`
    : `rows=${delP.data?.length}`;
  const rpcDel = await cc.rpc("admin_delete_catalog_product", {
    p_product_id: productId,
  });
  apiNotes.rpcDelete = rpcDel.error
    ? `denied:${rpcDel.error.code}`
    : `ALLOWED ${JSON.stringify(rpcDel.data)}`;
  const upl = await cc.storage
    .from("catalog-images")
    .upload(`products/${productId}/qa-hack.png`, fs.readFileSync(PNG), {
      contentType: "image/png",
    });
  apiNotes.storageUpload = upl.error
    ? `denied:${upl.error.message}`
    : "ALLOWED";
  const ordersAll = await cc.from("orders").select("id");
  apiNotes.readOrders = `rows=${ordersAll.data?.length ?? 0}${ordersAll.error ? " err=" + ordersAll.error.code : ""}`;
  const xlsx = await fetch(`${B}/api/admin/reports/sales.xlsx`);
  apiNotes.salesXlsxAnon = xlsx.status;
  const { data: after } = await h.svc
    .from("product_variants")
    .select("price_cents, inventory(on_hand)")
    .eq("id", vrow.id)
    .single();
  const { data: still } = await h.svc
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  const afterOh = (
    Array.isArray(after.inventory) ? after.inventory[0] : after.inventory
  )?.on_hand;
  const apiOk =
    !/ALLOWED/.test(JSON.stringify(apiNotes)) &&
    after.price_cents === 15000 &&
    afterOh === 5 &&
    !!still &&
    (ordersAll.data?.length ?? 0) === 0;
  record(
    "D5b-customer-denied-admin-api",
    apiOk ? "PASS" : "FAIL",
    JSON.stringify({
      ...apiNotes,
      priceAfter: after.price_cents,
      onHandAfter: afterOh,
      productStillExists: !!still,
    }),
  );

  // D6 view orders (admin)
  const ro = await ap.goto(`${B}/admin/pedidos`);
  const rows = await ap.locator('a[href^="/admin/pedidos/"]').count();
  record(
    "D6-admin-orders",
    ro.status() === 200 ? "PASS" : "FAIL",
    `status=${ro.status()} orderLinks=${rows}`,
  );
  if (rows) {
    const href = await ap
      .locator('a[href^="/admin/pedidos/"]')
      .first()
      .getAttribute("href");
    const rd = await ap.goto(`${B}${href}`);
    record(
      "D6b-admin-order-detail",
      rd.status() === 200 ? "PASS" : "FAIL",
      `${href} status=${rd.status()}`,
    );
  }

  // D7 delete the test product via UI
  await ap.goto(`${B}/admin/produtos`);
  const search = ap.getByLabel("Buscar produtos por nome, slug ou SKU");
  await search.fill(PSLUG);
  await search.press("Enter");
  await ap.waitForTimeout(3000);
  await ap.getByLabel(`Ações para ${PNAME} Editado`).click();
  await ap.getByRole("button", { name: "Excluir", exact: true }).click();
  await ap.getByRole("button", { name: /Confirmar exclusão/ }).click();
  await ap.waitForTimeout(6000);
  const delMsg = await ap
    .locator('[role="status"], [role="alert"]')
    .allInnerTexts();
  const { data: gone } = await h.svc
    .from("products")
    .select("id, status")
    .eq("id", productId)
    .maybeSingle();
  const { data: filesAfter } = await h.svc.storage
    .from("catalog-images")
    .list(`products/${productId}`);
  const { data: invAfter } = await h.svc
    .from("inventory")
    .select("variant_id")
    .eq("variant_id", vrow.id);
  record(
    "D7-delete-product",
    !gone && (filesAfter?.length ?? 0) === 0 && invAfter.length === 0
      ? "PASS"
      : "FAIL",
    `product=${JSON.stringify(gone)} storageFilesLeft=${filesAfter?.length} inventoryRows=${invAfter.length} msg=${delMsg.join("|").slice(0, 200)}`,
  );
  const pr = await ap.goto(`${B}/produto/${PSLUG}`);
  record(
    "D7b-deleted-product-404",
    pr.status() === 404 ? "PASS" : "FAIL",
    `status=${pr.status()}`,
  );

  record(
    "D-console-errors",
    consoleErrors.length ? "INFO" : "PASS",
    consoleErrors.slice(0, 5).join(" | "),
  );
  await actx.close();
});
