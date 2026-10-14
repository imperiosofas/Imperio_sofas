import assert from "node:assert/strict";
import test from "node:test";
import {
  landingProductSelection,
  resolveLandingCatalogResults,
  selectLandingCatalogProducts,
} from "../src/data/products.ts";
import realSourceManifest from "./manifests/legacy-catalog-landing-subset.json" with { type: "json" };

function normalizeSourceSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function catalogProduct(overrides = {}) {
  return {
    id: "4c3c323d-477a-511d-a699-91bfcd9f12bf",
    slug: "sofas-sofa-belize",
    name: "Nome oficial do catálogo",
    categorySlug: "sofas",
    description: "Descrição oficial",
    widthMm: 1800,
    status: "active",
    priceCents: 319900,
    stockStatus: "available",
    media: [{ src: "https://catalog.example/image", alt: "Alt oficial" }],
    ...overrides,
  };
}

test("landing commercial fields are not stored in the editorial selection", () => {
  const manifestSlugs = realSourceManifest.products.map((product) =>
    normalizeSourceSlug(product.sourceSlug || product.name),
  );
  assert.equal(realSourceManifest.source.totals.products, 51);
  assert.equal(realSourceManifest.source.totals.images, 107);
  assert.equal(realSourceManifest.source.totals.categories, 7);
  assert.deepEqual(
    landingProductSelection.map(({ slug }) => slug),
    manifestSlugs,
  );
  for (const item of landingProductSelection) {
    assert.deepEqual(Object.keys(item).sort(), ["objectPosition", "slug"]);
  }
});

test("partial catalog lookup failure preserves manifest-proven products", async () => {
  const [realSourceProduct] = realSourceManifest.products;
  assert.ok(realSourceProduct);
  const realSlug = normalizeSourceSlug(
    realSourceProduct.sourceSlug || realSourceProduct.name,
  );
  const product = catalogProduct({
    id: realSourceProduct.sourceId,
    slug: realSlug,
    name: realSourceProduct.name,
  });
  const result = resolveLandingCatalogResults([
    { status: "fulfilled", value: product },
    { status: "rejected", reason: new Error("test lookup failure") },
  ]);

  assert.equal(result.failedLookups, 1);
  assert.deepEqual(
    result.products.map(({ slug }) => slug),
    [realSlug],
  );
  assert.equal(result.products[0].id, realSourceProduct.sourceId);
});

test("published cards follow editorial slug order and retain source values", () => {
  const dallas = catalogProduct({
    id: "67bb3b5c-d9bc-5ba7-8760-a29cda813047",
    slug: "sofas-sofa-dallas",
    name: "Dallas publicado",
    priceCents: 349900,
    widthMm: 2100,
  });
  const belize = catalogProduct();

  const result = selectLandingCatalogProducts([dallas, belize]);

  assert.deepEqual(
    result.map(({ slug }) => slug),
    ["sofas-sofa-belize", "sofas-sofa-dallas"],
  );
  assert.equal(result[0].name, belize.name);
  assert.equal(result[0].priceCents, belize.priceCents);
  assert.equal(result[0].widthMm, belize.widthMm);
  assert.equal(result[0].media[0].alt, belize.media[0].alt);
  assert.equal(result[1].name, dallas.name);
  assert.equal(result[1].priceCents, dallas.priceCents);
  assert.equal(result[1].widthMm, dallas.widthMm);
});

test("drafts, unavailable, incomplete, and unselected products are omitted", () => {
  const candidates = [
    catalogProduct({ status: "draft", slug: "sofas-sofa-belize" }),
    catalogProduct({ stockStatus: "unavailable", slug: "sofa-berlim" }),
    catalogProduct({ priceCents: null, slug: "sofas-sofa-dallas" }),
    catalogProduct({ media: [], slug: "sofas-sofa-maximo" }),
    catalogProduct({ slug: "unselected-product" }),
  ];

  assert.deepEqual(selectLandingCatalogProducts(candidates), []);
});
