import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  guardReadOnlySupabase,
  loadManifest,
  parseArgs,
  runImport,
} from "../scripts/import-legacy-catalog.mjs";

const berlinSourceId = "ca706444-d0fc-4960-985c-07b7a394705b";
const berlinTargetId = "26b943bd-45f8-49c2-989c-0f1ddcbea356";

function makeManifest() {
  const berlinVariants = [
    ["2.10 m", 382800, 2100, "IMP-SOF-SOFABERLIM-210"],
    ["2.30 m", 394800, 2300, "IMP-SOF-SOFABERLIM-230"],
    ["2.50 m", 402800, 2500, "IMP-SOF-SOFABERLIM-250"],
    ["2.90 m", 430000, 2900, "IMP-SOF-SOFABERLIM-290"],
  ].map(([label, price_cents, width_mm, sku], source_variant_index) => ({
    label,
    price_cents,
    sku,
    width_mm,
    depth_mm: null,
    height_mm: null,
    on_hand: 10,
    low_stock_threshold: 5,
    is_active: false,
    attributes: { source_variant_index },
  }));
  const berlin = {
    sourceId: berlinSourceId,
    targetId: berlinTargetId,
    slug: "sofa-berlim",
    categorySlug: "sofas",
    generatedSingle: false,
    explicitVariants: 4,
    sourcePayload: {},
    sourceHash: "a".repeat(64),
    product: {
      id: berlinTargetId,
      name: "Sofá Berlim",
      slug: "sofa-berlim",
      description: "Sofá Berlim de teste unitário",
      free_shipping: false,
    },
    variants: berlinVariants,
    images: [
      {
        source_image_id: "source-image-berlin",
        source_url: "https://source.invalid/image.webp",
        storage_path: `products/${berlinTargetId}/source-image-berlin.webp`,
        alt_text: "Sofá Berlim",
        position: 0,
        attributes: {},
      },
    ],
  };
  const otherProduct = {
    sourceId: "a6edfcac-7b6c-4e2d-9015-b3fabdaae890",
    targetId: "eb51a046-dfcf-4ab7-9dae-88793af0e5c0",
    slug: "colchao-teste",
    categorySlug: "colchoes",
    generatedSingle: true,
    explicitVariants: 0,
    sourcePayload: {},
    sourceHash: "b".repeat(64),
    product: {
      id: "eb51a046-dfcf-4ab7-9dae-88793af0e5c0",
      name: "Colchão de teste",
      slug: "colchao-teste",
      description: "",
      free_shipping: false,
    },
    variants: [
      {
        sku: "IMP-COL-COLCHAODETESTE-01",
        price_cents: 100000,
        is_active: false,
        on_hand: 10,
        low_stock_threshold: 5,
      },
    ],
    images: [],
  };
  return {
    categories: [
      { source_id: "cat-sofa", slug: "sofas", name: "Sofás", position: 1 },
      {
        source_id: "cat-colchao",
        slug: "colchoes",
        name: "Colchões",
        position: 2,
      },
    ],
    products: [berlin, otherProduct],
    sourceVariantCount: 4,
    generatedSingleCount: 1,
    sourceImageCount: 1,
    dimensionMissing: 0,
  };
}

function makeReadOnlySupabaseProbe() {
  const calls = { selects: [], rpc: [], storageReads: [], mutations: [] };
  const categories = [
    {
      id: "db-sofas",
      name: "Sofás",
      slug: "sofas",
      description: "",
      position: 1,
      is_active: false,
    },
    {
      id: "db-colchoes",
      name: "Colchões",
      slug: "colchoes",
      description: "",
      position: 2,
      is_active: false,
    },
  ];
  const rows = { categories, products: [], product_variants: [] };
  const supabase = {
    from(table) {
      const builder = {
        select(columns) {
          calls.selects.push({ table, columns });
          return builder;
        },
        insert() {
          calls.mutations.push(`insert:${table}`);
          throw new Error("insert executado no teste de dry-run");
        },
        update() {
          calls.mutations.push(`update:${table}`);
          throw new Error("update executado no teste de dry-run");
        },
        delete() {
          calls.mutations.push(`delete:${table}`);
          throw new Error("delete executado no teste de dry-run");
        },
        upsert() {
          calls.mutations.push(`upsert:${table}`);
          throw new Error("upsert executado no teste de dry-run");
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
    schema() {
      return { from: supabase.from };
    },
    rpc(name) {
      calls.rpc.push(name);
      throw new Error(`RPC executada no teste de dry-run: ${name}`);
    },
    storage: {
      createBucket() {
        calls.mutations.push("storage.createBucket");
        throw new Error("createBucket executado no teste de dry-run");
      },
      deleteBucket() {
        calls.mutations.push("storage.deleteBucket");
        throw new Error("deleteBucket executado no teste de dry-run");
      },
      emptyBucket() {
        calls.mutations.push("storage.emptyBucket");
        throw new Error("emptyBucket executado no teste de dry-run");
      },
      updateBucket() {
        calls.mutations.push("storage.updateBucket");
        throw new Error("updateBucket executado no teste de dry-run");
      },
      from(bucket) {
        return {
          list() {
            calls.storageReads.push(`list:${bucket}`);
            return Promise.resolve({ data: [], error: null });
          },
          upload() {
            calls.mutations.push(`storage.upload:${bucket}`);
            throw new Error("Storage upload executado no teste de dry-run");
          },
          remove() {
            calls.mutations.push(`storage.remove:${bucket}`);
            throw new Error("Storage remove executado no teste de dry-run");
          },
        };
      },
    },
  };
  return { calls, supabase };
}

for (const phase of ["berlin", "all"]) {
  test(`--phase=${phase} dry-run não chama qualquer operação mutável`, async () => {
    const { calls, supabase } = makeReadOnlySupabaseProbe();
    const output = [];

    await runImport({
      args: new Map([
        ["phase", phase],
        ...(phase === "all" ? [["confirm-berlin-gate", "ADMIN_VISIBLE"]] : []),
      ]),
      manifest: makeManifest(),
      supabase,
      stdout: (line) => output.push(line),
      env: {},
    });

    assert.deepEqual(calls.mutations, []);
    assert.deepEqual(calls.rpc, []);
    assert.deepEqual(calls.storageReads, []);
    assert.ok(calls.selects.length > 0, "preflight deve continuar read-only");
    const summary = JSON.parse(output[0]);
    assert.equal(summary.MODE, "DRY_RUN");
    assert.equal(
      summary.BERLIN_IDEMPOTENCY_CHECK,
      phase === "all" ? "SKIPPED_READ_ONLY" : "NOT_APPLICABLE",
    );
  });
}

test("trava read-only rejeita RPC, DML e mutações do Storage", () => {
  const { calls, supabase } = makeReadOnlySupabaseProbe();
  const readOnly = guardReadOnlySupabase(supabase);

  assert.throws(
    () => readOnly.rpc("import_legacy_catalog_product"),
    /bloquead/,
  );
  assert.throws(() => readOnly.from("products").insert({}), /bloquead/);
  assert.throws(() => readOnly.from("products").update({}), /bloquead/);
  assert.throws(() => readOnly.from("products").delete(), /bloquead/);
  assert.throws(() => readOnly.from("products").upsert({}), /bloquead/);
  assert.throws(
    () => readOnly.schema("public").from("products").insert({}),
    /bloquead/,
  );
  assert.throws(
    () => readOnly.schema("public").from("products").update({}),
    /bloquead/,
  );
  assert.throws(
    () => readOnly.storage.from("catalog-images").upload(),
    /bloquead/,
  );
  assert.throws(
    () => readOnly.storage.from("catalog-images").remove(),
    /bloquead/,
  );
  for (const method of [
    "createBucket",
    "deleteBucket",
    "emptyBucket",
    "updateBucket",
  ]) {
    assert.throws(() => readOnly.storage[method](), /bloquead/);
  }
  assert.deepEqual(calls.mutations, []);
  assert.deepEqual(calls.rpc, []);
});

test("facades ocultam internals e bloqueiam mutações/reflection", () => {
  let underlyingBuilder;
  const supabase = {
    rest: {
      from() {
        return { mutationEscape: true };
      },
    },
    from() {
      underlyingBuilder ??= {
        select() {
          return underlyingBuilder;
        },
      };
      return underlyingBuilder;
    },
    storage: {
      internalClient: { mutationEscape: true },
      from() {
        return {
          list() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    },
  };
  const guardedBuilder = guardReadOnlySupabase(supabase)
    .from("products")
    .select("id");
  const initialPrototype = Object.getPrototypeOf(underlyingBuilder);
  const initialDescriptor = Object.getOwnPropertyDescriptor(
    underlyingBuilder,
    "select",
  );

  assert.throws(() => {
    guardedBuilder.method = "DELETE";
  }, /Atribuição da propriedade method bloqueada/);
  assert.throws(
    () =>
      Object.defineProperty(guardedBuilder, "select", {
        value: () => "DELETE",
      }),
    /Definição da propriedade select bloqueada/,
  );
  assert.throws(
    () => Reflect.deleteProperty(guardedBuilder, "select"),
    /Remoção da propriedade select bloqueada/,
  );
  assert.throws(
    () => Object.setPrototypeOf(guardedBuilder, { select: () => "DELETE" }),
    /Alteração do protótipo bloqueada/,
  );
  assert.throws(
    () => Object.preventExtensions(guardedBuilder),
    /Alteração de extensibilidade bloqueada/,
  );
  assert.throws(
    () => Object.freeze(guardedBuilder),
    /Alteração de extensibilidade bloqueada/,
  );

  const readOnlyClient = guardReadOnlySupabase(supabase);
  assert.equal(
    Object.getOwnPropertyDescriptor(readOnlyClient, "rest"),
    undefined,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(readOnlyClient, "from"),
    undefined,
  );
  assert.deepEqual(Reflect.ownKeys(readOnlyClient), []);
  assert.equal(Object.getPrototypeOf(readOnlyClient), null);
  assert.throws(() => readOnlyClient.rest, /bloqueado/);
  assert.throws(
    () => Object.setPrototypeOf(readOnlyClient, { rest: supabase }),
    /Alteração do protótipo bloquead/,
  );
  assert.throws(() => readOnlyClient.from("products").insert({}), /bloqueado/);
  const queryFacade = readOnlyClient.from("products").select("id");
  assert.equal(Object.getOwnPropertyDescriptor(queryFacade, "rest"), undefined);
  assert.deepEqual(Reflect.ownKeys(queryFacade), []);
  assert.equal(Object.getPrototypeOf(queryFacade), null);

  const storageFacade = readOnlyClient.storage;
  const bucketFacade = storageFacade.from("catalog-images");
  assert.equal(
    Object.getOwnPropertyDescriptor(storageFacade, "from"),
    undefined,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(bucketFacade, "upload"),
    undefined,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(readOnlyClient, "rest"),
    undefined,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(storageFacade, "internalClient"),
    undefined,
  );
  assert.deepEqual(Reflect.ownKeys(storageFacade), []);
  assert.deepEqual(Reflect.ownKeys(bucketFacade), []);
  assert.equal(Object.getPrototypeOf(storageFacade), null);
  assert.equal(Object.getPrototypeOf(bucketFacade), null);
  assert.throws(
    () => (storageFacade.from = () => supabase.storage),
    /Atribuição/,
  );
  assert.throws(
    () => Reflect.set(bucketFacade, "upload", () => "write"),
    /Atribuição/,
  );
  assert.throws(
    () => Object.setPrototypeOf(bucketFacade, { upload: () => "write" }),
    /Alteração do protótipo/,
  );
  assert.throws(() => bucketFacade.upload(), /bloqueado/);

  assert.deepEqual(
    Object.getOwnPropertyDescriptor(underlyingBuilder, "select"),
    initialDescriptor,
  );
  assert.equal(Object.hasOwn(underlyingBuilder, "method"), false);
  assert.equal(Object.getPrototypeOf(underlyingBuilder), initialPrototype);
  assert.equal(Object.isExtensible(underlyingBuilder), true);
});

test("facades capturam intrinsics contra substituição global posterior", () => {
  const supabase = {
    rest: { internal: "raw-client" },
    from() {
      return { select() {} };
    },
    storage: { internalClient: "raw-storage", from() {} },
  };
  const originalCreate = Object.create;
  const originalProxy = Proxy;
  let facade;

  try {
    Object.create = () => supabase;
    globalThis.Proxy = function FakeProxy(target) {
      return target;
    };
    facade = guardReadOnlySupabase(supabase);
  } finally {
    Object.create = originalCreate;
    globalThis.Proxy = originalProxy;
  }

  assert.equal(Object.getPrototypeOf(facade), null);
  assert.deepEqual(Reflect.ownKeys(facade), []);
  assert.equal(Object.getOwnPropertyDescriptor(facade, "rest"), undefined);
  assert.throws(() => facade.rest, /bloqueado/);
});

test("allowlists não dependem do iterador global mutável de Set", () => {
  const { calls, supabase } = makeReadOnlySupabaseProbe();
  const originalSetIterator = Set.prototype[Symbol.iterator];

  try {
    Set.prototype[Symbol.iterator] = function* fakeSetIterator() {
      yield "delete";
      yield "upload";
    };
    const facade = guardReadOnlySupabase(supabase);
    assert.throws(() => facade.from("products").delete(), /bloqueado/);
    assert.throws(
      () => facade.storage.from("catalog-images").upload(),
      /bloqueado/,
    );
  } finally {
    Set.prototype[Symbol.iterator] = originalSetIterator;
  }

  assert.deepEqual(calls.mutations, []);
});

function sourceInventoryFixture() {
  const categories = [
    ["sofas", "Sofás"],
    ["colchoes", "Colchões"],
    ["sala-de-jantar", "Sala de jantar"],
    ["roupeiros", "Roupeiros"],
    ["rack", "Rack"],
    ["poltronas", "Poltronas"],
    ["camas", "Camas"],
  ].map(([slug, name], index) => ({
    source_id: `source-category-${index}`,
    slug,
    name,
    position: index,
    products: [],
  }));
  const imageMetadata = [];
  let imageIndex = 0;

  for (let productIndex = 0; productIndex < 51; productIndex += 1) {
    const category = categories[productIndex % categories.length];
    const isBerlin = productIndex === 0;
    const explicitVariants = isBerlin
      ? [
          ["2.10 m", 382800],
          ["2.30 m", 394800],
          ["2.50 m", 402800],
          ["2.90 m", 430000],
        ]
      : productIndex <= 31
        ? [["Opção 1", 100000 + productIndex]]
        : [];
    const imagesForProduct = isBerlin ? 1 : productIndex <= 6 ? 3 : 2;
    const images = Array.from({ length: imagesForProduct }, (_, index) => {
      const source_image_id = `source-image-${imageIndex++}`;
      imageMetadata.push({ id: source_image_id });
      return {
        source_image_id,
        url: `https://example.invalid/${source_image_id}.jpg`,
        storage_path: `products/${productIndex}/${source_image_id}.jpg`,
        alt_text_source: `Imagem ${source_image_id}`,
        sort_order: index,
        is_primary: index === 0,
      };
    });
    const product = {
      source_id: isBerlin
        ? berlinSourceId
        : `00000000-0000-4000-8000-${String(productIndex).padStart(12, "0")}`,
      source_slug: isBerlin ? "sofa-berlim" : `produto-${productIndex}`,
      name: isBerlin ? "Sofá Berlim" : `Produto ${productIndex}`,
      description: `Descrição ${productIndex}`,
      price_cents: explicitVariants.length ? null : 100000 + productIndex,
      variants: explicitVariants.map(([label, price_cents]) => ({
        label,
        price_cents,
      })),
      dimensions: [],
      source_missing: { dimensions: productIndex < 11 },
      images,
    };
    category.products.push(product);
  }

  return {
    inventory: {
      totals: {
        categories: 7,
        products: 51,
        images: 107,
        activeVariants: 35,
      },
      categories,
    },
    rawCategories: categories.map((category) => ({
      products: category.products.map(({ source_id, name }) => ({
        source_id,
        name,
      })),
    })),
    imageResponse: { body: imageMetadata },
  };
}

test("CLI parseia flags e preserva valor de manifest-dir com '='", () => {
  const args = parseArgs([
    "--phase=all",
    "--confirm-berlin-gate=ADMIN_VISIBLE",
    "--manifest-dir=C:\\catalog=reviewed",
  ]);

  assert.equal(args.get("phase"), "all");
  assert.equal(args.get("confirm-berlin-gate"), "ADMIN_VISIBLE");
  assert.equal(args.get("manifest-dir"), "C:\\catalog=reviewed");
  assert.throws(
    () => parseArgs(["--apply-all", "--apply-all"]),
    /--apply-all não pode ser informado mais de uma vez/,
  );
  assert.throws(
    () => parseArgs(["--apply-all", "false"]),
    /Argumento inválido; esperava uma opção --nome: false/,
  );
  assert.throws(
    () => parseArgs(["--apply-all=false"]),
    /não aceita valor explícito/,
  );
  assert.throws(() => parseArgs(["--mystery"]), /Opção desconhecida/);
});

test("parser captura RegExp.exec contra substituição global posterior", () => {
  const originalExec = RegExp.prototype.exec;
  let parseError;

  try {
    RegExp.prototype.exec = function patchedExec(input) {
      if (input === "--apply-all=false") {
        return [input, "apply-all", undefined];
      }
      return originalExec.call(this, input);
    };
    try {
      parseArgs(["--apply-all=false"]);
    } catch (error) {
      parseError = error;
    }
  } finally {
    RegExp.prototype.exec = originalExec;
  }

  assert.match(
    parseError?.message ?? "",
    /--apply-all não aceita valor explícito/,
  );
});

test("parser não depende do iterador global de Array para validar flags apply", () => {
  const originalArrayIterator = Array.prototype[Symbol.iterator];
  let parseError;

  try {
    Array.prototype[Symbol.iterator] = function* patchedArrayIterator() {
      yield "--apply-all=false";
      yield "apply-all";
      yield undefined;
    };
    try {
      parseArgs(["--apply-all=false"]);
    } catch (error) {
      parseError = error;
    }
  } finally {
    Array.prototype[Symbol.iterator] = originalArrayIterator;
  }

  assert.match(
    parseError?.message ?? "",
    /--apply-all não aceita valor explícito/,
  );
});

for (const flag of ["apply-berlin", "apply-all"]) {
  test(`--${flag}=false falha fechado antes do manifest e do cliente`, async () => {
    let manifestLoads = 0;
    let clientPropertyReads = 0;
    const inaccessibleSupabase = new Proxy(
      {},
      {
        get() {
          clientPropertyReads += 1;
          throw new Error("cliente Supabase acessado durante validação CLI");
        },
      },
    );
    const argv = [
      `--phase=${flag === "apply-all" ? "all" : "berlin"}`,
      `--${flag}=false`,
      ...(flag === "apply-all" ? ["--confirm-berlin-gate=ADMIN_VISIBLE"] : []),
    ];

    assert.throws(
      () => parseArgs(argv),
      new RegExp(`--${flag} não aceita valor explícito`),
    );
    const args = new Map([
      ["phase", flag === "apply-all" ? "all" : "berlin"],
      [flag, "false"],
      ...(flag === "apply-all"
        ? [["confirm-berlin-gate", "ADMIN_VISIBLE"]]
        : []),
    ]);
    await assert.rejects(
      runImport({
        args,
        manifestLoader: async () => {
          manifestLoads += 1;
          throw new Error("manifest carregado antes da validação CLI");
        },
        supabase: inaccessibleSupabase,
        env: {},
        stdout: () => {},
      }),
      new RegExp(`--${flag} não aceita valor explícito`),
    );
    assert.equal(manifestLoads, 0);
    assert.equal(clientPropertyReads, 0);
  });
}

test("valores explícitos inválidos de apply falham antes de qualquer acesso", async () => {
  let manifestLoads = 0;
  for (const [flag, value] of [
    ["apply-berlin", "true"],
    ["apply-all", "0"],
  ]) {
    await assert.rejects(
      runImport({
        args: new Map([
          ["phase", flag === "apply-all" ? "all" : "berlin"],
          [flag, value],
          ...(flag === "apply-all"
            ? [["confirm-berlin-gate", "ADMIN_VISIBLE"]]
            : []),
        ]),
        manifestLoader: async () => {
          manifestLoads += 1;
          throw new Error("manifest carregado antes da validação CLI");
        },
        env: {},
        stdout: () => {},
      }),
      new RegExp(`--${flag} não aceita valor explícito`),
    );
  }
  assert.equal(manifestLoads, 0);
});

test("runImport não confia em Map.get/has mutáveis para selecionar apply", async () => {
  const { calls, supabase } = makeReadOnlySupabaseProbe();
  const originalGet = Map.prototype.get;
  const originalHas = Map.prototype.has;
  const args = new Map([
    ["phase", "all"],
    ["confirm-berlin-gate", "ADMIN_VISIBLE"],
  ]);
  const output = [];

  try {
    Map.prototype.get = function patchedGet(key) {
      if (key === "apply-all") return true;
      return originalGet.call(this, key);
    };
    Map.prototype.has = function patchedHas(key) {
      if (key === "apply-all") return true;
      return originalHas.call(this, key);
    };
    await runImport({
      args,
      manifest: makeManifest(),
      supabase,
      stdout: (line) => output.push(line),
      env: {},
    });
  } finally {
    Map.prototype.get = originalGet;
    Map.prototype.has = originalHas;
  }

  assert.equal(JSON.parse(output[0]).MODE, "DRY_RUN");
  assert.deepEqual(calls.mutations, []);
  assert.deepEqual(calls.rpc, []);
});

test("argumentos inválidos e gate ausente falham antes de carregar manifest ou criar cliente", async () => {
  let manifestLoads = 0;
  const inaccessibleSupabase = new Proxy(
    {},
    {
      get() {
        throw new Error("cliente Supabase acessado antes da validação CLI");
      },
    },
  );
  const shared = {
    manifestLoader: async () => {
      manifestLoads += 1;
      throw new Error("manifest carregado antes da validação CLI");
    },
    supabase: inaccessibleSupabase,
    env: {},
    stdout: () => {},
  };

  await assert.rejects(
    runImport({ ...shared, args: new Map([["phase", "unexpected"]]) }),
    /Use --phase=berlin ou --phase=all/,
  );
  await assert.rejects(
    runImport({
      ...shared,
      args: new Map([
        ["phase", "all"],
        ["apply-all", true],
        ["false", true],
        ["confirm-berlin-gate", "ADMIN_VISIBLE"],
      ]),
    }),
    /Argumento desconhecido ou mapa de argumentos inválido/,
  );
  await assert.rejects(
    runImport({ ...shared, args: new Map([["phase", "all"]]) }),
    /confirm-berlin-gate=ADMIN_VISIBLE/,
  );
  assert.equal(manifestLoads, 0);
});

test("manifest-dir ausente falha antes de ler ambiente privilegiado", async () => {
  const env = new Proxy(
    {},
    {
      get() {
        throw new Error("ambiente privilegiado foi acessado sem manifest");
      },
    },
  );

  await assert.rejects(
    runImport({ args: new Map([["phase", "berlin"]]), env, stdout: () => {} }),
    /Informe --manifest-dir/,
  );
});

test("manifest válido é somente lido e valida os totais e o Sofá Berlim", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "import-dry-run-"));
  const files = sourceInventoryFixture();
  const contents = [
    ["legacy-catalog-inventory.json", files.inventory],
    ["legacy-source-api-raw.json", files.rawCategories],
    ["legacy-source-image-metadata.json", files.imageResponse],
  ];

  try {
    await Promise.all(
      contents.map(([name, value]) =>
        writeFile(path.join(directory, name), JSON.stringify(value)),
      ),
    );
    const before = await Promise.all(
      contents.map(async ([name]) =>
        readFile(path.join(directory, name), "utf8"),
      ),
    );
    const manifest = await loadManifest(directory);
    const after = await Promise.all(
      contents.map(async ([name]) =>
        readFile(path.join(directory, name), "utf8"),
      ),
    );

    assert.equal(manifest.categories.length, 7);
    assert.equal(manifest.products.length, 51);
    assert.equal(manifest.sourceImageCount, 107);
    assert.equal(manifest.sourceVariantCount, 35);
    assert.equal(manifest.dimensionMissing, 11);
    assert.equal(
      manifest.products.find((product) => product.sourceId === berlinSourceId)
        .slug,
      "sofa-berlim",
    );
    assert.deepEqual(after, before, "loadManifest alterou arquivos de entrada");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("manifest JSON inválido é rejeitado sem produzir saída", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "import-dry-run-invalid-"),
  );
  const output = [];
  try {
    await writeFile(
      path.join(directory, "legacy-catalog-inventory.json"),
      "{not-json",
    );
    await writeFile(path.join(directory, "legacy-source-api-raw.json"), "[]");
    await writeFile(
      path.join(directory, "legacy-source-image-metadata.json"),
      JSON.stringify({ body: [] }),
    );
    await assert.rejects(loadManifest(directory));
    assert.deepEqual(output, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
