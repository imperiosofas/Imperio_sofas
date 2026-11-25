/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright spec */
// Links/buttons sweep: collect every internal <a href> from /, /loja, a product
// page and the logged-in /conta pages, request each one and flag 4xx/5xx.
// Also flags buttons/links without an accessible name on the seed pages.
const { test } = require("@playwright/test");
const h = require("./qa-helpers.cjs");

const { record, save } = h.recorder("links-sweep");
const u = h.mkCreds("qa-links");
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

async function collect(page, seed) {
  const r = await page.goto(`${h.BASE}${seed}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("a[href], button")]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        const name =
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          (el.textContent || "").trim() ||
          [...el.querySelectorAll("img[alt]")].map((i) => i.alt).join("");
        const lb = el.getAttribute("aria-labelledby");
        return !name && !lb;
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  return { status: r.status(), hrefs, unnamed };
}

const isInternal = (href) =>
  href &&
  !/^(mailto:|tel:|javascript:|#)/.test(href) &&
  (href.startsWith("/") || href.startsWith(h.BASE));

async function sweep(page, seeds, label) {
  const targets = new Map();
  for (const s of seeds) {
    const { status, hrefs, unnamed } = await collect(page, s);
    record(
      `L-${label}-seed ${s}`,
      status < 400 ? "PASS" : "FAIL",
      `status=${status} links=${hrefs.length}`,
    );
    record(
      `L-${label}-a11y-names ${s}`,
      unnamed.length ? "FAIL" : "PASS",
      unnamed.slice(0, 4).join(" || "),
    );
    for (const href of hrefs.filter(isInternal)) {
      const url = new URL(href, h.BASE);
      url.hash = "";
      if (!targets.has(url.href)) targets.set(url.href, s);
    }
  }
  const bad = [];
  for (const [url, from] of targets) {
    if (/\/auth\/|signout|sair/i.test(url)) continue;
    const r = await page.request
      .get(url, { maxRedirects: 5 })
      .catch((e) => ({ status: () => `ERR ${e.message}` }));
    const st = r.status();
    if (typeof st !== "number" || st >= 400)
      bad.push(`${url.replace(h.BASE, "")} (${st}) from ${from}`);
  }
  record(
    `L-${label}-links`,
    bad.length ? "FAIL" : "PASS",
    `checked=${targets.size} broken=${bad.length} ${bad.join("; ")}`,
  );
}

test("links sweep - anonymous", async ({ page }) => {
  await sweep(page, ["/", "/loja", `/produto/${h.SLUG}`], "anon");
});

test("links sweep - logged /conta", async ({ page }) => {
  await h.login(page, u);
  await sweep(
    page,
    [
      "/conta",
      "/conta/perfil",
      "/conta/seguranca",
      "/conta/favoritos",
      "/conta/pedidos",
      "/conta/entregas",
      "/carrinho",
    ],
    "logged",
  );
});
