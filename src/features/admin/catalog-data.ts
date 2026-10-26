import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  is_active: z.boolean(),
});

const productSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.enum(["draft", "active", "archived"]),
  free_shipping: z.boolean(),
  updated_at: z.string(),
  categories: z.object({ name: z.string(), slug: z.string() }).nullable(),
  product_variants: z.array(
    z.object({
      id: z.string().uuid(),
      sku: z.string().nullable(),
      price_cents: z.number().nullable(),
      width_mm: z.number().nullable(),
      depth_mm: z.number().nullable(),
      height_mm: z.number().nullable(),
      fabric: z.string().nullable(),
      color: z.string().nullable(),
      is_active: z.boolean(),
      inventory: z
        .object({
          on_hand: z.number(),
          reserved: z.number(),
          low_stock_threshold: z.number(),
        })
        .nullable(),
    }),
  ),
  product_media: z.array(
    z.object({
      id: z.string().uuid(),
      storage_path: z.string(),
      alt_text: z.string(),
      position: z.number(),
    }),
  ),
});

export type AdminCategory = z.infer<typeof categorySchema>;
export type AdminProduct = z.infer<typeof productSchema>;

const adminProductPageSchema = z.object({
  products: z.array(productSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    drafts: z.number().int().nonnegative(),
    low_stock: z.number().int().nonnegative(),
    out_of_stock: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
});

export type AdminProductPage = z.infer<typeof adminProductPageSchema>;

export async function listAdminProductsPage(
  supabase: SupabaseClient,
  params: {
    query: string;
    categoryId: string | null;
    status: string;
    stock: string;
    pending: string;
    sort: string;
    page: number;
    pageSize: number;
  },
) {
  const { data, error } = await supabase.rpc("admin_list_catalog_products", {
    p_query: params.query || null,
    p_category_id: params.categoryId,
    p_status: params.status,
    p_stock: params.stock,
    p_pending: params.pending,
    p_sort: params.sort,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  if (error) throw new Error("Não foi possível carregar os produtos.");
  return adminProductPageSchema.parse(data);
}

export async function listAdminCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,is_active")
    .order("position")
    .order("name");
  if (error) throw new Error("Não foi possível carregar as categorias.");
  return z.array(categorySchema).parse(data);
}

export async function getAdminProduct(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,category_id,name,slug,description,status,free_shipping,updated_at,categories(name,slug),product_variants(id,sku,price_cents,width_mm,depth_mm,height_mm,fabric,color,is_active,inventory(on_hand,reserved,low_stock_threshold)),product_media(id,storage_path,alt_text,position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o produto.");
  return data ? productSchema.parse(data) : null;
}
