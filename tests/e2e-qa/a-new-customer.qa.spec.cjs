/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright spec */
// Scenario A — new customer: browse categories, store search, product details,
// favorite (anon -> login wall), sign up via UI, favorite, cart, pickup checkout,
// mock-approve, order visible in /conta/pedidos.
const { test } = require("@playwright/test");
const path = require("path");
const h = require("./qa-helpers.cjs");

const { record, save } = h.recorder("a-new-customer");
const u = h.mkCreds("qa-a");
const cleanupLog = {};

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!u.id) {
    const { data } = await h.svc.auth.admin.listUsers({ perPage: 1000 });
    u.id = data.users.find((x) => x.email === u.email)?.id;
  }
  await h.deleteUser(u, cleanupLog);
  save({ cleanup: cleanupLog });
  console.log("CLEANUP", JSON.stringify(cleanupLog));
});

test("Scenario A - new customer", async ({ page }) => {
  const consoleErrors = [];
  page.on(
    "console",
    (m) => m.type() === "error" && consoleErrors.push(m.text()),
  );
  const B = h.BASE;

  // A1 home + /loja
  let r = await page.goto(`${B}/`);
  record(
    "A1-home",
    r.status() === 200 ? "PASS" : "FAIL",
    `status=${r.status()}`,
  );
  r = await page.goto(`${B}/loja`);
  const cats = [
    ...new Set(
      await page
        .locator('a[href^="/loja/"]')
        .evaluateAll((as) =>
          as.map((a) => a.getAttribute("href").split("?")[0]),
        ),
    ),
  ];
  record(
    "A1-loja",
    r.status() === 200 && cats.length > 0 ? "PASS" : "FAIL",
    `categories=${cats.join(",")}`,
  );

  // A2 each category page renders products
  const catNotes = [];
  let catFail = 0;
  for (const c of cats) {
    const cr = await page.goto(`${B}${c}`);
    const n = await page.locator('a[href^="/produto/"]').count();
    catNotes.push(`${c}:${cr.status()}/${n}`);
    if (cr.status() !== 200) catFail++;
  }
  record("A2-categories", catFail ? "FAIL" : "PASS", catNotes.join(" "));

  // A3 store search
  await page.goto(`${B}/loja`);
  await page.locator('input[name="q"]').first().fill("Josy");
  await page.locator('input[name="q"]').first().press("Enter");
  await page.waitForURL(/q=Josy/i, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const hits = await page.locator(`a[href="/produto/${h.SLUG}"]`).count();
  const allHits = await page
    .locator('a[href^="/produto/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  record(
    "A3-search",
    hits > 0 ? "PASS" : "FAIL",
    `url=${page.url()} results=${allHits.join(",")}`,
  );
  // search no results
  await page.goto(`${B}/loja?q=zzqqxxnaoexiste`);
  const empty = (await page.locator('a[href^="/produto/"]').count()) === 0;
  const emptyMsg = await page.locator("main").innerText();
  record(
    "A3-search-empty",
    empty ? "PASS" : "FAIL",
    emptyMsg.replace(/\s+/g, " ").slice(0, 160),
  );

  // A4 product details
  await page.goto(`${B}/loja?q=Josy`);
  await page.locator(`a[href="/produto/${h.SLUG}"]`).first().click();
  await page.waitForURL(new RegExp(`/produto/${h.SLUG}`));
  const title = await page.locator("h1").first().innerText();
  const price = await page
    .getByText(/R\$\s?\d/)
    .first()
    .innerText()
    .catch(() => "");
  const imgs = await page
    .locator('section[aria-label="Fotos do produto"] img')
    .count();
  const addBtn = await page
    .getByRole("button", { name: "Adicionar ao carrinho" })
    .count();
  record(
    "A4-product-details",
    title && price && imgs > 0 && addBtn ? "PASS" : "FAIL",
    `h1=${title} price=${price} imgs=${imgs}`,
  );
  await page.screenshot({
    path: path.join(h.OUT, "A4-product.png"),
    fullPage: true,
  });

  // A5 favorite as anonymous -> login wall
  await page
    .getByRole("button", { name: "Adicionar aos favoritos" })
    .first()
    .click();
  await page.waitForURL(/\/conta\?next=/, { timeout: 15_000 }).catch(() => {});
  record(
    "A5-favorite-anon-login-wall",
    /\/conta\?next=/.test(page.url()) ? "PASS" : "FAIL",
    page.url(),
  );

  // A5b add to cart as anonymous -> login wall
  await page.goto(`${B}/produto/${h.SLUG}`);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await page.waitForTimeout(3000);
  record("A5b-cart-anon", "INFO", `after click url=${page.url()}`);

  // A6 sign up via UI
  await page.goto(
    `${B}/conta?next=${encodeURIComponent(`/produto/${h.SLUG}`)}`,
  );
  await page.locator("#auth-tab-register").click();
  await page.locator("#auth-email").fill(u.email);
  await page.getByRole("button", { name: "Continuar com e-mail" }).click();
  await page.locator("#auth-password").fill(u.password);
  await page.locator("#auth-confirm-password").fill(u.password);
  await page.locator("#auth-confirm-password").press("Enter");
  await page.waitForTimeout(5000);
  const view = await page
    .locator("[data-auth-shell]")
    .getAttribute("data-auth-view")
    .catch(() => null);
  const bodyTxt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const loggedNow =
    (await page.getByRole("button", { name: "Sair" }).count()) > 0;
  const { data: list } = await h.svc.auth.admin.listUsers({ perPage: 1000 });
  const created = list.users.find((x) => x.email === u.email);
  if (created) u.id = created.id;
  record(
    "A6-signup-ui",
    created ? (loggedNow ? "PASS" : "INFO") : "FAIL",
    `userCreated=${!!created} confirmed=${!!created?.email_confirmed_at} view=${view} url=${page.url()} msg=${bodyTxt.slice(0, 200)}`,
  );
  await page.screenshot({ path: path.join(h.OUT, "A6-signup.png") });

  // Unconfirmed login attempt (records the email-confirmation block)
  if (created && !created.email_confirmed_at) {
    await page.goto(`${B}/conta`);
    await page.locator("#auth-email").fill(u.email);
    await page.getByRole("button", { name: "Continuar com e-mail" }).click();
    await page.locator("#auth-password").fill(u.password);
    await page.locator("#auth-password").press("Enter");
    await page.waitForTimeout(4000);
    const err = await page.locator('[role="alert"]').allInnerTexts();
    record(
      "A6b-login-before-confirm",
      "INFO",
      `blocked; alert=${err.join(" | ")}`,
    );
    await h.svc.auth.admin.updateUserById(created.id, { email_confirm: true });
  }
  if (!u.id) {
    await h.createUser(u);
    record(
      "A6c-fallback-admin-create",
      "INFO",
      "signup did not create user; created via admin API",
    );
  }
  if (!loggedNow) await h.login(page, u);
  record("A6d-logged-in", "PASS");

  // A7 favorite logged in
  await page.goto(`${B}/produto/${h.SLUG}`);
  await page
    .getByRole("button", { name: "Adicionar aos favoritos" })
    .first()
    .click();
  await page.waitForTimeout(3000);
  const pressed = await page
    .getByRole("button", { name: /favoritos/ })
    .first()
    .getAttribute("aria-pressed");
  await page.goto(`${B}/conta/favoritos`);
  const favListed = (await page.getByText(/Josy/i).count()) > 0;
  const { data: favRows } = await h.svc
    .from("product_favorites")
    .select("product_id")
    .eq("user_id", u.id);
  record(
    "A7-favorite",
    pressed === "true" && favListed && favRows.length === 1 ? "PASS" : "FAIL",
    `aria-pressed=${pressed} listed=${favListed} rows=${favRows?.length}`,
  );

  // A8 add to cart
  await h.addJosyToCart(page);
  await page.goto(`${B}/carrinho`);
  const inCart = (await page.getByText(/Josy/i).count()) > 0;
  record("A8-add-to-cart", inCart ? "PASS" : "FAIL");

  // A9 checkout pickup
  await h.fillCheckoutPickup(page);
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await page.waitForURL(/\/pedido\//, { timeout: 30_000 }).catch(() => {});
  const orderId = page.url().match(/pedido\/([0-9a-f-]{36})/)?.[1];
  record("A9-checkout-pickup", orderId ? "PASS" : "FAIL", page.url());
  if (!orderId) return;
  const pendingLabel = await page.locator("h1").first().innerText();
  const { data: inv1 } = await h.svc
    .from("orders")
    .select(
      "status, order_number, total_cents, order_items(variant_id, quantity)",
    )
    .eq("id", orderId)
    .single();
  record(
    "A9b-order-pending",
    inv1.status === "pending_payment" ? "PASS" : "FAIL",
    `h1=${pendingLabel} status=${inv1.status}`,
  );
  const cartRows = async () => {
    const { data: cart } = await h.svc
      .from("carts")
      .select("id, cart_items(variant_id, quantity)")
      .eq("user_id", u.id)
      .maybeSingle();
    return cart?.cart_items?.length ?? 0;
  };
  // By design the cart is only cleared when payment is approved (order_apply_payment_event).
  record(
    "A9c-cart-kept-while-pending",
    "INFO",
    `cart_items while pending=${await cartRows()}`,
  );

  // A10 mock approve
  await page
    .getByRole("button", { name: /Simular pagamento aprovado/ })
    .click();
  await page.waitForTimeout(3000);
  await page.reload();
  const h1 = await page.locator("h1").first().innerText();
  const { data: o } = await h.svc
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  record(
    "A10-mock-approved",
    o.status === "paid" && /confirmado/i.test(h1) ? "PASS" : "FAIL",
    `status=${o.status} h1=${h1}`,
  );
  await page.screenshot({
    path: path.join(h.OUT, "A10-paid.png"),
    fullPage: true,
  });
  const left = await cartRows();
  record(
    "A10b-cart-cleared-after-paid",
    left === 0 ? "PASS" : "FAIL",
    `cart_items=${left}`,
  );

  // A11 order in /conta/pedidos
  await page.goto(`${B}/conta/pedidos`);
  const listed =
    (await page.locator(`a[href="/pedido/${orderId}"]`).count()) > 0;
  const numTxt =
    (await page
      .getByText(new RegExp(`Pedido nº ${inv1.order_number}`))
      .count()) > 0;
  record(
    "A11-orders-list",
    listed && numTxt ? "PASS" : "FAIL",
    `order_number=${inv1.order_number}`,
  );

  record(
    "A-console-errors",
    consoleErrors.length ? "INFO" : "PASS",
    consoleErrors.slice(0, 5).join(" | "),
  );
});
