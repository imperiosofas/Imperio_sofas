import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import sharp from "sharp";
import {
  ANALYTICS_EXPORT_MAX_PRODUCTS,
  ANALYTICS_EXPORT_PAGE_SIZE,
  AnalyticsExportDataError,
  AnalyticsExportLimitError,
  fetchAnalyticsExportProducts,
} from "../src/features/admin/analytics-export/catalog-products.mjs";
import {
  buildAnalyticsWorkbookBuffer,
  safeXlsxValue,
} from "../src/features/admin/analytics-export/workbook.mjs";
import { handleAnalyticsExportGet } from "../src/features/admin/analytics-export/route-handler.mjs";

const categoryId = "3a8374f0-43fb-4e8e-8d52-bc4bdf51b637";
const snapshot = {
  snapshot_at: "2026-10-15T14:30:00.000Z",
  summary: {
    products_total: 2,
    active_products: 1,
    draft_products: 1,
    archived_products: 0,
    categories_total: 1,
    active_variants: 2,
    low_stock_variants: 1,
    out_of_stock_variants: 0,
    available_units_total: 12,
  },
  categories: [
    {
      category_id: categoryId,
      category_name: "Sofás",
      product_count: 2,
      variants_total: 2,
      variants_in_stock: 2,
      low_stock_variants: 1,
      out_of_stock_variants: 0,
      available_units: 12,
    },
  ],
  attention: [],
  top_inventory_products: [],
};

const products = [
  {
    id: "86f4d2f6-302f-44c8-8bf2-3a96a671ac01",
    category_id: categoryId,
    name: "Sofá Horizonte",
    slug: "sofa-horizonte",
    status: "active",
    categories: { name: "Sofás", slug: "sofas" },
    product_variants: [
      {
        id: "f353f46a-3d27-4d20-87e8-54b35fe08fb2",
        sku: "HORIZONTE-01",
        price_cents: 123456,
        width_mm: 2400,
        depth_mm: null,
        height_mm: null,
        fabric: "Linho",
        color: "Areia",
        is_active: true,
        inventory: { on_hand: 15, reserved: 3, low_stock_threshold: 5 },
      },
      {
        id: "f353f46a-3d27-4d20-87e8-54b35fe08fb3",
        sku: "HORIZONTE-02",
        price_cents: 98900,
        width_mm: 2100,
        depth_mm: 900,
        height_mm: 800,
        fabric: null,
        color: "Grafite",
        is_active: true,
        inventory: { on_hand: 5, reserved: 1, low_stock_threshold: 5 },
      },
    ],
    description: "Não deve ser incluída na planilha.",
    product_media: [
      { signed_url: "https://signed.example.test/private-image" },
    ],
  },
  {
    id: "86f4d2f6-302f-44c8-8bf2-3a96a671ac02",
    category_id: categoryId,
    name: "Sofá sem variante",
    slug: "sofa-sem-variante",
    status: "draft",
    categories: { name: "Sofás", slug: "sofas" },
    product_variants: [],
  },
];

function makeProduct(index) {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    category_id: categoryId,
    name: `Produto ${index}`,
    slug: `produto-${index}`,
    status: "draft",
    categories: { name: "Sofás", slug: "sofas" },
    product_variants: [],
    description: "Esse campo deve ser descartado pelo parser.",
    product_media: [{ storage_path: "private/example.webp" }],
  };
}

function makeVariant(index) {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `10000000-0000-4000-8000-${suffix}`,
    sku: null,
    price_cents: null,
    width_mm: null,
    depth_mm: null,
    height_mm: null,
    fabric: null,
    color: null,
    is_active: true,
    inventory: null,
  };
}

function mockAdminCatalogRpc(allProducts, total = allProducts.length) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args });
        const start = (args.p_page - 1) * args.p_page_size;
        return {
          error: null,
          data: {
            products: allProducts.slice(start, start + args.p_page_size),
            total,
            page: args.p_page,
            page_size: args.p_page_size,
            summary: {
              total,
              published: 0,
              drafts: total,
              low_stock: 0,
              out_of_stock: 0,
              pending: 0,
            },
          },
        };
      },
    },
  };
}

test("paginates the existing admin RPC at 100 rows and strips unused media fields", async () => {
  const sourceProducts = Array.from({ length: 101 }, (_, index) =>
    makeProduct(index + 1),
  );
  const mock = mockAdminCatalogRpc(sourceProducts);
  const exported = await fetchAnalyticsExportProducts(mock.client, categoryId);

  assert.equal(exported.length, 101);
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(
    mock.calls.map(({ name, args }) => ({ name, args })),
    [
      {
        name: "admin_list_catalog_products",
        args: {
          p_query: null,
          p_category_id: categoryId,
          p_status: "all",
          p_stock: "all",
          p_pending: "all",
          p_sort: "recent",
          p_page: 1,
          p_page_size: ANALYTICS_EXPORT_PAGE_SIZE,
        },
      },
      {
        name: "admin_list_catalog_products",
        args: {
          p_query: null,
          p_category_id: categoryId,
          p_status: "all",
          p_stock: "all",
          p_pending: "all",
          p_sort: "recent",
          p_page: 2,
          p_page_size: ANALYTICS_EXPORT_PAGE_SIZE,
        },
      },
    ],
  );
  assert.equal("description" in exported[0], false);
  assert.equal("product_media" in exported[0], false);
});

test("refuses an export over the documented product cap without fetching more pages", async () => {
  const sourceProducts = Array.from(
    { length: ANALYTICS_EXPORT_PAGE_SIZE },
    (_, index) => makeProduct(index + 1),
  );
  const mock = mockAdminCatalogRpc(
    sourceProducts,
    ANALYTICS_EXPORT_MAX_PRODUCTS + 1,
  );
  await assert.rejects(
    fetchAnalyticsExportProducts(mock.client, null),
    AnalyticsExportLimitError,
  );
  assert.equal(mock.calls.length, 1);
});

test("detects unstable totals across pages instead of returning a partial catalog", async () => {
  const allProducts = Array.from({ length: 101 }, (_, index) =>
    makeProduct(index + 1),
  );
  const mock = mockAdminCatalogRpc(allProducts);
  const originalRpc = mock.client.rpc;
  mock.client.rpc = async (name, args) => {
    const result = await originalRpc(name, args);
    if (args.p_page === 2) result.data.total = 102;
    return result;
  };

  await assert.rejects(
    fetchAnalyticsExportProducts(mock.client, null),
    AnalyticsExportDataError,
  );
});

test("accepts an empty catalog and products with zero variants", async () => {
  const emptyMock = mockAdminCatalogRpc([]);
  assert.deepEqual(await fetchAnalyticsExportProducts(emptyMock.client), []);
  assert.equal(emptyMock.calls.length, 1);

  const variantlessProduct = makeProduct(7001);
  const variantlessMock = mockAdminCatalogRpc([variantlessProduct]);
  const result = await fetchAnalyticsExportProducts(variantlessMock.client);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].product_variants, []);
});

for (const duplicateField of ["id", "slug"]) {
  test(`rejects duplicate product ${duplicateField}s`, async () => {
    const first = makeProduct(8001);
    const second = makeProduct(8002);
    second[duplicateField] = first[duplicateField];
    const mock = mockAdminCatalogRpc([first, second]);

    await assert.rejects(
      fetchAnalyticsExportProducts(mock.client),
      AnalyticsExportDataError,
    );
  });
}

test("enforces the variant cap as each paged product is appended", async () => {
  let nextVariantId = 1;
  const firstPage = Array.from(
    { length: ANALYTICS_EXPORT_PAGE_SIZE },
    (_, index) => ({
      ...makeProduct(index + 9001),
      product_variants: Array.from({ length: 200 }, () =>
        makeVariant(nextVariantId++),
      ),
    }),
  );
  const remainingProducts = Array.from({ length: 150 }, (_, index) => ({
    ...makeProduct(index + 9101),
    product_variants: index === 0 ? [makeVariant(nextVariantId++)] : [],
  }));
  const mock = mockAdminCatalogRpc([...firstPage, ...remainingProducts]);

  await assert.rejects(
    fetchAnalyticsExportProducts(mock.client),
    AnalyticsExportLimitError,
  );
  assert.equal(mock.calls.length, 2);
});

test("builds a readable OOXML workbook from the supplied backend snapshot", async () => {
  const buffer = await buildAnalyticsWorkbookBuffer(
    snapshot,
    products,
    "Sofás",
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    [
      "Resumo",
      "Produtos",
      "Estoque",
      "Categorias",
      "Comportamento",
      "Metodologia",
    ],
  );

  const summary = workbook.getWorksheet("Resumo");
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => [
      summary.getCell(index + 2, 1).value,
      summary.getCell(index + 2, 2).value,
    ]),
    [
      ["Produtos no catálogo", 2],
      ["Produtos ativos", 1],
      ["Rascunhos", 1],
      ["Arquivados", 0],
      ["Categorias", 1],
      ["Variantes ativas", 2],
      ["Variantes com estoque baixo", 1],
      ["Variantes indisponíveis", 0],
      ["Unidades disponíveis", 12],
      ["Vendas e pedidos", "Disponível após ativação de pedidos"],
    ],
  );
  assert.equal(summary.getCell("B2").value, snapshot.summary.products_total);
  assert.equal(
    summary.getCell("B10").value,
    snapshot.summary.available_units_total,
  );
  assert.equal(
    summary.getCell("B11").value,
    "Disponível após ativação de pedidos",
  );
  assert.equal(summary.getCell("B13").value, products.length);

  const productSheet = workbook.getWorksheet("Produtos");
  assert.deepEqual(
    Array.from({ length: 3 }, (_, rowIndex) =>
      Array.from(
        { length: 12 },
        (_, columnIndex) =>
          productSheet.getCell(rowIndex + 2, columnIndex + 1).value,
      ),
    ),
    [
      [
        "Sofá Horizonte",
        "sofa-horizonte",
        "Sofás",
        "active",
        "HORIZONTE-01",
        "Sim",
        "Areia",
        "Linho",
        1234.56,
        2400,
        "",
        "",
      ],
      [
        "Sofá Horizonte",
        "sofa-horizonte",
        "Sofás",
        "active",
        "HORIZONTE-02",
        "Sim",
        "Grafite",
        "",
        989,
        2100,
        900,
        800,
      ],
      [
        "Sofá sem variante",
        "sofa-sem-variante",
        "Sofás",
        "draft",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ],
  );
  assert.equal(productSheet.getCell("A2").value, products[0].name);
  assert.equal(
    productSheet.getCell("E2").value,
    products[0].product_variants[0].sku,
  );
  assert.equal(productSheet.getCell("I2").value, 1234.56);
  assert.equal(productSheet.getCell("I2").numFmt, "[$R$-pt-BR] #,##0.00");
  assert.equal(productSheet.getCell("J2").value, 2400);
  assert.equal(productSheet.getCell("A4").value, products[1].name);
  assert.equal(productSheet.getCell("A5").value, "Totais");
  assert.equal(productSheet.getCell("C5").value, products.length);
  assert.equal(productSheet.getCell("E5").value, 2);
  assert.equal(productSheet.getCell("A2").formula, undefined);
  assert.equal(productSheet.views[0].ySplit, 1);
  assert.ok(productSheet.autoFilter);
  assert.equal(productSheet.getCell("A1").fill.fgColor.argb, "FF11191D");

  const stockSheet = workbook.getWorksheet("Estoque");
  assert.deepEqual(
    Array.from({ length: 3 }, (_, rowIndex) =>
      Array.from(
        { length: 10 },
        (_, columnIndex) =>
          stockSheet.getCell(rowIndex + 2, columnIndex + 1).value,
      ),
    ),
    [
      [
        "Sofá Horizonte",
        "Sofás",
        "HORIZONTE-01",
        "Areia",
        "Linho",
        15,
        3,
        12,
        5,
        "Disponível",
      ],
      [
        "Sofá Horizonte",
        "Sofás",
        "HORIZONTE-02",
        "Grafite",
        "",
        5,
        1,
        4,
        5,
        "Últimas unidades",
      ],
      ["Totais", "", "", "", "", 20, 4, 16, "", "Unidades agregadas"],
    ],
  );
  assert.equal(stockSheet.getCell("H2").value, 12);
  assert.equal(stockSheet.getCell("H3").value, 4);
  assert.equal(stockSheet.getCell("J3").value, "Últimas unidades");
  assert.equal(stockSheet.getCell("J3").fill.fgColor.argb, "FFFFF0CC");
  assert.ok(stockSheet.conditionalFormattings.length > 0);
  assert.equal(stockSheet.getCell("H4").value, 16);

  const categorySheet = workbook.getWorksheet("Categorias");
  assert.deepEqual(
    Array.from({ length: 2 }, (_, rowIndex) =>
      Array.from(
        { length: 7 },
        (_, columnIndex) =>
          categorySheet.getCell(rowIndex + 2, columnIndex + 1).value,
      ),
    ),
    [
      ["Sofás", 2, 2, 2, 1, 0, 12],
      ["Totais", 2, 2, 2, 1, 0, 12],
    ],
  );
  assert.equal(
    categorySheet.getCell("B2").value,
    snapshot.categories[0].product_count,
  );
  assert.equal(
    categorySheet.getCell("G2").value,
    snapshot.categories[0].available_units,
  );
  assert.equal(categorySheet.getCell("A3").value, "Totais");

  const behaviorSheet = workbook.getWorksheet("Comportamento");
  assert.deepEqual(
    Array.from({ length: 4 }, (_, rowIndex) =>
      Array.from(
        { length: 3 },
        (_, columnIndex) =>
          behaviorSheet.getCell(rowIndex + 2, columnIndex + 1).value,
      ),
    ),
    [
      [
        "Visualizações de produto",
        "Ainda sem dados",
        "A coleta de eventos de comportamento não está incluída neste snapshot.",
      ],
      [
        "Busca e filtros",
        "Ainda sem dados",
        "Nenhuma série de eventos é simulada neste relatório.",
      ],
      [
        "Interações com produto",
        "Ainda sem dados",
        "A instrumentação analítica correspondente fica para a fase futura.",
      ],
      [
        "Vendas e pedidos",
        "Disponível após ativação de pedidos",
        "O fluxo de pedidos ainda não foi ativado.",
      ],
    ],
  );
  assert.equal(behaviorSheet.getCell("B2").value, "Ainda sem dados");
  assert.equal(
    behaviorSheet.getCell("B5").value,
    "Disponível após ativação de pedidos",
  );

  const methodologyValues = workbook
    .getWorksheet("Metodologia")
    .getSheetValues()
    .flat()
    .filter((value) => typeof value === "string")
    .join(" ");
  assert.match(methodologyValues, /Fase 2 de Analytics/u);
  assert.match(methodologyValues, /não há histórico/u);
  assert.match(
    methodologyValues,
    /O timestamp do snapshot aplica-se aos indicadores do resumo/u,
  );
  assert.match(
    methodologyValues,
    /podem refletir momentos diferentes se houver alterações administrativas concorrentes/u,
  );

  assert.equal(workbook.model.media.length, 2);
  for (const media of workbook.model.media) {
    assert.equal(media.extension, "png");
    assert.deepEqual(
      [...media.buffer.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    const metadata = await sharp(media.buffer).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, 1000);
    assert.equal(metadata.height, 560);
  }
  const textualCells = workbook.worksheets.flatMap((sheet) =>
    sheet
      .getSheetValues()
      .flat()
      .filter((value) => typeof value === "string"),
  );
  assert.equal(
    textualCells.some((value) => value.includes("signed.example.test")),
    false,
  );
  assert.equal(
    textualCells.some((value) => value.includes("private-image")),
    false,
  );
});

test("keeps null variant attributes blank after XLSX serialization", async () => {
  const nullAttributeProduct = {
    ...products[0],
    product_variants: [
      {
        ...products[0].product_variants[0],
        color: null,
        fabric: null,
        width_mm: null,
        depth_mm: null,
        height_mm: null,
      },
    ],
  };
  const buffer = await buildAnalyticsWorkbookBuffer(
    snapshot,
    [nullAttributeProduct],
    null,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const productsSheet = workbook.getWorksheet("Produtos");
  for (const cell of ["G2", "H2", "J2", "K2", "L2"]) {
    assert.equal(
      productsSheet.getCell(cell).value,
      "",
      `${cell} should be blank`,
    );
    assert.notEqual(productsSheet.getCell(cell).value, 35);
  }

  const inventorySheet = workbook.getWorksheet("Estoque");
  for (const cell of ["D2", "E2"]) {
    assert.equal(
      inventorySheet.getCell(cell).value,
      "",
      `${cell} should be blank`,
    );
    assert.notEqual(inventorySheet.getCell(cell).value, 35);
  }
});

test("escapes dangerous formula-leading text while keeping negative numeric values numeric", async () => {
  const unsafeProduct = {
    ...products[0],
    name: "=1+1",
    slug: "+slug",
    categories: { name: "-category", slug: "category" },
    product_variants: [
      {
        ...products[0].product_variants[0],
        sku: "@SUM(A1:A2)",
        price_cents: -123,
        color: "\tDDE",
        fabric: "\rDDE",
      },
    ],
  };
  const buffer = await buildAnalyticsWorkbookBuffer(
    snapshot,
    [unsafeProduct],
    null,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const productsSheet = workbook.getWorksheet("Produtos");

  for (const [cell, text] of [
    ["A2", "=1+1"],
    ["B2", "+slug"],
    ["C2", "-category"],
    ["E2", "@SUM(A1:A2)"],
    ["G2", "\tDDE"],
    ["H2", "\rDDE"],
  ]) {
    const actual = productsSheet.getCell(cell).value;
    assert.equal(actual.startsWith("'"), true);
    assert.equal(actual.replaceAll("\n", "\r"), `'${text}`);
    assert.equal(productsSheet.getCell(cell).formula, undefined);
  }
  assert.equal(productsSheet.getCell("I2").value, -1.23);
  assert.equal(typeof productsSheet.getCell("I2").value, "number");
  assert.equal(safeXlsxValue(-123), -123);
  assert.equal(safeXlsxValue("\rDDE"), "'\rDDE");
});

function navigationFailure(digest) {
  return Object.assign(new Error("Navigation control flow"), { digest });
}

test("returns 400 for an invalid category without checking admin access", async () => {
  let authorizationCalls = 0;
  const response = await handleAnalyticsExportGet(
    new Request(
      "http://localhost/api/admin/reports/analytics.xlsx?category=bad",
    ),
    {
      async requireCatalogAdmin() {
        authorizationCalls += 1;
        throw new Error("Must not run");
      },
      async getAdminAnalyticsSnapshot() {
        throw new Error("Must not run");
      },
    },
  );

  assert.equal(response.status, 400);
  assert.equal(authorizationCalls, 0);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("returns 401 for an unauthenticated request", async () => {
  let snapshotCalls = 0;
  const response = await handleAnalyticsExportGet(
    new Request("http://localhost/api/admin/reports/analytics.xlsx"),
    {
      async requireCatalogAdmin() {
        throw navigationFailure("NEXT_REDIRECT;push;/conta;307;");
      },
      async getAdminAnalyticsSnapshot() {
        snapshotCalls += 1;
        return snapshot;
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(snapshotCalls, 0);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("returns 403 for an authenticated non-admin request", async () => {
  let snapshotCalls = 0;
  const response = await handleAnalyticsExportGet(
    new Request("http://localhost/api/admin/reports/analytics.xlsx"),
    {
      async requireCatalogAdmin() {
        throw navigationFailure("NEXT_HTTP_ERROR_FALLBACK;404");
      },
      async getAdminAnalyticsSnapshot() {
        snapshotCalls += 1;
        return snapshot;
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(snapshotCalls, 0);
});

test("downloads a real XLSX with private headers and forwards the category filter", async () => {
  const product = makeProduct(9901);
  const mock = mockAdminCatalogRpc([product]);
  let receivedCategory = undefined;
  const response = await handleAnalyticsExportGet(
    new Request(
      `http://localhost/api/admin/reports/analytics.xlsx?category=${categoryId}`,
    ),
    {
      async requireCatalogAdmin(returnTo) {
        assert.equal(returnTo, "/admin");
        return mock.client;
      },
      async getAdminAnalyticsSnapshot(options) {
        receivedCategory = options.categoryId;
        return snapshot;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedCategory, categoryId);
  assert.equal(mock.calls[0].args.p_category_id, categoryId);
  assert.equal(
    response.headers.get("content-type"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.match(
    response.headers.get("content-disposition"),
    /^attachment; filename="imperio-analytics-2026-10-15\.xlsx"$/u,
  );
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");

  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(
    response.headers.get("content-length"),
    String(bytes.byteLength),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert.equal(workbook.getWorksheet("Resumo").getCell("B2").value, 2);
  assert.equal(workbook.getWorksheet("Resumo").getCell("B12").value, "Sofás");
  assert.equal(
    workbook.getWorksheet("Metodologia").getCell("B3").value,
    "Sofás",
  );
  assert.equal(
    workbook.getWorksheet("Metodologia").getCell("A2").value,
    "Gerado em (UTC)",
  );
  assert.equal(
    workbook.getWorksheet("Metodologia").getCell("B2").numFmt,
    'dd/mm/yyyy hh:mm "UTC"',
  );
  assert.equal(
    workbook.getWorksheet("Produtos").getCell("A2").value,
    product.name,
  );
});
