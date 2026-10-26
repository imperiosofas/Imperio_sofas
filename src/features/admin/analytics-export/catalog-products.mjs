import { z } from "zod";

export const ANALYTICS_EXPORT_PAGE_SIZE = 100;
export const ANALYTICS_EXPORT_MAX_PRODUCTS = 2000;
export const ANALYTICS_EXPORT_MAX_PAGES =
  ANALYTICS_EXPORT_MAX_PRODUCTS / ANALYTICS_EXPORT_PAGE_SIZE;
export const ANALYTICS_EXPORT_MAX_VARIANTS = 20000;

const nonnegativeInteger = z.number().int().nonnegative();
const nullableText = z.string().nullable();

const inventorySchema = z
  .object({
    on_hand: nonnegativeInteger,
    reserved: nonnegativeInteger,
    low_stock_threshold: nonnegativeInteger,
  })
  .nullable();

const variantSchema = z.object({
  id: z.string().uuid(),
  sku: nullableText,
  price_cents: nonnegativeInteger.nullable(),
  width_mm: nonnegativeInteger.nullable(),
  depth_mm: nonnegativeInteger.nullable(),
  height_mm: nonnegativeInteger.nullable(),
  fabric: nullableText,
  color: nullableText,
  is_active: z.boolean(),
  inventory: inventorySchema,
});

const productSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]),
  categories: z
    .object({ name: z.string().nullable(), slug: z.string().nullable() })
    .nullable(),
  product_variants: z.array(variantSchema),
});

const resultSchema = z.object({
  products: z.array(productSchema),
  total: nonnegativeInteger,
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  summary: z.object({
    total: nonnegativeInteger,
    published: nonnegativeInteger,
    drafts: nonnegativeInteger,
    low_stock: nonnegativeInteger,
    out_of_stock: nonnegativeInteger,
    pending: nonnegativeInteger,
  }),
});

export class AnalyticsExportLimitError extends Error {
  constructor() {
    super("O catálogo excede o limite seguro para uma única exportação.");
    this.name = "AnalyticsExportLimitError";
  }
}

export class AnalyticsExportDataError extends Error {
  constructor() {
    super("Os dados do catálogo não puderam ser validados para exportação.");
    this.name = "AnalyticsExportDataError";
  }
}

/**
 * Loads a stable, complete administrative catalog snapshot in bounded pages.
 * Parsing also drops description/media fields so they cannot flow to the XLSX.
 */
export async function fetchAnalyticsExportProducts(
  supabase,
  categoryId = null,
) {
  const products = [];
  const productIds = new Set();
  const productSlugs = new Set();
  let expectedTotal = null;
  let pageCount = 1;
  let variantCount = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    const { data, error } = await supabase.rpc("admin_list_catalog_products", {
      p_query: null,
      p_category_id: categoryId,
      p_status: "all",
      p_stock: "all",
      p_pending: "all",
      p_sort: "recent",
      p_page: page,
      p_page_size: ANALYTICS_EXPORT_PAGE_SIZE,
    });
    if (error) throw new AnalyticsExportDataError();

    const parsed = resultSchema.safeParse(data);
    if (!parsed.success) throw new AnalyticsExportDataError();
    const result = parsed.data;
    if (
      result.page !== page ||
      result.page_size !== ANALYTICS_EXPORT_PAGE_SIZE
    ) {
      throw new AnalyticsExportDataError();
    }

    if (expectedTotal === null) {
      expectedTotal = result.total;
      if (expectedTotal > ANALYTICS_EXPORT_MAX_PRODUCTS) {
        throw new AnalyticsExportLimitError();
      }
      pageCount = Math.max(
        1,
        Math.ceil(expectedTotal / ANALYTICS_EXPORT_PAGE_SIZE),
      );
      if (pageCount > ANALYTICS_EXPORT_MAX_PAGES) {
        throw new AnalyticsExportLimitError();
      }
    } else if (result.total !== expectedTotal) {
      throw new AnalyticsExportDataError();
    }

    const expectedPageRows = Math.min(
      ANALYTICS_EXPORT_PAGE_SIZE,
      Math.max(0, expectedTotal - (page - 1) * ANALYTICS_EXPORT_PAGE_SIZE),
    );
    if (result.products.length !== expectedPageRows) {
      throw new AnalyticsExportDataError();
    }

    for (const product of result.products) {
      if (productIds.has(product.id) || productSlugs.has(product.slug)) {
        throw new AnalyticsExportDataError();
      }
      variantCount += product.product_variants.length;
      if (variantCount > ANALYTICS_EXPORT_MAX_VARIANTS) {
        throw new AnalyticsExportLimitError();
      }
      productIds.add(product.id);
      productSlugs.add(product.slug);
      products.push(product);
    }
  }

  if (products.length !== expectedTotal) throw new AnalyticsExportDataError();
  return products;
}
