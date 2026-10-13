import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CatalogCategory,
  CatalogListing,
  CatalogListingFilters,
  CatalogProduct,
  CatalogRepository,
} from "./types";

const categorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});

const productSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  category_slug: z.string().min(1),
  description: z.string(),
  width_mm: z.number().int().positive().nullable(),
  price_cents: z.number().int().positive(),
  stock_status: z.enum(["available", "low_stock", "unavailable"]),
  media: z.array(
    z.object({
      storage_path: z.string().min(1),
      alt: z.string().min(1),
    }),
  ),
});

type ProductRow = z.infer<typeof productSchema>;

const listingProductSchema = productSchema.extend({
  widths_mm: z.array(z.number().int().positive()),
  price_count: z.number().int().positive(),
  max_price_cents: z.number().int().positive(),
});
const listingSchema = z.object({
  total: z.number().int().nonnegative(),
  widths: z.array(
    z.object({
      width_mm: z.number().int().positive(),
      count: z.number().int().nonnegative(),
    }),
  ),
  products: z.array(listingProductSchema),
});

let supabaseClient: SupabaseClient | undefined;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "O catálogo Supabase está selecionado, mas falta configuração.",
    );
  }

  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

async function toCatalogProduct(row: ProductRow): Promise<CatalogProduct> {
  const client = getSupabaseClient();
  const media = await Promise.all(
    row.media.map(async ({ storage_path, alt }) => {
      const { data, error } = await client.storage
        .from("catalog-images")
        .createSignedUrl(storage_path, 15 * 60);
      if (error || !data?.signedUrl) {
        throw new Error("Não foi possível carregar as imagens do produto.");
      }
      return { src: data.signedUrl, alt };
    }),
  );

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categorySlug: row.category_slug,
    description: row.description,
    widthMm: row.width_mm,
    status: "active",
    priceCents: row.price_cents,
    stockStatus: row.stock_status,
    media,
  };
}

async function toListing(
  data: z.infer<typeof listingSchema>,
): Promise<CatalogListing> {
  const paths = [
    ...new Set(
      data.products.flatMap((product) =>
        product.media.map((item) => item.storage_path),
      ),
    ),
  ];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls, error } = await getSupabaseClient()
      .storage.from("catalog-images")
      .createSignedUrls(paths, 15 * 60);
    if (error || !urls || urls.some((item) => item.error || !item.signedUrl)) {
      throw new Error("Não foi possível carregar as imagens dos produtos.");
    }
    urls.forEach((item, index) => signed.set(paths[index], item.signedUrl!));
  }
  return {
    total: data.total,
    widths: data.widths.map((item) => ({
      widthMm: item.width_mm,
      count: item.count,
    })),
    products: data.products.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      categorySlug: row.category_slug,
      description: row.description,
      widthMm: row.width_mm,
      widthsMm: row.widths_mm,
      priceCount: row.price_count,
      maxPriceCents: row.max_price_cents,
      status: "active" as const,
      priceCents: row.price_cents,
      stockStatus: row.stock_status,
      media: row.media.map((item) => ({
        src: signed.get(item.storage_path)!,
        alt: item.alt,
      })),
    })),
  };
}

export const supabaseCatalogRepository: CatalogRepository = {
  async listCategories(): Promise<CatalogCategory[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "get_catalog_categories",
    );
    if (error) throw new Error("Não foi possível carregar as coleções.");
    return z.array(categorySchema).parse(data);
  },

  async listProducts(): Promise<CatalogProduct[]> {
    const { data, error } = await getSupabaseClient().rpc(
      "get_catalog_products",
      {
        p_category_slug: null,
        p_product_slug: null,
      },
    );
    if (error) throw new Error("Não foi possível carregar os produtos.");
    return Promise.all(
      z.array(productSchema).parse(data).map(toCatalogProduct),
    );
  },

  async listListing(filters: CatalogListingFilters): Promise<CatalogListing> {
    const { data, error } = await getSupabaseClient().rpc(
      "get_catalog_listing",
      {
        p_category_slug: filters.categorySlug ?? null,
        p_query: filters.query ?? null,
        p_min_price_cents: filters.minPriceCents ?? null,
        p_max_price_cents: filters.maxPriceCents ?? null,
        p_widths_mm: filters.widthsMm.length ? filters.widthsMm : null,
        p_sort: filters.sort,
        p_page: filters.page,
        p_page_size: 12,
      },
    );
    if (error) throw new Error("Não foi possível carregar a loja.");
    return toListing(listingSchema.parse(data));
  },

  async getProductBySlug(slug: string): Promise<CatalogProduct | null> {
    const { data, error } = await getSupabaseClient().rpc(
      "get_catalog_products",
      {
        p_category_slug: null,
        p_product_slug: slug,
      },
    );
    if (error) throw new Error("Não foi possível carregar o produto.");
    const products = z.array(productSchema).parse(data);
    return products[0] ? toCatalogProduct(products[0]) : null;
  },
};
