/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS */
const fs = require("fs");
const path = require("path");
const h = require("./qa-helpers.cjs");
module.exports = async () => {
  const res = await fetch(h.BASE).catch(() => null);
  if (!res || !res.ok) throw new Error(`Server not reachable at ${h.BASE}`);
  const inv = await h.inventorySnapshot();
  const { count: orders } = await h.svc
    .from("orders")
    .select("id", { count: "exact", head: true });
  const { count: products } = await h.svc
    .from("products")
    .select("id", { count: "exact", head: true });
  fs.writeFileSync(
    path.join(h.OUT, "baseline.json"),
    JSON.stringify({ inv, orders, products, at: new Date().toISOString() }),
  );
  console.log(
    `[setup] baseline: ${Object.keys(inv).length} variants, ${orders} orders, ${products} products`,
  );
};
