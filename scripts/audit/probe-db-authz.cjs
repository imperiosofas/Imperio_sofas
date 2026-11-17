/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Node script */
// Live authorization probes for the Imperio Sofas TEST Supabase project.
// Creates two temporary users + their own rows, probes cross-tenant / admin / anon
// access, then deletes ONLY what it created. Never prints key values.
// Mutating probes that could touch PRE-EXISTING rows are executed via PostgREST GET
// (read-only transaction) or with random/nonexistent ids, so a vulnerability would
// surface as "executable" (25006 read-only error) instead of changing data.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const REPO = path.resolve(__dirname, "..", "..");
const { createClient } = require(
  path.join(REPO, "node_modules/@supabase/supabase-js"),
);

const env = {};
for (const line of fs
  .readFileSync(path.join(REPO, ".env.local"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = env.SUPABASE_SECRET_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error("missing env");
if (!URL_.includes("qsafyqsskwbjnailgoev"))
  throw new Error("refusing: not the test project");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL_, SERVICE, opts);
const anon = createClient(URL_, ANON, opts);
const rnd = () => crypto.randomUUID();
const results = [];
const created = { users: [], orders: [], storage: [] };

function rec(scenario, actor, probe, expected, res) {
  const err =
    res && res.error
      ? {
          code: res.error.code || res.error.statusCode || res.error.status,
          message: String(res.error.message || "").slice(0, 160),
        }
      : null;
  const rows =
    res && Array.isArray(res.data)
      ? res.data.length
      : res && res.data != null
        ? "non-null"
        : res
          ? res.data
          : undefined;
  const r = {
    scenario,
    actor,
    probe,
    expected,
    error: err,
    rows,
    status: res && res.status,
  };
  results.push(r);
  console.log(
    `[${scenario}] ${actor} | ${probe} | expected=${expected} | status=${r.status} rows=${JSON.stringify(rows)} err=${err ? err.code + " " + err.message : "-"}`,
  );
  return r;
}

const TABLES = [
  "categories",
  "products",
  "product_variants",
  "inventory",
  "product_media",
  "catalog_admins",
  "product_favorites",
  "product_reviews",
  "carts",
  "cart_items",
  "customer_profiles",
  "logistics_suppliers",
  "logistics_areas",
  "logistics_pickup_locations",
  "logistics_settings",
  "logistics_quotes",
  "logistics_quote_groups",
  "logistics_quote_items",
  "logistics_quote_events",
  "logistics_admin_events",
  "commerce_settings",
  "orders",
  "order_groups",
  "order_items",
  "order_payments",
  "order_events",
  "payment_webhook_events",
];

// RPCs to probe with GET (read-only tx). args are dummy/random so nothing real is targeted.
const R = rnd();
const ADMIN_RPCS = {
  admin_list_orders: { p_status: null, p_limit: 1 },
  admin_get_order: { p_order_id: R },
  admin_get_orders_summary: {},
  admin_get_sales_report: { p_from: "2026-01-01", p_to: "2026-01-02" },
  admin_set_order_group_status: { p_group_id: R, p_status: "completed" },
  admin_list_product_reviews: { p_status: null, p_limit: 1 },
  moderate_product_review: { p_review_id: R, p_status: "hidden" },
  admin_get_engagement_summary: {},
  admin_get_analytics_snapshot: { p_category_id: null },
  admin_list_catalog_products: {},
  admin_save_catalog_product: { p_product: "{}", p_variants: "[]" },
  admin_set_catalog_product_status: { p_product_id: R, p_status: "archived" },
  admin_delete_catalog_product: { p_product_id: R },
  admin_quick_edit_catalog_product: {
    p_product_id: R,
    p_name: "x",
    p_category_id: R,
    p_variants: "[]",
  },
  admin_adjust_catalog_inventory: { p_product_ids: [R], p_delta: 1 },
  admin_remove_catalog_product_media: { p_product_id: R, p_media_id: R },
  admin_claim_catalog_storage_cleanup: { p_cleanup_id: R },
  admin_list_catalog_storage_cleanup: {},
  admin_finish_catalog_storage_cleanup: {
    p_cleanup_id: R,
    p_claim_token: R,
    p_error_code: null,
  },
  admin_logistics_overview: {},
  admin_list_logistics_suppliers: {},
  admin_list_logistics_products: { p_query: null },
  admin_list_logistics_areas: {},
  admin_list_logistics_quotes: { p_status: null },
  admin_assign_product_supplier: { p_product_id: R, p_supplier_id: R },
  admin_assign_products_supplier: { p_product_ids: [R], p_supplier_id: R },
  admin_set_logistics_area: {
    p_ibge_code: "0000000",
    p_city_name: "x",
    p_enabled: false,
  },
  admin_update_logistics_settings: {
    p_floor_charge_cents: 1,
    p_included_through_floor: 1,
    p_quote_expiration_minutes: 1,
    p_whatsapp_phone_e164: null,
  },
  admin_set_logistics_group_freight: {
    p_quote_id: R,
    p_supplier_code: "VALE",
    p_base_freight_cents: 1,
  },
};
const SERVICE_ONLY_RPCS = {
  order_apply_payment_event: {
    p_provider: "mock",
    p_event_id: "audit-" + R,
    p_order_id: R,
    p_provider_payment_id: "x",
    p_status: "approved",
    p_amount_cents: 1,
  },
  order_register_payment: {
    p_order_id: R,
    p_provider: "mock",
    p_idempotency_key: R,
    p_preference_id: null,
    p_checkout_url: null,
  },
  expire_pending_orders: {},
  logistics_create_quote_server: {
    p_user_id: R,
    p_idempotency_key: R,
    p_supplier_modes: "[]",
    p_address: "{}",
  },
  import_legacy_catalog_product: {
    p_source_product_id: R,
    p_source_hash: "x",
    p_source_payload: "{}",
    p_category_id: R,
    p_product: "{}",
    p_variants: "[]",
    p_media: "[]",
    p_replace_test_fixture: false,
  },
  complete_legacy_catalog_cleanup: { p_source_product_id: R, p_paths: ["x"] },
  issue_email_mfa_challenge: {
    p_challenge_id: R,
    p_user_id: R,
    p_session_id: R,
    p_email: "x@example.test",
    p_code_hmac: "0".repeat(64),
  },
  verify_email_mfa_challenge: {
    p_challenge_id: R,
    p_user_id: R,
    p_session_id: R,
    p_code_hmac: "0".repeat(64),
  },
  is_email_mfa_verified: {},
};
const CUSTOMER_RPCS_GET = {
  get_my_cart: {},
  get_my_cart_logistics: {},
  get_my_favorite_products: {},
  customer_list_my_logistics_quotes: {},
  customer_get_logistics_quote: { p_quote_id: R },
  add_cart_item: { p_variant_id: R, p_quantity: 1 },
  set_cart_item: { p_variant_id: R, p_quantity: 1 },
  create_checkout_order: {
    p_idempotency_key: R,
    p_quote_id: null,
    p_pickup: "[]",
  },
  cancel_my_order: { p_order_id: R },
  record_order_terms_acceptance: { p_order_id: R, p_terms_version: "v1" },
  record_order_marketing_consent: { p_order_id: R },
  save_product_review: {
    p_product_id: R,
    p_rating: 5,
    p_comment: null,
    p_display_name: null,
  },
  delete_my_product_review: { p_product_id: R },
  customer_respond_logistics_quote: { p_quote_id: R, p_accept: true },
  customer_cancel_logistics_quote: { p_quote_id: R },
};
const PUBLIC_RPCS = {
  get_catalog_categories: {},
  get_catalog_products: {},
  get_catalog_product_detail: { p_slug: "x" },
  get_product_review_summary: { p_product_ids: [R] },
  get_published_product_reviews: { p_product_id: R },
  get_public_product_logistics: { p_slug: "x" },
};

async function rpcGet(client, fn, args) {
  // pass jsonb args as strings so PostgREST casts them
  return client.rpc(fn, args, { get: true });
}
function classify(res) {
  const c = res.error && res.error.code;
  if (!res.error) return "EXECUTED";
  if (c === "42501")
    return /permission denied/.test(res.error.message)
      ? "DENIED(no EXECUTE/grant)"
      : "DENIED(function guard 42501)";
  if (c === "25006") return "EXECUTABLE(stopped by read-only tx)";
  if (c === "PGRST202") return "NOT_EXPOSED/signature";
  return "ERROR " + c;
}

async function openapi(key) {
  const r = await fetch(URL_ + "/rest/v1/", {
    headers: { apikey: key, Accept: "application/openapi+json" },
  });
  if (!r.ok) return { status: r.status };
  const j = await r.json();
  const paths = Object.keys(j.paths || {});
  return {
    status: r.status,
    tables: paths
      .filter((p) => !p.startsWith("/rpc/") && p !== "/")
      .map((p) => p.slice(1))
      .sort(),
    rpcs: paths
      .filter((p) => p.startsWith("/rpc/"))
      .map((p) => p.slice(5))
      .sort(),
  };
}

async function signIn(email, password) {
  const c = createClient(URL_, ANON, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error("signin failed: " + error.message);
  return { client: c, id: data.user.id };
}
function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
}

(async () => {
  const meta = {};
  try {
    // ---------- inventory of live surface (read-only) ----------
    const oaS = await openapi(SERVICE);
    const oaA = await openapi(ANON);
    meta.openapi_service = oaS;
    meta.openapi_anon = {
      status: oaA.status,
      tables: oaA.tables && oaA.tables.length,
      rpcs: oaA.rpcs && oaA.rpcs.length,
    };
    const extraTables = (oaS.tables || []).filter((t) => !TABLES.includes(t));
    meta.extra_tables_not_in_migrations = extraTables;
    console.log(
      "OpenAPI(service) tables:",
      (oaS.tables || []).length,
      "rpcs:",
      (oaS.rpcs || []).length,
      "extra tables:",
      extraTables,
    );
    const { data: buckets, error: bErr } = await service.storage.listBuckets();
    meta.buckets = bErr
      ? { error: bErr.message }
      : buckets.map((b) => ({
          id: b.id,
          public: b.public,
          size: b.file_size_limit,
          mimes: b.allowed_mime_types,
        }));
    console.log("buckets:", JSON.stringify(meta.buckets));
    const cs = await service
      .from("commerce_settings")
      .select("checkout_enabled,payment_window_minutes");
    meta.commerce_settings = cs.data || cs.error;

    // ---------- Scenario 1: anon reading private data ----------
    for (const t of [...TABLES, ...extraTables]) {
      const res = await anon.from(t).select("*").limit(3);
      const expected =
        t === "product_reviews"
          ? "published reviews only (by design) – check exposed columns"
          : "DENIED or 0 rows";
      const r = rec("S1-anon-read", "anon", `select ${t}`, expected, res);
      if (t === "product_reviews" && Array.isArray(res.data) && res.data[0])
        r.columns = Object.keys(res.data[0]);
    }
    for (const [fn, a] of Object.entries(PUBLIC_RPCS))
      rec(
        "S1-anon-read",
        "anon",
        `rpc ${fn} (public by design)`,
        "EXECUTED",
        await rpcGet(anon, fn, a),
      );
    for (const [fn, a] of Object.entries({
      ...CUSTOMER_RPCS_GET,
      ...ADMIN_RPCS,
      ...SERVICE_ONLY_RPCS,
    })) {
      const res = await rpcGet(anon, fn, a);
      const r = rec("S1-anon-rpc", "anon", `rpc GET ${fn}`, "DENIED", res);
      r.class = classify(res);
    }
    // anon writes
    rec(
      "S1-anon-write",
      "anon",
      "insert products",
      "DENIED",
      await anon.from("products").insert({
        category_id: rnd(),
        name: "audit",
        slug: "audit-" + Date.now(),
      }),
    );
    rec(
      "S1-anon-write",
      "anon",
      "update products (random id)",
      "DENIED",
      await anon.from("products").update({ name: "x" }).eq("id", rnd()),
    );
    rec(
      "S1-anon-write",
      "anon",
      "delete products (random id)",
      "DENIED",
      await anon.from("products").delete().eq("id", rnd()),
    );
    rec(
      "S1-anon-write",
      "anon",
      "insert orders",
      "DENIED",
      await anon.from("orders").insert({
        customer_id: rnd(),
        idempotency_key: rnd(),
        items_subtotal_cents: 1,
        total_cents: 1,
        payment_expires_at: new Date().toISOString(),
      }),
    );
    rec(
      "S1-anon-write",
      "anon",
      "update orders (random id)",
      "DENIED",
      await anon.from("orders").update({ status: "paid" }).eq("id", rnd()),
    );
    rec(
      "S1-anon-write",
      "anon",
      "delete orders (random id)",
      "DENIED",
      await anon.from("orders").delete().eq("id", rnd()),
    );
    rec(
      "S1-anon-write",
      "anon",
      "insert customer_profiles",
      "DENIED",
      await anon
        .from("customer_profiles")
        .insert({ user_id: rnd(), display_name: "Audit" }),
    );
    rec(
      "S1-anon-write",
      "anon",
      "update customer_profiles (random)",
      "DENIED",
      await anon
        .from("customer_profiles")
        .update({ display_name: "xx" })
        .eq("user_id", rnd()),
    );
    rec(
      "S1-anon-write",
      "anon",
      "insert catalog_admins",
      "DENIED",
      await anon.from("catalog_admins").insert({ user_id: rnd() }),
    );
    rec(
      "S1-anon-write",
      "anon",
      "insert product_reviews",
      "DENIED",
      await anon
        .from("product_reviews")
        .insert({ product_id: rnd(), user_id: rnd(), rating: 5 }),
    );
    rec(
      "S1-anon-write",
      "anon",
      "delete product_reviews (random)",
      "DENIED",
      await anon.from("product_reviews").delete().eq("id", rnd()),
    );
    for (const b of Array.isArray(meta.buckets)
      ? meta.buckets
      : [{ id: "catalog-images" }]) {
      const p = `products/${rnd()}/${rnd()}.png`;
      const up = await anon.storage
        .from(b.id)
        .upload(p, tinyPng(), { contentType: "image/png" });
      if (!up.error) created.storage.push({ bucket: b.id, path: p });
      rec(
        "S1-anon-write",
        "anon",
        `storage upload ${b.id}/${p.split("/")[0]}/...`,
        "DENIED",
        up,
      );
      const p2 = `audit/${rnd()}.png`;
      const up2 = await anon.storage
        .from(b.id)
        .upload(p2, tinyPng(), { contentType: "image/png" });
      if (!up2.error) created.storage.push({ bucket: b.id, path: p2 });
      rec(
        "S1-anon-write",
        "anon",
        `storage upload ${b.id}/audit/...`,
        "DENIED",
        up2,
      );
    }

    // ---------- create test users ----------
    const tag = crypto.randomBytes(4).toString("hex");
    const users = {};
    for (const who of ["a", "b"]) {
      const email = `audit-${who}-${tag}@example.test`;
      const password = crypto.randomBytes(24).toString("base64url") + "Aa1!";
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Audit ${who.toUpperCase()}` },
      });
      if (error) throw new Error("createUser failed: " + error.message);
      created.users.push(data.user.id);
      users[who] = { email, password, id: data.user.id };
    }
    console.log("created users", created.users);
    const A = await signIn(users.a.email, users.a.password);
    const B = await signIn(users.b.email, users.b.password);

    // pick a purchasable variant (service, read-only)
    const { data: inv } = await service
      .from("inventory")
      .select("variant_id,on_hand,reserved")
      .gt("on_hand", 0)
      .limit(200);
    const avail = (inv || [])
      .filter((i) => i.on_hand - i.reserved >= 1)
      .map((i) => i.variant_id);
    const { data: vars } = await service
      .from("product_variants")
      .select("id,product_id,is_active,sku,price_cents")
      .in("id", avail.length ? avail : [rnd()])
      .eq("is_active", true);
    const prodIds = [...new Set((vars || []).map((v) => v.product_id))];
    const { data: prods } = await service
      .from("products")
      .select("id,status,category_id")
      .in("id", prodIds.length ? prodIds : [rnd()])
      .eq("status", "active");
    const variant = (vars || []).find(
      (v) =>
        (prods || []).some((p) => p.id === v.product_id) &&
        v.sku &&
        v.price_cents > 0,
    );
    const productId = variant
      ? variant.product_id
      : prods && prods[0] && prods[0].id;
    meta.fixture = { variant: !!variant, product: !!productId };

    // ---------- B's own data via normal paths ----------
    const bProfile = await B.client
      .from("customer_profiles")
      .insert({
        user_id: B.id,
        display_name: "Audit B",
        contact_phone: "+5512999990000",
      })
      .select();
    rec("setup", "B", "insert own profile", "OK", bProfile);
    if (variant)
      rec(
        "setup",
        "B",
        "add_cart_item own",
        "OK",
        await B.client.rpc("add_cart_item", {
          p_variant_id: variant.id,
          p_quantity: 1,
        }),
      );
    if (productId) {
      rec(
        "setup",
        "B",
        "insert own favorite",
        "OK",
        await B.client
          .from("product_favorites")
          .insert({ user_id: B.id, product_id: productId }),
      );
      rec(
        "setup",
        "B",
        "save_product_review own",
        "OK",
        await B.client.rpc("save_product_review", {
          p_product_id: productId,
          p_rating: 4,
          p_comment: "audit probe - temporary",
          p_display_name: "Audit B",
        }),
      );
    }
    // synthetic order for B (service role; no items => no inventory touched)
    const orderIns = await service
      .from("orders")
      .insert({
        customer_id: B.id,
        idempotency_key: rnd(),
        items_subtotal_cents: 100,
        freight_cents: 0,
        floor_charge_cents: 0,
        total_cents: 100,
        customer_email: users.b.email,
        payment_expires_at: new Date(Date.now() + 20 * 60000).toISOString(),
      })
      .select("id,status");
    rec("setup", "service", "insert synthetic order for B", "OK", orderIns);
    const bOrder = orderIns.data && orderIns.data[0] && orderIns.data[0].id;
    if (bOrder) created.orders.push(bOrder);
    const { data: bReview } = await B.client
      .from("product_reviews")
      .select("id")
      .eq("user_id", B.id);
    const bReviewId = bReview && bReview[0] && bReview[0].id;
    const { data: bCart } = await B.client
      .from("carts")
      .select("id")
      .eq("user_id", B.id);
    const bCartId = bCart && bCart[0] && bCart[0].id;
    // positive controls
    rec(
      "control",
      "B",
      "select own profile",
      "1 row",
      await B.client
        .from("customer_profiles")
        .select("user_id")
        .eq("user_id", B.id),
    );
    rec(
      "control",
      "B",
      "select own order",
      "1 row",
      await B.client
        .from("orders")
        .select("id")
        .eq("id", bOrder || rnd()),
    );
    rec(
      "control",
      "B",
      "select own cart_items",
      ">=1 row",
      await B.client.from("cart_items").select("variant_id"),
    );
    rec(
      "control",
      "B",
      "select own favorites",
      ">=1 row",
      await B.client.from("product_favorites").select("product_id"),
    );

    // ---------- S1 extra: anon sees reviewer user_id ----------
    if (bReviewId) {
      const r = await anon
        .from("product_reviews")
        .select("id,user_id,display_name,status")
        .eq("id", bReviewId);
      const x = rec(
        "S1-anon-read",
        "anon",
        "select B's published review incl. user_id",
        "should NOT expose user_id",
        r,
      );
      x.user_id_exposed = !!(r.data && r.data[0] && r.data[0].user_id === B.id);
    }

    // ---------- S2: customer reading another's data ----------
    rec(
      "S2-read-other",
      "A",
      "select B's order",
      "0 rows",
      await A.client
        .from("orders")
        .select("*")
        .eq("id", bOrder || rnd()),
    );
    rec(
      "S2-read-other",
      "A",
      "select all orders",
      "0 rows (A has none)",
      await A.client.from("orders").select("id"),
    );
    rec(
      "S2-read-other",
      "A",
      "select B's order_items/groups/payments",
      "0 rows",
      await A.client
        .from("order_payments")
        .select("*")
        .eq("order_id", bOrder || rnd()),
    );
    rec(
      "S2-read-other",
      "A",
      "select order_events",
      "DENIED",
      await A.client.from("order_events").select("*").limit(1),
    );
    rec(
      "S2-read-other",
      "A",
      "select B's profile",
      "0 rows",
      await A.client.from("customer_profiles").select("*").eq("user_id", B.id),
    );
    rec(
      "S2-read-other",
      "A",
      "select all profiles",
      "0 rows",
      await A.client.from("customer_profiles").select("user_id"),
    );
    rec(
      "S2-read-other",
      "A",
      "select B's cart",
      "0 rows",
      await A.client.from("carts").select("*").eq("user_id", B.id),
    );
    rec(
      "S2-read-other",
      "A",
      "select B's cart_items",
      "0 rows",
      await A.client
        .from("cart_items")
        .select("*")
        .eq("cart_id", bCartId || rnd()),
    );
    rec(
      "S2-read-other",
      "A",
      "select B's favorites",
      "0 rows",
      await A.client.from("product_favorites").select("*").eq("user_id", B.id),
    );
    rec(
      "S2-read-other",
      "A",
      "select logistics_quotes",
      "DENIED",
      await A.client.from("logistics_quotes").select("*").limit(1),
    );
    rec(
      "S2-read-other",
      "A",
      "admin_get_order(B order)",
      "forbidden",
      await A.client.rpc("admin_get_order", { p_order_id: bOrder || rnd() }),
    );
    rec(
      "S2-read-other",
      "A",
      "customer_get_logistics_quote(random)",
      "null",
      await A.client.rpc("customer_get_logistics_quote", { p_quote_id: rnd() }),
    );

    // ---------- S3: customer modifying another's orders ----------
    rec(
      "S3-modify-other-order",
      "A",
      "PATCH B's order status=paid",
      "DENIED",
      await A.client
        .from("orders")
        .update({ status: "paid" })
        .eq("id", bOrder || rnd())
        .select(),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "DELETE B's order",
      "DENIED",
      await A.client
        .from("orders")
        .delete()
        .eq("id", bOrder || rnd())
        .select(),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "INSERT order for B",
      "DENIED",
      await A.client.from("orders").insert({
        customer_id: B.id,
        idempotency_key: rnd(),
        items_subtotal_cents: 1,
        total_cents: 1,
        payment_expires_at: new Date().toISOString(),
      }),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "INSERT order_payments approved for B's order",
      "DENIED",
      await A.client.from("order_payments").insert({
        order_id: bOrder || rnd(),
        provider: "mock",
        status: "approved",
        amount_cents: 100,
        idempotency_key: rnd(),
      }),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "cancel_my_order(B order)",
      "order not found 42501",
      await A.client.rpc("cancel_my_order", { p_order_id: bOrder || rnd() }),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "record_order_terms_acceptance(B order)",
      "order not found 42501",
      await A.client.rpc("record_order_terms_acceptance", {
        p_order_id: bOrder || rnd(),
        p_terms_version: "audit",
      }),
    );
    rec(
      "S3-modify-other-order",
      "A",
      "record_order_marketing_consent(B order)",
      "false",
      await A.client.rpc("record_order_marketing_consent", {
        p_order_id: bOrder || rnd(),
      }),
    );
    {
      const r = await A.client.rpc(
        "order_apply_payment_event",
        {
          p_provider: "mock",
          p_event_id: "audit-" + rnd(),
          p_order_id: bOrder || rnd(),
          p_provider_payment_id: "x",
          p_status: "approved",
          p_amount_cents: 100,
        },
        { get: true },
      );
      const x = rec(
        "S3-modify-other-order",
        "A",
        "order_apply_payment_event (GET, read-only)",
        "DENIED",
        r,
      );
      x.class = classify(r);
    }
    if (bOrder) {
      const { data: after } = await service
        .from("orders")
        .select(
          "status,terms_version,marketing_whatsapp_consent_at,cancelled_at",
        )
        .eq("id", bOrder);
      const x = rec(
        "S3-modify-other-order",
        "service",
        "verify B's order unchanged",
        "pending_payment, nulls",
        { data: after, error: null },
      );
      x.after = after;
    }

    // ---------- S4: customer changing own access level ----------
    rec(
      "S4-self-elevate",
      "A",
      "insert self into catalog_admins",
      "DENIED",
      await A.client.from("catalog_admins").insert({ user_id: A.id }).select(),
    );
    rec(
      "S4-self-elevate",
      "A",
      "update catalog_admins",
      "DENIED",
      await A.client
        .from("catalog_admins")
        .update({ enabled_by: A.id })
        .eq("user_id", A.id)
        .select(),
    );
    rec(
      "S4-self-elevate",
      "A",
      "select catalog_admins (all)",
      "0 rows (only own membership visible)",
      await A.client.from("catalog_admins").select("*"),
    );
    rec(
      "S4-self-elevate",
      "A",
      "auth.updateUser user_metadata role=admin",
      "allowed but irrelevant",
      await A.client.auth.updateUser({
        data: { role: "admin", is_admin: true, aal: "aal2" },
      }),
    );
    {
      const r = await A.client.rpc("admin_list_orders", {
        p_status: null,
        p_limit: 1,
      });
      rec(
        "S4-self-elevate",
        "A",
        "admin_list_orders after metadata change",
        "forbidden",
        r,
      );
    }
    {
      const r = await A.client.rpc("admin_get_orders_summary");
      rec(
        "S4-self-elevate",
        "A",
        "admin_get_orders_summary after metadata change",
        "forbidden",
        r,
      );
    }
    rec(
      "S4-self-elevate",
      "A",
      "insert own profile (control)",
      "OK",
      await A.client
        .from("customer_profiles")
        .insert({ user_id: A.id, display_name: "Audit A" })
        .select(),
    );

    // ---------- S5: customer modifying products / stock / prices ----------
    rec(
      "S5-modify-catalog",
      "A",
      "select products (visibility of real rows)",
      "0 rows",
      await A.client.from("products").select("id").limit(5),
    );
    rec(
      "S5-modify-catalog",
      "A",
      "select inventory",
      "0 rows",
      await A.client.from("inventory").select("variant_id").limit(5),
    );
    rec(
      "S5-modify-catalog",
      "A",
      "insert product (random category)",
      "RLS 42501 (not FK 23503)",
      await A.client.from("products").insert({
        category_id: rnd(),
        name: "audit",
        slug: "audit-" + Date.now(),
      }),
    );
    rec(
      "S5-modify-catalog",
      "A",
      "insert inventory (random variant)",
      "RLS 42501",
      await A.client
        .from("inventory")
        .insert({ variant_id: rnd(), on_hand: 999 }),
    );
    rec(
      "S5-modify-catalog",
      "A",
      "insert product_variants (random product)",
      "RLS 42501",
      await A.client
        .from("product_variants")
        .insert({ product_id: rnd(), price_cents: 1 }),
    );
    if (variant) {
      rec(
        "S5-modify-catalog",
        "A",
        "update real variant price (RLS USING should hide row)",
        "0 rows",
        await A.client
          .from("product_variants")
          .update({ price_cents: 1 })
          .eq("id", variant.id)
          .eq("price_cents", -1)
          .select(),
      );
      rec(
        "S5-modify-catalog",
        "A",
        "select real variant by id",
        "0 rows",
        await A.client
          .from("product_variants")
          .select("id")
          .eq("id", variant.id),
      );
    }
    for (const fn of [
      "admin_save_catalog_product",
      "admin_set_catalog_product_status",
      "admin_adjust_catalog_inventory",
      "admin_quick_edit_catalog_product",
      "admin_delete_catalog_product",
    ]) {
      const r = await rpcGet(A.client, fn, ADMIN_RPCS[fn]);
      const x = rec(
        "S5-modify-catalog",
        "A",
        `rpc GET ${fn}`,
        "forbidden 42501",
        r,
      );
      x.class = classify(r);
    }
    for (const b of Array.isArray(meta.buckets)
      ? meta.buckets
      : [{ id: "catalog-images" }]) {
      const p = `products/${rnd()}/${rnd()}.png`;
      const up = await A.client.storage
        .from(b.id)
        .upload(p, tinyPng(), { contentType: "image/png" });
      if (!up.error) created.storage.push({ bucket: b.id, path: p });
      rec(
        "S5-modify-catalog",
        "A",
        `storage upload ${b.id}/products/<uuid>/<uuid>.png`,
        "DENIED",
        up,
      );
      const p2 = `${A.id}/${rnd()}.png`;
      const up2 = await A.client.storage
        .from(b.id)
        .upload(p2, tinyPng(), { contentType: "image/png" });
      if (!up2.error) created.storage.push({ bucket: b.id, path: p2 });
      rec(
        "S5-modify-catalog",
        "A",
        `storage upload ${b.id}/<own uid>/...`,
        "DENIED",
        up2,
      );
      const ls = await A.client.storage
        .from(b.id)
        .list("products", { limit: 5 });
      rec(
        "S5-modify-catalog",
        "A",
        `storage list ${b.id}/products`,
        "only published (by design)",
        ls,
      );
    }

    // ---------- S6: regular user using admin features ----------
    for (const [fn, a] of Object.entries(ADMIN_RPCS)) {
      const r = await rpcGet(A.client, fn, a);
      const x = rec(
        "S6-admin-features",
        "A",
        `rpc GET ${fn}`,
        "forbidden 42501",
        r,
      );
      x.class = classify(r);
    }
    for (const [fn, a] of Object.entries(SERVICE_ONLY_RPCS)) {
      const r = await rpcGet(A.client, fn, a);
      const x = rec(
        "S6-admin-features",
        "A",
        `rpc GET ${fn} (service-only)`,
        "permission denied",
        r,
      );
      x.class = classify(r);
    }
    rec(
      "S6-admin-features",
      "A",
      "select logistics_admin_events",
      "DENIED",
      await A.client.from("logistics_admin_events").select("*").limit(1),
    );
    rec(
      "S6-admin-features",
      "A",
      "select payment_webhook_events",
      "DENIED",
      await A.client.from("payment_webhook_events").select("*").limit(1),
    );
    rec(
      "S6-admin-features",
      "A",
      "update commerce_settings checkout_enabled",
      "DENIED",
      await A.client
        .from("commerce_settings")
        .update({ checkout_enabled: true })
        .eq("singleton", true)
        .select(),
    );
    if (bReviewId) {
      rec(
        "S6-admin-features",
        "A",
        "moderate_product_review(B review, hidden)",
        "not authorized",
        await A.client.rpc("moderate_product_review", {
          p_review_id: bReviewId,
          p_status: "hidden",
        }),
      );
    }

    // ---------- S8: deleting / modifying others' records ----------
    rec(
      "S8-delete-other",
      "A",
      "DELETE B's profile",
      "DENIED/0",
      await A.client
        .from("customer_profiles")
        .delete()
        .eq("user_id", B.id)
        .select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "UPDATE B's profile",
      "0 rows",
      await A.client
        .from("customer_profiles")
        .update({ display_name: "Hacked" })
        .eq("user_id", B.id)
        .select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "INSERT profile with user_id=B",
      "RLS 42501",
      await A.client
        .from("customer_profiles")
        .insert({ user_id: B.id, display_name: "Hacked" }),
    );
    rec(
      "S8-delete-other",
      "A",
      "UPSERT profile user_id=B",
      "RLS 42501",
      await A.client
        .from("customer_profiles")
        .upsert({ user_id: B.id, display_name: "Hacked" }),
    );
    rec(
      "S8-delete-other",
      "A",
      "DELETE B's favorites",
      "0 rows",
      await A.client
        .from("product_favorites")
        .delete()
        .eq("user_id", B.id)
        .select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "INSERT favorite as B",
      "RLS 42501",
      productId
        ? await A.client
            .from("product_favorites")
            .insert({ user_id: B.id, product_id: productId })
        : { error: { message: "skip" } },
    );
    rec(
      "S8-delete-other",
      "A",
      "DELETE B's review (table)",
      "DENIED",
      await A.client
        .from("product_reviews")
        .delete()
        .eq("id", bReviewId || rnd())
        .select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "UPDATE B's review (table)",
      "DENIED",
      await A.client
        .from("product_reviews")
        .update({ rating: 1 })
        .eq("id", bReviewId || rnd())
        .select(),
    );
    if (productId)
      rec(
        "S8-delete-other",
        "A",
        "delete_my_product_review(B's product)",
        "no effect on B",
        await A.client.rpc("delete_my_product_review", {
          p_product_id: productId,
        }),
      );
    rec(
      "S8-delete-other",
      "A",
      "DELETE B's cart",
      "DENIED",
      await A.client.from("carts").delete().eq("user_id", B.id).select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "DELETE B's cart_items",
      "DENIED",
      await A.client
        .from("cart_items")
        .delete()
        .eq("cart_id", bCartId || rnd())
        .select(),
    );
    rec(
      "S8-delete-other",
      "A",
      "INSERT cart_item into B's cart",
      "DENIED",
      await A.client.from("cart_items").insert({
        cart_id: bCartId || rnd(),
        variant_id: variant ? variant.id : rnd(),
        quantity: 99,
      }),
    );
    rec(
      "S8-delete-other",
      "A",
      "customer_cancel_logistics_quote(random)",
      "quote not found",
      await A.client.rpc("customer_cancel_logistics_quote", {
        p_quote_id: rnd(),
      }),
    );
    // verify B's rows intact (service)
    const chk = {};
    chk.profile = (
      await service
        .from("customer_profiles")
        .select("display_name")
        .eq("user_id", B.id)
    ).data;
    chk.favorites = (
      (
        await service
          .from("product_favorites")
          .select("product_id")
          .eq("user_id", B.id)
      ).data || []
    ).length;
    chk.review = (
      await service
        .from("product_reviews")
        .select("rating,status")
        .eq("user_id", B.id)
    ).data;
    chk.cart_items =
      (
        await service
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", bCartId || rnd())
      ).data || [];
    {
      const x = rec(
        "S8-delete-other",
        "service",
        "verify B's rows intact",
        "profile 'Audit B', 1 fav, review 4/published, cart qty 1",
        { data: [chk], error: null },
      );
      x.after = chk;
    }
  } catch (e) {
    console.error("PROBE ERROR", e && e.message);
    meta.fatal = String(e && e.message);
  } finally {
    // ---------- cleanup: only what we created ----------
    const cleanup = { storage: [], orders: [], users: [], verify: {} };
    for (const s of created.storage) {
      const r = await service.storage.from(s.bucket).remove([s.path]);
      cleanup.storage.push({ path: s.path, error: r.error && r.error.message });
    }
    for (const id of created.orders) {
      const e1 = await service.from("order_events").delete().eq("order_id", id);
      const e2 = await service
        .from("order_payments")
        .delete()
        .eq("order_id", id);
      const e3 = await service.from("orders").delete().eq("id", id);
      cleanup.orders.push({
        id,
        events: e1.error && e1.error.message,
        payments: e2.error && e2.error.message,
        order: e3.error && e3.error.message,
      });
    }
    for (const id of created.users) {
      const r = await service.auth.admin.deleteUser(id);
      cleanup.users.push({ id, error: r.error && r.error.message });
    }
    for (const id of created.users) {
      const u = await service.auth.admin.getUserById(id);
      cleanup.verify[id] = {
        auth_user_gone: !!u.error || !u.data || !u.data.user,
        profiles: (
          (
            await service
              .from("customer_profiles")
              .select("user_id")
              .eq("user_id", id)
          ).data || []
        ).length,
        carts: (
          (await service.from("carts").select("id").eq("user_id", id)).data ||
          []
        ).length,
        favorites: (
          (
            await service
              .from("product_favorites")
              .select("user_id")
              .eq("user_id", id)
          ).data || []
        ).length,
        reviews: (
          (await service.from("product_reviews").select("id").eq("user_id", id))
            .data || []
        ).length,
        catalog_admins: (
          (
            await service
              .from("catalog_admins")
              .select("user_id")
              .eq("user_id", id)
          ).data || []
        ).length,
        orders: (
          (await service.from("orders").select("id").eq("customer_id", id))
            .data || []
        ).length,
      };
    }
    for (const id of created.orders)
      cleanup.verify["order:" + id] = (
        (await service.from("orders").select("id").eq("id", id)).data || []
      ).length;
    console.log("CLEANUP", JSON.stringify(cleanup, null, 1));
    fs.writeFileSync(
      path.join(require("os").tmpdir(), "imperio-probe-results.json"),
      JSON.stringify(
        { ranAt: new Date().toISOString(), meta, results, created, cleanup },
        null,
        1,
      ),
    );
  }
})();
