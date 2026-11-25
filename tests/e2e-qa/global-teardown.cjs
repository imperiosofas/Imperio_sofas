/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS */
const fs = require("fs");
const path = require("path");
const h = require("./qa-helpers.cjs");
module.exports = async () => {
  const log = {};
  const base = JSON.parse(
    fs.readFileSync(path.join(h.OUT, "baseline.json"), "utf8"),
  );
  // Leftover QA users (any spec that crashed before its own cleanup).
  const { data } = await h.svc.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((x) =>
    /^qa-[a-z0-9-]+@example\.test$/.test(x.email ?? ""),
  ))
    await h.deleteUser({ id: u.id, email: u.email }, log);
  // Leftover QA products.
  log.products = await h.deleteQaProducts();
  // Inventory must equal the baseline.
  const now = await h.inventorySnapshot();
  const diff = Object.entries(base.inv).filter(
    ([vid, b]) =>
      !now[vid] ||
      now[vid].on_hand !== b.on_hand ||
      now[vid].reserved !== b.reserved,
  );
  // Other QA agents may share the TEST project, so a blind restore could clobber
  // their reservations. Only restore when explicitly asked.
  if (diff.length && process.env.QA_RESTORE_INVENTORY === "1")
    log.restored = await h.restoreInventory(base.inv);
  const extraVariants = Object.keys(now).filter((v) => !base.inv[v]);
  const { count: orders } = await h.svc
    .from("orders")
    .select("id", { count: "exact", head: true });
  const { count: products } = await h.svc
    .from("products")
    .select("id", { count: "exact", head: true });
  const final = await h.inventorySnapshot();
  const finalDiff = Object.entries(base.inv).filter(
    ([vid, b]) =>
      !final[vid] ||
      final[vid].on_hand !== b.on_hand ||
      final[vid].reserved !== b.reserved,
  );
  const summary = {
    inventoryDiffBeforeRestore: diff.map(([v, b]) => ({
      v,
      base: b,
      now: now[v],
    })),
    inventoryDiffAfter: finalDiff.length,
    extraVariants,
    orders: { base: base.orders, now: orders },
    products: { base: base.products, now: products },
    log,
  };
  fs.writeFileSync(
    path.join(h.OUT, "teardown.json"),
    JSON.stringify(summary, null, 1),
  );
  console.log("[teardown]", JSON.stringify(summary));
};
