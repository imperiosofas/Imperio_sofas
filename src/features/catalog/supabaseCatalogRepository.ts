import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CatalogCategory,
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
  width_mm: z.number().int().positive(),
  price_cents: z.number().int().positive(),
  sellable_units: z.number().int().positive(),
  media: z.array(
    z.object({
      storage_path: z.string().min(1),
      alt: z.string().min(1),
    }),
  ),
});

type ProductRow = z.infer<typeof productSchema>;

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
    sellableUnits: row.sellable_units,
    media,
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
