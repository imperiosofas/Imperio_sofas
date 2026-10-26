import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  adminAnalyticsCategoryIdSchema,
  adminAnalyticsSnapshotSchema,
} from "../src/features/admin/analytics-types.ts";

const validSnapshot = {
  snapshot_at: "2026-10-15T15:30:00.000Z",
  summary: {
    products_total: 51,
    active_products: 4,
    draft_products: 47,
    archived_products: 0,
    categories_total: 7,
    active_variants: 35,
    low_stock_variants: 2,
    out_of_stock_variants: 1,
    available_units_total: 332,
  },
  categories: [
    {
      category_id: "e236eeaf-6a0d-4f1e-a89d-61384d16f53f",
      category_name: "Sofás",
      product_count: 8,
      variants_total: 12,
      variants_in_stock: 10,
      low_stock_variants: 1,
      out_of_stock_variants: 1,
      available_units: 42,
    },
  ],
  attention: [
    {
      product_id: "38b0a951-e0a2-4adf-8b1b-e0f69fb5cc1b",
      product_name: "Sofá Berlim",
      slug: "sofa-berlim",
      category_name: "Sofás",
      variant_id: "bbca8884-e60c-4dc9-bd38-c1b9fa46472b",
      sku: null,
      available_units: 2,
      low_stock_threshold: 5,
      is_low_stock: true,
    },
  ],
  top_inventory_products: [
    {
      product_id: "38b0a951-e0a2-4adf-8b1b-e0f69fb5cc1b",
      product_name: "Sofá Berlim",
      slug: "sofa-berlim",
      category_name: "Sofás",
      available_units: 40,
      active_variant_count: 4,
    },
  ],
};

const serviceDependenciesKey = Symbol.for(
  "imperio-sofas.admin-analytics-test-dependencies",
);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!context.parentURL?.endsWith("/src/features/admin/analytics-data.ts")) {
      return nextResolve(specifier, context);
    }

    if (specifier === "../../lib/supabase/admin-access") {
      const source = `export async function requireCatalogAdmin() {
        return globalThis[Symbol.for(${JSON.stringify(serviceDependenciesKey.description)})].requireCatalogAdmin();
      }`;
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }

    if (specifier === "./analytics-types") {
      return nextResolve(
        new URL("./analytics-types.ts", context.parentURL).href,
        context,
      );
    }

    return nextResolve(specifier, context);
  },
});

test("accepts the agreed analytics snapshot contract", () => {
  assert.deepEqual(
    adminAnalyticsSnapshotSchema.parse(validSnapshot),
    validSnapshot,
  );
});

test("accepts a timezone offset in snapshot_at", () => {
  const value = structuredClone(validSnapshot);
  value.snapshot_at = "2026-10-15T12:30:00-03:00";

  assert.equal(
    adminAnalyticsSnapshotSchema.parse(value).snapshot_at,
    value.snapshot_at,
  );
});

test("validates an optional category UUID and accepts null for the unfiltered snapshot", () => {
  assert.equal(
    adminAnalyticsCategoryIdSchema.parse(
      "e236eeaf-6a0d-4f1e-a89d-61384d16f53f",
    ),
    "e236eeaf-6a0d-4f1e-a89d-61384d16f53f",
  );
  assert.equal(adminAnalyticsCategoryIdSchema.parse(null), null);
  assert.equal(
    adminAnalyticsCategoryIdSchema.safeParse("not-a-uuid").success,
    false,
  );
});

test("rejects undeclared root and nested fields", () => {
  const withUnexpectedRootField = { ...validSnapshot, revenue_total: 0 };
  const withUnexpectedSummaryField = {
    ...validSnapshot,
    summary: { ...validSnapshot.summary, favorites_total: 10 },
  };

  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(withUnexpectedRootField).success,
    false,
  );
  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(withUnexpectedSummaryField).success,
    false,
  );
});

test("rejects missing fields, invalid identifiers, and malformed timestamps", () => {
  const missingField = structuredClone(validSnapshot);
  delete missingField.summary.active_products;
  const invalidId = structuredClone(validSnapshot);
  invalidId.categories[0].category_id = "not-a-uuid";
  const invalidTimestamp = { ...validSnapshot, snapshot_at: "yesterday" };

  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(missingField).success,
    false,
  );
  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(invalidId).success,
    false,
  );
  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(invalidTimestamp).success,
    false,
  );
});

test("rejects negative or fractional inventory/count values", () => {
  const negativeCount = structuredClone(validSnapshot);
  negativeCount.summary.available_units_total = -1;
  const fractionalCount = structuredClone(validSnapshot);
  fractionalCount.attention[0].available_units = 1.5;

  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(negativeCount).success,
    false,
  );
  assert.equal(
    adminAnalyticsSnapshotSchema.safeParse(fractionalCount).success,
    false,
  );
});

test("service authorizes before one RPC, forwards the filter, and sanitizes failures", async (t) => {
  const calls = [];
  let guardError;
  let rpcThrownError;
  let rpcResult = { data: validSnapshot, error: null };
  const client = {
    async rpc(name, args) {
      calls.push({ kind: "rpc", name, args });
      if (rpcThrownError) throw rpcThrownError;
      return rpcResult;
    },
  };

  globalThis[serviceDependenciesKey] = {
    async requireCatalogAdmin() {
      calls.push({ kind: "admin" });
      if (guardError) throw guardError;
      return client;
    },
  };

  const { getAdminAnalyticsSnapshot } = await import(
    new URL("../src/features/admin/analytics-data.ts", import.meta.url).href
  );

  await t.test("runs the admin guard before one filtered RPC", async () => {
    const categoryId = "e236eeaf-6a0d-4f1e-a89d-61384d16f53f";

    assert.deepEqual(
      await getAdminAnalyticsSnapshot({ categoryId }),
      validSnapshot,
    );
    assert.deepEqual(calls, [
      { kind: "admin" },
      {
        kind: "rpc",
        name: "admin_get_analytics_snapshot",
        args: { p_category_id: categoryId },
      },
    ]);
  });

  await t.test("sends null when no category filter is provided", async () => {
    calls.length = 0;

    await getAdminAnalyticsSnapshot();

    assert.deepEqual(calls, [
      { kind: "admin" },
      {
        kind: "rpc",
        name: "admin_get_analytics_snapshot",
        args: { p_category_id: null },
      },
    ]);
  });

  await t.test("rejects an invalid category before guard or RPC", async () => {
    calls.length = 0;

    await assert.rejects(
      getAdminAnalyticsSnapshot({ categoryId: "not-a-uuid" }),
      /categoria selecionada é inválida/i,
    );
    assert.deepEqual(calls, []);
  });

  await t.test("does not call RPC when the admin guard rejects", async () => {
    calls.length = 0;
    guardError = new Error("not an admin");

    await assert.rejects(
      getAdminAnalyticsSnapshot(),
      (error) => error === guardError,
    );
    assert.deepEqual(calls, [{ kind: "admin" }]);
    guardError = undefined;
  });

  await t.test("sanitizes RPC errors and makes no retry request", async () => {
    calls.length = 0;
    rpcResult = { data: null, error: { message: "private database detail" } };

    await assert.rejects(
      getAdminAnalyticsSnapshot(),
      (error) =>
        error.message ===
          "Não foi possível carregar os indicadores do catálogo." &&
        !error.message.includes("private database detail"),
    );
    assert.equal(calls.filter((call) => call.kind === "rpc").length, 1);
  });

  await t.test("rejects malformed RPC output", async () => {
    calls.length = 0;
    rpcResult = { data: { ...validSnapshot, revenue_total: 100 }, error: null };

    await assert.rejects(getAdminAnalyticsSnapshot(), /formato inválido/i);
    assert.equal(calls.filter((call) => call.kind === "rpc").length, 1);
  });

  await t.test("sanitizes a directly thrown RPC network error", async () => {
    calls.length = 0;
    rpcThrownError = new Error("socket timeout with internal details");

    await assert.rejects(
      getAdminAnalyticsSnapshot(),
      (error) =>
        error.message ===
          "Não foi possível carregar os indicadores do catálogo." &&
        !error.message.includes("socket timeout"),
    );
    assert.equal(calls.filter((call) => call.kind === "rpc").length, 1);
  });
});
