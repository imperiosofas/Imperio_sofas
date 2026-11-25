/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright spec */
// Scenario E — failure modes: offline add-to-cart, slow network, 404 pages,
// invalid inputs, double click on "Ir para o pagamento", reload during
// checkout submit, rejected / pending mock payments, expired session.
const { test } = require("@playwright/test");
const path = require("path");
const crypto = require("crypto");
const h = require("./qa-helpers.cjs");

const { record, save } = h.recorder("e-failures");
const u = h.mkCreds("qa-e");
const cleanupLog = {};
let josyVariant;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await h.createUser(u);
  const { data: p } = await h.svc
    .from("products")
    .select("id")
    .eq("slug", h.SLUG)
    .single();
  const { data: v } = await h.svc
    .from("product_variants")
    .select("id")
    .eq("product_id", p.id)
    .single();
  josyVariant = v.id;
});
test.afterAll(async () => {
  await h.deleteUser(u, cleanupLog);
  save({ cleanup: cleanupLog });
  console.log("CLEANUP", JSON.stringify(cleanupLog));
});

const cartQty = async () => {
  const { data } = await h.svc
    .from("carts")
    .select("cart_items(variant_id, quantity)")
    .eq("user_id", u.id)
    .maybeSingle();
  return (data?.cart_items ?? []).reduce((s, i) => s + i.quantity, 0);
};
const orders = async () =>
  (
    await h.svc
      .from("orders")
      .select("id, status, created_at")
      .eq("customer_id", u.id)
      .order("created_at")
  ).data ?? [];
const inv = async () =>
  (
    await h.svc
      .from("inventory")
      .select("on_hand, reserved")
      .eq("variant_id", josyVariant)
      .single()
  ).data;
const clearCart = async () => {
  const { data } = await h.svc
    .from("carts")
    .select("id")
    .eq("user_id", u.id)
    .maybeSingle();
  if (data) await h.svc.from("cart_items").delete().eq("cart_id", data.id);
};
// Cancel pending orders created by a sub-test (UI button) so the next test starts clean.
async function cancelPendingViaUi(page) {
  for (const o of await orders()) {
    if (o.status !== "pending_payment") continue;
    await page.goto(`${h.BASE}/pedido/${o.id}`);
    const b = page.getByRole("button", { name: "Cancelar pedido" });
    if (await b.count()) {
      await b.click();
      await page.waitForTimeout(2500);
    }
  }
}

test("E1 404 pages", async ({ request }) => {
  const cases = [
    "/rota-inexistente",
    "/produto/qa-produto-nao-existe-123",
    "/loja/categoria-inexistente",
    "/pedido/00000000-0000-4000-8000-000000000000",
    "/pedido/abc",
    "/admin/pedidos/00000000-0000-4000-8000-000000000000",
    "/api/rota-inexistente",
  ];
  for (const c of cases) {
    const r = await request.get(`${h.BASE}${c}`, { maxRedirects: 0 });
    const body = await r.text();
    const title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const loc = r.headers()["location"] ?? "";
    const st = r.status();
    const ok = st === 404 || (st >= 300 && st < 400 && /\/conta/.test(loc));
    record(
      `E1-404 ${c}`,
      ok ? "PASS" : "FAIL",
      `status=${st} location=${loc} title=${title}`,
    );
  }
});

test("E2 invalid inputs on auth", async ({ page }) => {
  await page.goto(`${h.BASE}/conta`);
  await page.locator("#auth-email").fill("abc");
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.waitForTimeout(800);
  let a = await page.locator('[role="alert"]').allInnerTexts();
  const native = await page
    .locator("#auth-email")
    .evaluate((e) => e.validationMessage);
  record(
    "E2a-invalid-email",
    a.some((t) => /e-mail válido/.test(t)) || native ? "PASS" : "FAIL",
    `alert=${a.join("|")} native=${native}`,
  );

  await page.locator("#auth-email").fill("");
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.waitForTimeout(800);
  const step = await page
    .locator("[data-auth-shell]")
    .getAttribute("data-auth-step");
  record("E2b-empty-email", step === "email" ? "PASS" : "FAIL", `step=${step}`);

  await page.locator("#auth-email").fill(u.email);
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill("senha-errada-123");
  await page.locator("#auth-password").press("Enter");
  await page.waitForTimeout(4000);
  a = await page.locator('[role="alert"]').allInnerTexts();
  const logged = (await page.getByRole("button", { name: "Sair" }).count()) > 0;
  record(
    "E2c-wrong-password",
    !logged && a.join("").length > 0 ? "PASS" : "FAIL",
    a.join("|"),
  );

  // register: mismatch + weak password
  await page.goto(`${h.BASE}/conta`);
  await page.locator("#auth-tab-register").click();
  const reg = `qa-e-reg-${crypto.randomBytes(3).toString("hex")}@example.test`;
  await page.locator("#auth-email").fill(reg);
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill("Abcdef123!");
  await page.locator("#auth-confirm-password").fill("Abcdef123?");
  await page.locator("#auth-confirm-password").press("Enter");
  await page.waitForTimeout(1500);
  a = await page.locator('[role="alert"]').allInnerTexts();
  record(
    "E2d-register-mismatch",
    a.some((t) => /não coincidem/.test(t)) ? "PASS" : "FAIL",
    a.join("|"),
  );
  await page.locator("#auth-password").fill("123");
  await page.locator("#auth-confirm-password").fill("123");
  await page.locator("#auth-confirm-password").press("Enter");
  await page.waitForTimeout(4000);
  a = await page.locator('[role="alert"]').allInnerTexts();
  const nativeLen = await page
    .locator("#auth-password")
    .evaluate((e) => e.validationMessage);
  const { data: list } = await h.svc.auth.admin.listUsers({ perPage: 1000 });
  const made = list.users.find((x) => x.email === reg);
  if (made) await h.svc.auth.admin.deleteUser(made.id);
  record(
    "E2e-register-weak-password",
    !made ? "PASS" : "FAIL",
    `userCreated=${!!made} alert=${a.join("|")} native=${nativeLen}`,
  );

  // search with special chars / very long query
  const evil = `<script>window.__qa_xss=1</script>"'%`;
  const r = await page.goto(`${h.BASE}/loja?q=${encodeURIComponent(evil)}`);
  const xss = await page.evaluate(() => window.__qa_xss === 1);
  record(
    "E2f-search-special-chars",
    r.status() === 200 && !xss ? "PASS" : "FAIL",
    `status=${r.status()} xssExecuted=${xss}`,
  );
  const r2 = await page.goto(`${h.BASE}/loja?q=${"a".repeat(3000)}`);
  record(
    "E2g-search-very-long",
    r2.status() < 500 ? "PASS" : "FAIL",
    `status=${r2.status()}`,
  );
  const r3 = await page.goto(`${h.BASE}/loja?page=-1&sort=hack&min=abc`);
  record(
    "E2h-listing-bad-params",
    r3.status() < 500 ? "PASS" : "FAIL",
    `status=${r3.status()}`,
  );
});

test("E3 offline + slow network on add-to-cart", async ({ page, context }) => {
  await h.login(page, u);
  await clearCart();
  await page.goto(`${h.BASE}/produto/${h.SLUG}`);
  await page.waitForLoadState("networkidle");
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await context.setOffline(true);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(4000);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const statusMsgs = await page
    .locator('[role="status"], [role="alert"]')
    .allInnerTexts();
  const btnStill = await page
    .getByRole("button", { name: /Adicionar ao carrinho|Adicionando/ })
    .count();
  await page.screenshot({
    path: path.join(h.OUT, "E3-offline.png"),
    fullPage: false,
  });
  await context.setOffline(false);
  const crashed =
    /Application error|Algo deu errado|client-side exception/i.test(body) ||
    btnStill === 0;
  record(
    "E3a-offline-add-to-cart",
    !crashed && statusMsgs.join("").length > 0 ? "PASS" : "FAIL",
    `cartQty=${await cartQty()} feedback=${statusMsgs.join("|")} buttonPresent=${btnStill} pageErrors=${pageErrors.slice(0, 2).join("|")} body=${body.slice(0, 160)}`,
  );
  // Recovery after reconnect
  await page.goto(`${h.BASE}/produto/${h.SLUG}`);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(3000);
  record(
    "E3b-recover-after-offline",
    (await cartQty()) === 1 ? "PASS" : "FAIL",
    `cartQty=${await cartQty()}`,
  );

  // Slow network: delay server actions 4s; button must show pending + be disabled; one add only.
  await clearCart();
  await page.goto(`${h.BASE}/produto/${h.SLUG}`);
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  const btn = page.getByRole("button", {
    name: /Adicionar ao carrinho|Adicionando/,
  });
  await btn.click();
  await page.waitForTimeout(500);
  const label = await btn.innerText();
  const disabled = await btn.isDisabled();
  await btn.click({ force: true, timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(7000);
  await page.unroute("**/*");
  const q = await cartQty();
  record(
    "E3c-slow-network-pending-state",
    disabled && /Adicionando/.test(label) ? "PASS" : "FAIL",
    `label=${label} disabled=${disabled}`,
  );
  record(
    "E3d-slow-network-no-duplicate",
    q === 1 ? "PASS" : "FAIL",
    `cartQty after click+click during pending=${q}`,
  );
  record(
    "E3e-pageerrors",
    pageErrors.length ? "INFO" : "PASS",
    pageErrors.slice(0, 3).join(" | "),
  );
});

test("E4 checkout robustness + payment states", async ({ page, context }) => {
  await h.login(page, u);
  const inv0 = await inv();

  // E4a submit without accepting terms
  await clearCart();
  await h.addJosyToCart(page);
  await page.goto(`${h.BASE}/checkout`);
  const sel = page.locator("select").first();
  if (await sel.count()) {
    const val = await sel.locator("option").nth(1).getAttribute("value");
    if (val) await sel.selectOption(val);
  }
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForTimeout(3000);
  const termsMsg = await page.locator('[role="alert"]').allInnerTexts();
  record(
    "E4a-terms-required",
    page.url().includes("/checkout") && (await orders()).length === 0
      ? "PASS"
      : "FAIL",
    `url=${page.url()} alert=${termsMsg.join("|")}`,
  );

  // E4b double click "Ir para o pagamento"
  await h.fillCheckoutPickup(page);
  await page.getByRole("button", { name: /Ir para o pagamento/ }).dblclick();
  await page.waitForURL(/\/pedido\//, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  let os = await orders();
  const invA = await inv();
  record(
    "E4b-double-click-single-order",
    os.length === 1 ? "PASS" : "FAIL",
    `orders=${os.length} reservedDelta=${invA.reserved - inv0.reserved}`,
  );

  // E4c pending state
  const pid = os[0]?.id;
  if (pid) {
    await page.goto(`${h.BASE}/pedido/${pid}`);
    const h1 = await page.locator("h1").first().innerText();
    record(
      "E4c-pending-state",
      os[0].status === "pending_payment" &&
        /Aguardando/.test(h1) &&
        invA.reserved - inv0.reserved === 1
        ? "PASS"
        : "FAIL",
      `h1=${h1} reservedDelta=${invA.reserved - inv0.reserved}`,
    );
    await page.goto(`${h.BASE}/pedido/${pid}?retorno=pendente`);
    const banner = await page.locator('[role="status"]').allInnerTexts();
    record(
      "E4c2-pending-return-banner",
      banner.join("").length ? "PASS" : "FAIL",
      banner.join("|").slice(0, 200),
    );

    // E4c3 a second checkout while the first order is still pending (cart is kept until paid)
    await page.goto(`${h.BASE}/checkout`);
    const canCheckoutAgain =
      (await page
        .getByRole("button", { name: /Ir para o pagamento/ })
        .count()) > 0;
    record(
      "E4c3-cart-kept-while-pending",
      "INFO",
      `checkout available again while order pending=${canCheckoutAgain}`,
    );

    // E4d rejected payment
    await page.goto(`${h.BASE}/pedido/${pid}?pagar=teste`);
    await page
      .getByRole("button", { name: /Simular pagamento recusado/ })
      .click();
    await page.waitForTimeout(3500);
    await page.reload();
    const { data: o } = await h.svc
      .from("orders")
      .select("status")
      .eq("id", pid)
      .single();
    const { data: pay } = await h.svc
      .from("order_payments")
      .select("status")
      .eq("order_id", pid);
    const h1r = await page.locator("h1").first().innerText();
    const bannerR = await page
      .locator('[role="status"], [role="alert"]')
      .allInnerTexts();
    const invR = await inv();
    const canRetry =
      (await page.getByRole("button", { name: /Pagar agora/ }).count()) > 0;
    record(
      "E4d-rejected-payment",
      o.status !== "paid" ? "PASS" : "FAIL",
      `order=${o.status} payments=${JSON.stringify(pay)} h1=${h1r} retryButton=${canRetry} reservedDelta=${invR.reserved - inv0.reserved} onHandDelta=${invR.on_hand - inv0.on_hand} msg=${bannerR.join("|").slice(0, 160)}`,
    );
    await page.screenshot({
      path: path.join(h.OUT, "E4d-rejected.png"),
      fullPage: true,
    });
  }
  await cancelPendingViaUi(page);
  const afterCancel = await inv();
  record(
    "E4e-cancel-releases-reservation",
    afterCancel.reserved === inv0.reserved ? "PASS" : "FAIL",
    `reserved=${afterCancel.reserved} base=${inv0.reserved} orders=${JSON.stringify((await orders()).map((x) => x.status))}`,
  );

  // E4f reload during checkout submit
  const before = (await orders()).length;
  await h.fillCheckoutPickup(page);
  await page.route("**/checkout", async (route) => {
    if (route.request().method() === "POST")
      await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => {});
  });
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForTimeout(300);
  await page.reload().catch(() => {});
  await page.unroute("**/checkout");
  await page.waitForTimeout(5000);
  const mid = (await orders()).length - before;
  const urlAfterReload = page.url();
  // user retries after the reload
  let retried = "n/a";
  if (urlAfterReload.includes("/checkout")) {
    await h.fillCheckoutPickup(page);
    await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
    await page.waitForURL(/\/pedido\//, { timeout: 30_000 }).catch(() => {});
    retried = page.url();
  }
  await page.waitForTimeout(2000);
  os = await orders();
  const created = os.length - before;
  const pendingNow = os.filter((x) => x.status === "pending_payment").length;
  const invF = await inv();
  record(
    "E4f-reload-during-submit",
    pendingNow <= 1 ? "PASS" : "FAIL",
    `ordersCreatedByAbortedSubmit=${mid} totalNewOrders=${created} pendingNow=${pendingNow} reservedDelta=${invF.reserved - inv0.reserved} afterReloadUrl=${urlAfterReload} retry=${retried}`,
  );
  await cancelPendingViaUi(page);

  // E5 expired session: clear cookies at checkout, then submit
  await clearCart();
  await h.addJosyToCart(page);
  await h.fillCheckoutPickup(page);
  const n0 = (await orders()).length;
  await context.clearCookies();
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForTimeout(5000);
  const n1 = (await orders()).length;
  const bodyE = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  record(
    "E5a-expired-session-checkout",
    n1 === n0 &&
      (/\/conta/.test(page.url()) || /entre|login|sessão/i.test(bodyE))
      ? "PASS"
      : "FAIL",
    `ordersCreated=${n1 - n0} url=${page.url()} body=${bodyE.slice(0, 160)}`,
  );
  // expired session on add-to-cart
  await page.goto(`${h.BASE}/produto/${h.SLUG}`);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(3000);
  record(
    "E5b-expired-session-add-to-cart",
    /\/conta\?next=/.test(page.url()) ? "PASS" : "FAIL",
    page.url(),
  );
  const prot = await page.goto(`${h.BASE}/conta/pedidos`);
  record(
    "E5c-expired-session-protected-page",
    /\/conta(\?|$)/.test(page.url().replace(h.BASE, "")) ? "PASS" : "FAIL",
    `status=${prot.status()} url=${page.url()}`,
  );
});
