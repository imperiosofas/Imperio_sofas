import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NativeMap = Map;
const safeReflectApply = Reflect.apply;
const safeReflectGet = Reflect.get;
const safeObjectHasOwn = Object.hasOwn;
const safeObjectCreate = Object.create;
const SafeProxy = Proxy;
const safeMapGet = NativeMap.prototype.get;
const safeMapHas = NativeMap.prototype.has;
const safeMapSet = NativeMap.prototype.set;
const safeRegExpExec = RegExp.prototype.exec;
const cliArgumentPattern = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/;
const safeMapSize = Object.getOwnPropertyDescriptor(
  NativeMap.prototype,
  "size",
).get;
const cliArgumentNames = Object.freeze([
  "apply-all",
  "apply-berlin",
  "confirm-berlin-gate",
  "manifest-dir",
  "phase",
]);

function isKnownCliArgument(name) {
  for (let index = 0; index < cliArgumentNames.length; index += 1) {
    if (cliArgumentNames[index] === name) return true;
  }
  return false;
}

export function parseArgs(argv) {
  const args = new NativeMap();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const match = safeReflectApply(safeRegExpExec, cliArgumentPattern, [arg]);
    if (!match) {
      throw new Error(`Argumento inválido; esperava uma opção --nome: ${arg}`);
    }
    const key = match[1];
    const value = match[2];
    if (!isKnownCliArgument(key)) {
      throw new Error(`Opção desconhecida: --${key}.`);
    }
    if (key === "apply-berlin" || key === "apply-all") {
      if (safeReflectApply(safeMapHas, args, [key])) {
        throw new Error(`--${key} não pode ser informado mais de uma vez.`);
      }
      if (value !== undefined) {
        throw new Error(
          `--${key} não aceita valor explícito; use a flag sem '=...' ou remova-a.`,
        );
      }
    }
    safeReflectApply(safeMapSet, args, [
      key,
      value === undefined ? true : value,
    ]);
  }
  return args;
}

const expectedBerlin = {
  sourceId: "ca706444-d0fc-4960-985c-07b7a394705b",
  productId: "26b943bd-45f8-49c2-989c-0f1ddcbea356",
  slug: "sofa-berlim",
  prices: [382800, 394800, 402800, 430000],
  widthsMm: [2100, 2300, 2500, 2900],
  skus: [
    "IMP-SOF-SOFABERLIM-210",
    "IMP-SOF-SOFABERLIM-230",
    "IMP-SOF-SOFABERLIM-250",
    "IMP-SOF-SOFABERLIM-290",
  ],
};
const categoryCodes = new Map([
  ["sofas", "SOF"],
  ["colchoes", "COL"],
  ["sala-de-jantar", "SAL"],
  ["roupeiros", "ROU"],
  ["rack", "RAC"],
  ["racks", "RAC"],
  ["poltronas", "POL"],
  ["camas", "CAM"],
]);
const projectId = "qsafyqsskwbjnailgoev";
const sourceProjectId = "nurylzdxrturcfdsqoib";
const bucketName = "catalog-images";
const allowedSourceHost = `${sourceProjectId}.supabase.co`;
const uuidNamespace = Buffer.from("efc8df24461b5bc1b70a63de4c6cb4f8", "hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function snapshotCliArguments(input) {
  const snapshot = safeObjectCreate(null);
  let recognizedCount = 0;
  for (let index = 0; index < cliArgumentNames.length; index += 1) {
    const key = cliArgumentNames[index];
    if (!safeReflectApply(safeMapHas, input, [key])) continue;
    snapshot[key] = safeReflectApply(safeMapGet, input, [key]);
    recognizedCount += 1;
  }
  const inputSize = safeReflectApply(safeMapSize, input, []);
  assert(
    inputSize === recognizedCount,
    "Argumento desconhecido ou mapa de argumentos inválido.",
  );
  return snapshot;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableProductId(sourceId) {
  if (sourceId === expectedBerlin.sourceId) return expectedBerlin.productId;
  const digest = createHash("sha1")
    .update(uuidNamespace)
    .update(Buffer.from(sourceId.replaceAll("-", ""), "hex"))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function skuFor(categorySlug, product, variant, index) {
  const code = categoryCodes.get(categorySlug);
  assert(code, `Categoria sem código técnico: ${categorySlug}`);
  const productToken = slugify(product.name)
    .replaceAll("-", "")
    .toUpperCase()
    .slice(0, 24);
  const labelNumber = String(variant?.label ?? "")
    .match(/\d+(?:[.,]\d+)?/)?.[0]
    ?.replace(/\D/g, "");
  const suffix = labelNumber || String(index + 1).padStart(2, "0");
  return `IMP-${code}-${productToken}-${suffix}`;
}

function parseMillimeters(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const factor = { mm: 1, cm: 10, m: 1000 }[match[2].toLowerCase()];
  const result = Math.round(amount * factor);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function sofaVariantWidthMillimeters(categorySlug, label) {
  if (categorySlug !== "sofas") return null;
  return parseMillimeters(typeof label === "string" ? label : "");
}

function sharedDimensions(product) {
  const dimensions = Array.isArray(product.dimensions)
    ? product.dimensions
    : [];
  const result = { width_mm: null, depth_mm: null, height_mm: null };
  for (const dimension of dimensions) {
    const label = slugify(dimension.label ?? "");
    const amount = parseMillimeters(dimension.value_text);
    if (amount === null) continue;
    if (["largura", "comprimento"].includes(label)) result.width_mm ??= amount;
    if (["profundidade", "profundidade-fechado"].includes(label))
      result.depth_mm ??= amount;
    if (label === "altura") result.height_mm ??= amount;
  }
  return result;
}

function meaningfulAlt(product, image) {
  const labels = [
    ...(image.variant_labels ?? []),
    ...(image.fabric_labels ?? []),
    ...(image.color_labels ?? []),
  ].filter(Boolean);
  return [product.name, ...labels].join(", ").slice(0, 300);
}

function makeProduct(category, sourceProduct) {
  const categorySlug = slugify(category.slug);
  const slug = slugify(sourceProduct.source_slug || sourceProduct.name);
  assert(slug, `Slug vazio na origem: ${sourceProduct.source_id}`);
  const explicitVariants = Array.isArray(sourceProduct.variants)
    ? sourceProduct.variants
    : [];
  const dimensionValues = sharedDimensions(sourceProduct);
  const sourceProductFacts = {
    source_dimensions: sourceProduct.dimensions ?? [],
    source_colors: sourceProduct.colors ?? [],
    source_fabrics: sourceProduct.fabrics ?? [],
    source_features: sourceProduct.features ?? [],
  };
  const sourceVariants = explicitVariants.length
    ? explicitVariants
    : [
        {
          label: null,
          price_cents: sourceProduct.price_cents ?? null,
          installment_count: null,
          installment_value_cents: null,
        },
      ];
  const variants = sourceVariants.map((variant, index) => {
    const sku = skuFor(categorySlug, sourceProduct, variant, index);
    const generatedSingle = explicitVariants.length === 0;
    const variantWidthMm = sofaVariantWidthMillimeters(
      categorySlug,
      variant.label,
    );
    return {
      sku,
      fabric: null,
      color: null,
      width_mm: variantWidthMm ?? dimensionValues.width_mm,
      depth_mm: dimensionValues.depth_mm,
      height_mm: dimensionValues.height_mm,
      attributes: {
        sku_origin: "generated",
        variant_origin: generatedSingle
          ? "generated_single"
          : "explicit_source_variant",
        source_variant_label: variant.label,
        source_variant_width_label: variantWidthMm ? variant.label : null,
        source_variant_width_mm: variantWidthMm,
        source_variant_index: index,
        source_installment_count: variant.installment_count,
        source_installment_value_cents: variant.installment_value_cents,
        ...sourceProductFacts,
      },
      price_cents: Number.isInteger(variant.price_cents)
        ? variant.price_cents
        : null,
      is_active: false,
      on_hand: 10,
      low_stock_threshold: 5,
    };
  });
  const images = (sourceProduct.images ?? []).map((image, index) => ({
    source_image_id: image.source_image_id,
    source_url: image.url,
    source_storage_path: image.storage_path,
    storage_path: `products/${stableProductId(sourceProduct.source_id)}/${image.source_image_id}.webp`,
    alt_text:
      image.alt_text_source?.trim() || meaningfulAlt(sourceProduct, image),
    position: Number.isInteger(image.sort_order) ? image.sort_order : index,
    attributes: {
      source_image_id: image.source_image_id,
      is_primary: Boolean(image.is_primary),
      color_labels: image.color_labels ?? [],
      fabric_labels: image.fabric_labels ?? [],
      variant_labels: image.variant_labels ?? [],
    },
  }));
  const sourcePayload = {
    source_category_id: category.source_id,
    source_category_slug: category.slug,
    source_product: sourceProduct,
  };
  return {
    sourceId: sourceProduct.source_id,
    targetId: stableProductId(sourceProduct.source_id),
    slug,
    categorySlug,
    generatedSingle: explicitVariants.length === 0,
    explicitVariants: explicitVariants.length,
    sourcePayload,
    sourceHash: sha256(stableJson(sourcePayload)),
    product: {
      id: stableProductId(sourceProduct.source_id),
      name: sourceProduct.name,
      slug,
      description: sourceProduct.description ?? "",
      free_shipping: false,
    },
    variants,
    images,
  };
}

export async function loadManifest(manifestDir) {
  assert(
    manifestDir,
    "Informe --manifest-dir com o diretório dos manifests auditados.",
  );
  const readJson = async (name) =>
    JSON.parse(await readFile(path.join(manifestDir, name), "utf8"));
  const [inventory, rawCategories, imageResponse] = await Promise.all([
    readJson("legacy-catalog-inventory.json"),
    readJson("legacy-source-api-raw.json"),
    readJson("legacy-source-image-metadata.json"),
  ]);
  const imageMetadata =
    typeof imageResponse.body === "string"
      ? JSON.parse(imageResponse.body)
      : imageResponse.body;
  const rawProducts = rawCategories.flatMap(
    (category) => category.products ?? [],
  );
  const products = inventory.categories.flatMap((category) =>
    (category.products ?? []).map((product) => makeProduct(category, product)),
  );
  const sourceProducts = inventory.categories.flatMap(
    (category) => category.products ?? [],
  );
  const sourceImages = sourceProducts.flatMap(
    (product) => product.images ?? [],
  );
  const dimensionMissing = sourceProducts.filter(
    (product) => product.source_missing?.dimensions,
  ).length;
  const explicitVariants = sourceProducts.reduce(
    (sum, product) => sum + (product.variants?.length ?? 0),
    0,
  );
  const duplicate = (values) => {
    const seen = new Set();
    const repeated = new Set();
    for (const value of values) {
      if (seen.has(value)) repeated.add(value);
      seen.add(value);
    }
    return [...repeated];
  };
  assert(
    inventory.totals.categories === 7,
    "Manifest não contém 7 categorias.",
  );
  assert(inventory.totals.products === 51, "Manifest não contém 51 produtos.");
  assert(inventory.totals.images === 107, "Manifest não contém 107 imagens.");
  assert(
    inventory.totals.activeVariants === 35,
    "Manifest não contém 35 variantes explícitas.",
  );
  assert(
    inventory.categories.length === 7,
    "Contagem real de categorias diverge do manifesto.",
  );
  assert(
    products.length === 51 && rawProducts.length === 51,
    "Contagem de produtos diverge entre fontes.",
  );
  assert(
    sourceImages.length === 107 && imageMetadata.length === 107,
    "Contagem de imagens diverge entre fontes.",
  );
  assert(
    explicitVariants === 35,
    "Contagem de variantes explícitas diverge do manifesto.",
  );
  assert(
    dimensionMissing === 11,
    "A contagem de dimensões ausentes diverge do manifesto.",
  );
  assert(
    duplicate(products.map((product) => product.sourceId)).length === 0,
    "IDs de produto duplicados na fonte.",
  );
  assert(
    duplicate(sourceImages.map((image) => image.source_image_id)).length === 0,
    "IDs de imagem duplicados na fonte.",
  );
  const slugDuplicates = duplicate(products.map((product) => product.slug));
  const skuDuplicates = duplicate(
    products.flatMap((product) =>
      product.variants.map((variant) => variant.sku),
    ),
  );
  assert(
    slugDuplicates.length === 0,
    `Slugs de produtos duplicados: ${slugDuplicates.join(", ")}`,
  );
  assert(
    skuDuplicates.length === 0,
    `SKUs técnicos duplicados: ${skuDuplicates.join(", ")}`,
  );
  const imageBySourceId = new Map(
    imageMetadata.map((image) => [image.id, image]),
  );
  assert(
    sourceImages.every((image) => imageBySourceId.has(image.source_image_id)),
    "Metadados de imagem não correspondem à origem.",
  );
  const sourceVariantCount = products.reduce(
    (sum, product) => sum + product.explicitVariants,
    0,
  );
  const generatedSingleCount = products.filter(
    (product) => product.generatedSingle,
  ).length;
  return {
    inventory,
    categories: inventory.categories,
    products,
    imageBySourceId,
    dimensionMissing,
    sourceVariantCount,
    generatedSingleCount,
    sourceImageCount: sourceImages.length,
  };
}

async function makeSupabaseClient(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  assert(
    url && key,
    "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar no ambiente local.",
  );
  assert(
    new URL(url).hostname === `${projectId}.supabase.co`,
    "A URL Supabase não corresponde ao projeto esperado.",
  );
  assert(
    key.startsWith("sb_secret_"),
    "A chave privilegiada não tem o formato secret esperado.",
  );
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getCategoryMap(supabase) {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,position,is_active");
  if (error)
    throw new Error(
      `Falha ao ler categorias do Supabase (${error.code ?? "sem código"}).`,
    );
  return new Map(data.map((category) => [category.slug, category]));
}

async function ensureCategories(supabase, sourceCategories, dryRun) {
  const categoryMap = await getCategoryMap(supabase);
  if (dryRun) return categoryMap;
  for (const source of sourceCategories) {
    const slug = slugify(source.slug);
    if (categoryMap.has(slug)) continue;
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: source.name,
        slug,
        description: source.description ?? "",
        position: source.position ?? 0,
        is_active: false,
      })
      .select("id,name,slug,description,position,is_active")
      .single();
    if (error) {
      const refreshed = await getCategoryMap(supabase);
      if (!refreshed.has(slug))
        throw new Error(
          `Falha ao criar categoria ${slug} (${error.code ?? "sem código"}).`,
        );
      categoryMap.set(slug, refreshed.get(slug));
    } else {
      categoryMap.set(slug, data);
    }
  }
  return categoryMap;
}

async function checkExistingProducts(supabase, products, isBerlinPhase) {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,slug,status");
  if (error)
    throw new Error(
      `Falha ao ler produtos existentes (${error.code ?? "sem código"}).`,
    );
  const bySlug = new Map(data.map((product) => [product.slug, product]));
  for (const product of products) {
    const existing = bySlug.get(product.slug);
    if (!existing) continue;
    if (
      product.sourceId === expectedBerlin.sourceId &&
      isBerlinPhase &&
      existing.id === expectedBerlin.productId &&
      existing.status === "active"
    )
      continue;
    if (existing.id !== product.targetId)
      throw new Error(
        `Conflito de slug ${product.slug}; não vou sobrescrever produto existente.`,
      );
  }
  return data;
}

async function checkExistingSkus(supabase, products) {
  const { data, error } = await supabase
    .from("product_variants")
    .select("sku,product_id");
  if (error)
    throw new Error(
      `Falha ao verificar SKUs existentes (${error.code ?? "sem código"}).`,
    );
  const targetIds = new Set(products.map((product) => product.targetId));
  const existingBySku = new Map(
    data
      .filter((variant) => variant.sku)
      .map((variant) => [variant.sku, variant]),
  );
  for (const product of products) {
    for (const variant of product.variants) {
      const existing = existingBySku.get(variant.sku);
      if (existing && !targetIds.has(existing.product_id))
        throw new Error(
          `Conflito no SKU técnico ${variant.sku}; nenhum dado foi sobrescrito.`,
        );
    }
  }
}

function assertBerlinSource(product) {
  assert(
    product.sourceId === expectedBerlin.sourceId,
    "Sofá Berlim real não foi localizado uma única vez.",
  );
  assert(
    product.slug === expectedBerlin.slug,
    "Slug da origem do Sofá Berlim mudou.",
  );
  assert(
    product.variants.length === 4,
    "Berlim precisa ter exatamente quatro variantes explícitas.",
  );
  assert(
    stableJson(product.variants.map((variant) => variant.price_cents)) ===
      stableJson(expectedBerlin.prices),
    "Os quatro preços do Berlim não correspondem aos valores autorizados.",
  );
  assert(
    stableJson(product.variants.map((variant) => variant.sku)) ===
      stableJson(expectedBerlin.skus),
    "Os SKUs técnicos do Berlim não correspondem ao padrão previsível.",
  );
  assert(
    stableJson(product.variants.map((variant) => variant.width_mm)) ===
      stableJson(expectedBerlin.widthsMm),
    "As quatro medidas explícitas dos rótulos de variante do Berlim não foram normalizadas corretamente.",
  );
  assert(
    product.images.length === 1,
    "Berlim deve ter exatamente a imagem auditada.",
  );
  assert(
    product.variants.every(
      (variant) =>
        variant.on_hand === 10 &&
        variant.low_stock_threshold === 5 &&
        variant.width_mm > 0 &&
        variant.depth_mm === null &&
        variant.height_mm === null &&
        variant.is_active === false,
    ),
    "Berlim não pode receber dimensões inventadas e deve iniciar como rascunho não vendável.",
  );
}

async function readSourceImage(image) {
  const url = new URL(image.source_url);
  assert(url.protocol === "https:", "A imagem fonte precisa usar HTTPS.");
  assert(
    url.hostname === allowedSourceHost,
    "Host da imagem fonte não corresponde ao Supabase legado auditado.",
  );
  assert(
    url.pathname.startsWith("/storage/v1/object/public/product-images/"),
    "Bucket fonte da imagem divergente.",
  );
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assert(
    response.ok,
    `Falha HTTP ${response.status} ao baixar imagem ${image.source_image_id}.`,
  );
  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim();
  assert(
    contentType?.startsWith("image/"),
    `Tipo de conteúdo inesperado para ${image.source_image_id}.`,
  );
  const input = Buffer.from(await response.arrayBuffer());
  assert(
    input.byteLength > 0 && input.byteLength <= 10 * 1024 * 1024,
    "Imagem fonte vazia ou maior que 10 MB.",
  );
  const { default: sharp } = await import("sharp");
  const output = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer();
  assert(
    output.byteLength > 0 && output.byteLength <= 10 * 1024 * 1024,
    "Imagem WebP processada vazia ou acima de 10 MB.",
  );
  return output;
}

async function ensureStoredImage(supabase, image, bytes) {
  const folder = path.posix.dirname(image.storage_path);
  const filename = path.posix.basename(image.storage_path);
  const { data: files, error: listError } = await supabase.storage
    .from(bucketName)
    .list(folder, { limit: 100, search: filename });
  if (listError)
    throw new Error(
      `Falha ao verificar objeto de Storage (${listError.name ?? "erro"}).`,
    );
  const exists = files.some((file) => file.name === filename);
  const digest = sha256(bytes);
  if (exists) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(image.storage_path);
    if (error || !data)
      throw new Error(
        "Não foi possível validar objeto preexistente no Storage.",
      );
    assert(
      sha256(Buffer.from(await data.arrayBuffer())) === digest,
      "Objeto existente diverge da imagem fonte; não será sobrescrito.",
    );
    return { uploaded: false, digest };
  }
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(image.storage_path, bytes, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError)
    throw new Error(
      `Falha no upload de imagem (${uploadError.name ?? "erro"}).`,
    );
  return { uploaded: true, digest };
}

async function objectExists(supabase, storagePath) {
  const folder = path.posix.dirname(storagePath);
  const filename = path.posix.basename(storagePath);
  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    limit: 100,
    search: filename,
  });
  if (error) throw new Error("Falha ao listar objeto no Storage para limpeza.");
  return data.some((file) => file.name === filename);
}

async function callImport(
  supabase,
  categoryId,
  product,
  sourcePayload = product.sourcePayload,
) {
  const media = product.images.map((image) => ({
    storage_path: image.storage_path,
    alt_text: image.alt_text,
    position: image.position,
    attributes: image.attributes,
  }));
  const { data, error } = await supabase.rpc("import_legacy_catalog_product", {
    p_source_product_id: product.sourceId,
    p_source_hash: product.sourceHash,
    p_source_payload: sourcePayload,
    p_category_id: categoryId,
    p_product: product.product,
    p_variants: product.variants,
    p_media: media,
    p_replace_test_fixture: product.sourceId === expectedBerlin.sourceId,
  });
  if (error)
    throw new Error(
      `Falha na gravação transacional do produto (${error.code ?? "sem código"}).`,
    );
  return data;
}

async function cleanupFixtureObjects(supabase, sourceId, cleanupPaths) {
  const removed = [];
  for (const storagePath of cleanupPaths ?? []) {
    if (await objectExists(supabase, storagePath)) {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);
      if (error)
        throw new Error("Falha ao remover objeto temporário do fixture.");
    }
    removed.push(storagePath);
  }
  if (removed.length) {
    const { data, error } = await supabase.rpc(
      "complete_legacy_catalog_cleanup",
      {
        p_source_product_id: sourceId,
        p_paths: removed,
      },
    );
    if (error || data !== true)
      throw new Error("A limpeza do Storage não foi confirmada no ledger.");
  }
}

async function verifyProduct(supabase, product, expectedCategoryId) {
  const { data: dbProduct, error } = await supabase
    .from("products")
    .select("id,category_id,name,slug,description,status")
    .eq("id", product.targetId)
    .single();
  if (error || !dbProduct)
    throw new Error("Produto importado não foi encontrado no banco.");
  assert(
    dbProduct.category_id === expectedCategoryId,
    "Produto ficou associado à categoria errada.",
  );
  assert(
    dbProduct.name === product.product.name && dbProduct.slug === product.slug,
    "Nome/slug persistidos divergem da origem.",
  );
  assert(
    dbProduct.description === product.product.description,
    "Descrição persistida diverge da fonte.",
  );
  assert(dbProduct.status === "draft", "Produto importado não está em DRAFT.");

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select(
      "id,sku,width_mm,depth_mm,height_mm,attributes,price_cents,is_active,inventory(on_hand,reserved,low_stock_threshold)",
    )
    .eq("product_id", product.targetId)
    .order("sku");
  if (variantError) throw new Error("Falha ao verificar variantes e estoque.");
  assert(
    variants.length === product.variants.length,
    "Número de variantes persistidas diverge da origem.",
  );
  const expectedBySku = new Map(
    product.variants.map((variant) => [variant.sku, variant]),
  );
  for (const variant of variants) {
    const expected = expectedBySku.get(variant.sku);
    assert(expected, "SKU inesperado após importação.");
    assert(
      variant.price_cents === expected.price_cents,
      "Preço persistido diverge da origem.",
    );
    assert(
      variant.width_mm === expected.width_mm &&
        variant.depth_mm === expected.depth_mm &&
        variant.height_mm === expected.height_mm,
      "Dimensão persistida diverge da fonte explícita.",
    );
    assert(
      !variant.is_active,
      "Uma variante de rascunho não pode ser vendável.",
    );
    const inventory = Array.isArray(variant.inventory)
      ? variant.inventory[0]
      : variant.inventory;
    assert(
      inventory?.on_hand === 10 &&
        inventory.reserved === 0 &&
        inventory.low_stock_threshold === 5,
      "Estoque/alerta não correspondem ao solicitado.",
    );
  }

  const { data: media, error: mediaError } = await supabase
    .from("product_media")
    .select("id,storage_path,alt_text,attributes,position")
    .eq("product_id", product.targetId)
    .order("position");
  if (mediaError) throw new Error("Falha ao verificar product_media.");
  assert(
    media.length === product.images.length,
    "Número de mídias persistidas diverge da fonte.",
  );
  for (const image of product.images) {
    assert(
      media.some((row) => row.storage_path === image.storage_path),
      "Registro de mídia não aponta para o objeto WebP esperado.",
    );
    assert(
      await objectExists(supabase, image.storage_path),
      "Objeto esperado está ausente do bucket privado.",
    );
    const { data: signed, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(image.storage_path, 15 * 60);
    if (signError || !signed?.signedUrl)
      throw new Error("Não foi possível assinar URL da imagem privada.");
    const signedHead = await fetch(signed.signedUrl, {
      method: "HEAD",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    assert(signedHead.ok, `Signed URL respondeu HTTP ${signedHead.status}.`);
    assert(
      signedHead.headers.get("content-type")?.startsWith("image/webp"),
      "Signed URL não entrega WebP.",
    );
  }

  const { data: publicProduct, error: publicError } = await supabase.rpc(
    "get_catalog_products",
    {
      p_category_slug: null,
      p_product_slug: product.slug,
    },
  );
  if (publicError)
    throw new Error("Falha ao consultar a projeção pública do catálogo.");
  assert(
    publicProduct.length === 0,
    "O rascunho está aparecendo na projeção pública.",
  );

  return { dbProduct, variants, media };
}

async function workerPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

const queryReadMethods = Object.freeze([
  "containedBy",
  "contains",
  "eq",
  "filter",
  "gt",
  "gte",
  "ilike",
  "in",
  "is",
  "like",
  "limit",
  "lt",
  "lte",
  "match",
  "maybeSingle",
  "neq",
  "not",
  "or",
  "order",
  "overlaps",
  "range",
  "select",
  "single",
]);
const storageReadMethods = Object.freeze([
  "createSignedUrl",
  "createSignedUrls",
  "download",
  "exists",
  "getPublicUrl",
  "info",
  "list",
]);
function readOnlyCapabilityFacade(label, capabilities) {
  const emptyTarget = safeObjectCreate(null);
  const immutable = (operation, property) => {
    throw new Error(
      `${operation}${property === undefined ? "" : ` da propriedade ${String(property)}`} bloqueada durante dry-run na facade ${label}.`,
    );
  };
  return new SafeProxy(emptyTarget, {
    get(_target, property) {
      if (typeof property === "symbol") return undefined;
      if (!safeObjectHasOwn(capabilities, property)) {
        throw new Error(
          `${label}.${property} bloqueado: não é uma capacidade de leitura permitida no dry-run.`,
        );
      }
      return capabilities[property];
    },
    set(_target, property) {
      return immutable("Atribuição", property);
    },
    defineProperty(_target, property) {
      return immutable("Definição", property);
    },
    deleteProperty(_target, property) {
      return immutable("Remoção", property);
    },
    setPrototypeOf() {
      return immutable("Alteração do protótipo");
    },
    preventExtensions() {
      return immutable("Alteração de extensibilidade");
    },
  });
}

function readOnlyQueryFacade(builder) {
  const capabilities = safeObjectCreate(null);
  for (let index = 0; index < queryReadMethods.length; index += 1) {
    const method = queryReadMethods[index];
    capabilities[method] = (...args) => {
      const operation = safeReflectGet(builder, method, builder);
      if (typeof operation !== "function") {
        throw new Error(`Query builder não oferece leitura ${method}.`);
      }
      const result = safeReflectApply(operation, builder, args);
      return result === builder || (result && typeof result === "object")
        ? readOnlyQueryFacade(result)
        : result;
    };
  }
  capabilities.then = (resolve, reject) => {
    const then = safeReflectGet(builder, "then", builder);
    if (typeof then !== "function") {
      throw new Error("Query builder read-only não é awaitable.");
    }
    return safeReflectApply(then, builder, [resolve, reject]);
  };
  return readOnlyCapabilityFacade("query builder", capabilities);
}

function readOnlyStorageFacade(storage) {
  const capabilities = safeObjectCreate(null);
  capabilities.from = (bucketName) => {
    const bucket = safeReflectApply(storage.from, storage, [bucketName]);
    const bucketCapabilities = safeObjectCreate(null);
    for (let index = 0; index < storageReadMethods.length; index += 1) {
      const method = storageReadMethods[index];
      bucketCapabilities[method] = (...args) => {
        const operation = safeReflectGet(bucket, method, bucket);
        if (typeof operation !== "function") {
          throw new Error(`Storage bucket não oferece leitura ${method}.`);
        }
        return safeReflectApply(operation, bucket, args);
      };
    }
    return readOnlyCapabilityFacade("Storage bucket", bucketCapabilities);
  };
  return readOnlyCapabilityFacade("Storage", capabilities);
}

function readOnlyDatabaseFacade(client) {
  const capabilities = safeObjectCreate(null);
  capabilities.from = (table) =>
    readOnlyQueryFacade(safeReflectApply(client.from, client, [table]));
  capabilities.schema = (schemaName) =>
    readOnlyDatabaseFacade(
      safeReflectApply(client.schema, client, [schemaName]),
    );
  return readOnlyCapabilityFacade("Supabase database", capabilities);
}

export function guardReadOnlySupabase(supabase) {
  const capabilities = safeObjectCreate(null);
  capabilities.from = (table) =>
    readOnlyQueryFacade(safeReflectApply(supabase.from, supabase, [table]));
  capabilities.schema = (schemaName) =>
    readOnlyDatabaseFacade(
      safeReflectApply(supabase.schema, supabase, [schemaName]),
    );
  capabilities.storage = readOnlyStorageFacade(supabase.storage);
  return readOnlyCapabilityFacade("Supabase client", capabilities);
}

export async function runImport({
  args = parseArgs(process.argv.slice(2)),
  env = process.env,
  manifest: suppliedManifest,
  manifestLoader = loadManifest,
  supabase: suppliedSupabase,
  stdout = (value) => process.stdout.write(value),
} = {}) {
  const safeArgs = snapshotCliArguments(args);
  const phase = safeArgs.phase ?? "berlin";
  const applyFlags = ["apply-berlin", "apply-all"];
  for (let index = 0; index < applyFlags.length; index += 1) {
    const flag = applyFlags[index];
    assert(
      !safeObjectHasOwn(safeArgs, flag) || safeArgs[flag] === true,
      `--${flag} não aceita valor explícito; use a flag sem '=...' ou remova-a.`,
    );
  }
  const applyBerlin = safeArgs["apply-berlin"] === true;
  const applyAll = safeArgs["apply-all"] === true;
  const applyMode = applyBerlin || applyAll;

  assert(
    phase === "berlin" || phase === "all",
    "Use --phase=berlin ou --phase=all.",
  );
  assert(
    !(applyBerlin && applyAll),
    "Use apenas uma opção apply por execução.",
  );
  assert(
    !applyBerlin || phase === "berlin",
    "--apply-berlin exige --phase=berlin.",
  );
  assert(!applyAll || phase === "all", "--apply-all exige --phase=all.");
  if (phase === "all")
    assert(
      safeArgs["confirm-berlin-gate"] === "ADMIN_VISIBLE",
      "A fase dos outros produtos exige --confirm-berlin-gate=ADMIN_VISIBLE após validar todos os critérios do Berlim.",
    );

  const manifest =
    suppliedManifest ?? (await manifestLoader(safeArgs["manifest-dir"]));
  const berlinProducts = manifest.products.filter(
    (product) => product.sourceId === expectedBerlin.sourceId,
  );
  assert(
    berlinProducts.length === 1,
    "A fonte precisa conter exatamente um Berlim.",
  );
  const berlin = berlinProducts[0];
  assertBerlinSource(berlin);
  const selected =
    phase === "berlin"
      ? [berlin]
      : manifest.products.filter(
          (product) => product.sourceId !== expectedBerlin.sourceId,
        );
  const unguardedSupabase = suppliedSupabase ?? (await makeSupabaseClient(env));
  const supabase = applyMode
    ? unguardedSupabase
    : guardReadOnlySupabase(unguardedSupabase);
  const phaseCategories =
    phase === "berlin"
      ? manifest.categories.filter(
          (category) => slugify(category.slug) === "sofas",
        )
      : manifest.categories;
  const categoryMap = await ensureCategories(
    supabase,
    phaseCategories,
    !applyMode,
  );
  if (phase === "all") {
    const berlinCategory = categoryMap.get("sofas");
    assert(berlinCategory, "A categoria Sofás do Berlim não está disponível.");
    if (applyMode) {
      const idempotentResult = await callImport(
        supabase,
        berlinCategory.id,
        berlin,
      );
      assert(
        idempotentResult.already_imported,
        "O gate de idempotência do Berlim não passou.",
      );
      await cleanupFixtureObjects(
        supabase,
        berlin.sourceId,
        idempotentResult.cleanup_storage_paths,
      );
      await verifyProduct(supabase, berlin, berlinCategory.id);
    } else {
      await checkExistingProducts(supabase, [berlin], true);
      await checkExistingSkus(supabase, [berlin]);
    }
  }
  const existingProducts = await checkExistingProducts(
    supabase,
    selected,
    phase === "berlin",
  );
  await checkExistingSkus(supabase, selected);
  const missingCategories = phaseCategories.filter(
    (category) => !categoryMap.has(slugify(category.slug)),
  ).length;

  stdout(
    `${JSON.stringify({
      MODE: applyMode ? "APPLY" : "DRY_RUN",
      PHASE: phase.toUpperCase(),
      CATEGORIES_SOURCE: manifest.categories.length,
      CATEGORIES_EXISTING: categoryMap.size,
      CATEGORIES_TO_CREATE: missingCategories,
      PRODUCTS_SOURCE: manifest.products.length,
      PRODUCTS_IN_PHASE: selected.length,
      BERLIN_SOURCE_VARIANTS: berlin.variants.length,
      BERLIN_PRICES_CENTS: berlin.variants.map(
        (variant) => variant.price_cents,
      ),
      BERLIN_SKUS: berlin.variants.map((variant) => variant.sku),
      BERLIN_DIMENSIONS: berlin.variants.map(
        ({ width_mm, depth_mm, height_mm }) => ({
          width_mm,
          depth_mm,
          height_mm,
        }),
      ),
      SOURCE_EXPLICIT_VARIANTS: manifest.sourceVariantCount,
      GENERATED_SINGLE_VARIANTS: manifest.generatedSingleCount,
      SOURCE_IMAGES: manifest.sourceImageCount,
      SOURCE_MISSING_DIMENSIONS: manifest.dimensionMissing,
      GENERATED_SKUS_IN_PHASE: selected.reduce(
        (sum, product) => sum + product.variants.length,
        0,
      ),
      IMAGE_DOWNLOADS_IN_PHASE: selected.reduce(
        (sum, product) => sum + product.images.length,
        0,
      ),
      PRODUCTS_ALREADY_IN_DATABASE: existingProducts.length,
      BERLIN_IDEMPOTENCY_CHECK: applyMode
        ? "APPLY_RPC_CONFIRMED"
        : phase === "all"
          ? "SKIPPED_READ_ONLY"
          : "NOT_APPLICABLE",
      PUBLICATION:
        "all imported products remain DRAFT; new categories are inactive",
      PRESERVED_EXISTING_CUSTOMER_REFERENCES:
        "fixture product/first variant IDs retained; cart and reviews untouched",
    })}\n`,
  );
  if (!applyMode) return;

  assert(
    applyBerlin || applyAll,
    "Execução de escrita não autorizada; use o flag explícito da fase.",
  );
  assert(process.env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY ausente.");
  const liveCategories = await ensureCategories(
    supabase,
    phaseCategories,
    false,
  );
  let completed = 0;
  await workerPool(selected, phase === "berlin" ? 1 : 3, async (product) => {
    const category = liveCategories.get(product.categorySlug);
    assert(category, `Categoria local ausente para ${product.slug}.`);
    const uploadedThisRun = [];
    try {
      for (const image of product.images) {
        const bytes = await readSourceImage(image);
        const stored = await ensureStoredImage(supabase, image, bytes);
        if (stored.uploaded) uploadedThisRun.push(image.storage_path);
      }
      const result = await callImport(supabase, category.id, product);
      await cleanupFixtureObjects(
        supabase,
        product.sourceId,
        result.cleanup_storage_paths,
      );
      await verifyProduct(supabase, product, category.id);
      completed += 1;
      stdout(
        `${JSON.stringify({ PRODUCT: product.slug, RESULT: result.already_imported ? "IDEMPOTENT" : "IMPORTED", VERIFIED: "PASS", COMPLETED: completed })}\n`,
      );
      return result;
    } catch (error) {
      for (const storagePath of uploadedThisRun) {
        const { data: linked } = await supabase
          .from("product_media")
          .select("id")
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (!linked)
          await supabase.storage.from(bucketName).remove([storagePath]);
      }
      throw error;
    }
  });

  if (phase === "berlin") {
    const result = await callImport(
      supabase,
      liveCategories.get(berlin.categorySlug).id,
      berlin,
    );
    assert(
      result.already_imported,
      "A segunda gravação do Berlim não reconheceu idempotência.",
    );
    await cleanupFixtureObjects(
      supabase,
      berlin.sourceId,
      result.cleanup_storage_paths,
    );
    await verifyProduct(
      supabase,
      berlin,
      liveCategories.get(berlin.categorySlug).id,
    );
    stdout(
      `${JSON.stringify({ SECOND_RUN_IDEMPOTENT: "PASS", BERLIN_GATE_DATABASE: "PASS" })}\n`,
    );
  }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  runImport().catch((error) => {
    process.stderr.write(
      `IMPORT_STOPPED: ${error instanceof Error ? error.message : "erro inesperado"}\n`,
    );
    process.exitCode = 1;
  });
}
