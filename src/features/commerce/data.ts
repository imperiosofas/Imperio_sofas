import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { PublishedCatalogProduct } from "../catalog/types";

const variant = z.object({
  id: z.string().uuid(),
  width_mm: z.number().int().positive().nullable(),
  depth_mm: z.number().int().positive().nullable(),
  height_mm: z.number().int().positive().nullable(),
  fabric: z.string().nullable(),
  color: z.string().nullable(),
  price_cents: z.number().int().positive(),
  available: z.number().int().positive(),
});
const detail = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category_slug: z.string(),
  variants: z.array(variant).min(1),
  media: z.array(
    z.object({
      storage_path: z.string(),
      alt: z.string(),
      variant_id: z.string().uuid().nullable(),
    }),
  ),
});
const review = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  display_name: z.string(),
  created_at: z.string(),
});
const summary = z.object({
  product_id: z.string().uuid(),
  review_count: z.number().int().nonnegative(),
  average_rating: z.number(),
});
const cartItem = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  product_id: z.string().uuid(),
  product_slug: z.string(),
  name: z.string(),
  width_mm: z.number().int().positive().nullable(),
  price_cents: z.number().int().positive(),
  available: z.number().int().nonnegative(),
  storage_path: z.string().nullable(),
});
const favoriteProduct = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  category_slug: z.string(),
  description: z.string(),
  width_mm: z.number().int().positive().nullable(),
  price_cents: z.number().int().positive(),
  sellable_units: z.number().int().positive(),
  media: z.array(z.object({ storage_path: z.string(), alt: z.string() })),
});
export type ProductDetail = z.infer<typeof detail> & {
  images: { src: string; alt: string; variantId: string | null }[];
};
export type ProductReview = z.infer<typeof review>;
export type ReviewSummary = z.infer<typeof summary>;
export type CartItem = z.infer<typeof cartItem> & { imageSrc: string | null };

export const getCommerceIdentity = cache(async () => {
  const client = await createSupabaseServerClient();
  if (!client) return { client: null, userId: null };
  const { data } = await client.auth.getClaims();
  return { client, userId: data?.claims?.sub ?? null };
});

export async function getReviewSummaries(productIds: string[]) {
  if (!productIds.length) return new Map<string, ReviewSummary>();
  const { client } = await getCommerceIdentity();
  if (!client) return new Map<string, ReviewSummary>();
  const { data, error } = await client.rpc("get_product_review_summary", {
    p_product_ids: productIds,
  });
  if (error) throw new Error("Não foi possível carregar as avaliações.");
  return new Map(
    z
      .array(summary)
      .parse(data)
      .map((row) => [row.product_id, row]),
  );
}

export async function getMyFavorites(productIds: string[]) {
  const { client, userId } = await getCommerceIdentity();
  if (!client || !userId || !productIds.length)
    return { userId, ids: new Set<string>() };
  const { data, error } = await client
    .from("product_favorites")
    .select("product_id")
    .eq("user_id", userId)
    .in("product_id", productIds);
  if (error) throw new Error("Não foi possível carregar os favoritos.");
  return {
    userId,
    ids: new Set((data ?? []).map((item) => item.product_id as string)),
  };
}

export async function getFavoriteProducts(): Promise<
  PublishedCatalogProduct[]
> {
  const { client, userId } = await getCommerceIdentity();
  if (!client || !userId) return [];
  const { data, error } = await client.rpc("get_my_favorite_products");
  if (error) throw new Error("Não foi possível carregar seus favoritos.");
  const rows = z.array(favoriteProduct).parse(data);
  const paths = [
    ...new Set(
      rows.flatMap((row) => row.media.map((item) => item.storage_path)),
    ),
  ];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls, error: imageError } = await client.storage
      .from("catalog-images")
      .createSignedUrls(paths, 15 * 60);
    if (imageError || !urls || urls.some((url) => url.error || !url.signedUrl))
      throw new Error("Não foi possível carregar as fotos dos favoritos.");
    urls.forEach((url, index) => signed.set(paths[index], url.signedUrl!));
  }
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    categorySlug: row.category_slug,
    description: row.description,
    widthMm: row.width_mm,
    status: "active" as const,
    priceCents: row.price_cents,
    sellableUnits: row.sellable_units,
    media: row.media.map((item) => ({
      src: signed.get(item.storage_path)!,
      alt: item.alt,
    })),
  }));
}

export const getProductDetail = cache(async function getProductDetail(
  slug: string,
): Promise<ProductDetail | null> {
  const { client } = await getCommerceIdentity();
  if (!client) return null;
  const { data, error } = await client.rpc("get_catalog_product_detail", {
    p_slug: slug,
  });
  if (error) throw new Error("Não foi possível carregar o produto.");
  if (!data) return null;
  const row = detail.parse(data);
  const paths = [...new Set(row.media.map((item) => item.storage_path))];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls, error: imageError } = await client.storage
      .from("catalog-images")
      .createSignedUrls(paths, 15 * 60);
    if (imageError || !urls || urls.some((url) => url.error || !url.signedUrl))
      throw new Error("Não foi possível carregar as fotos do produto.");
    urls.forEach((url, index) => signed.set(paths[index], url.signedUrl!));
  }
  return {
    ...row,
    images: row.media.map((item) => ({
      src: signed.get(item.storage_path)!,
      alt: item.alt,
      variantId: item.variant_id,
    })),
  };
});

export async function getProductReviews(
  productId: string,
): Promise<ProductReview[]> {
  const { client } = await getCommerceIdentity();
  if (!client) return [];
  const { data, error } = await client.rpc("get_published_product_reviews", {
    p_product_id: productId,
  });
  if (error) throw new Error("Não foi possível carregar as avaliações.");
  return z.array(review).parse(data);
}

export async function getMyReviewId(productId: string): Promise<string | null> {
  const { client, userId } = await getCommerceIdentity();
  if (!client || !userId) return null;
  const { data } = await client
    .from("product_reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getMyCart(): Promise<CartItem[]> {
  const { client, userId } = await getCommerceIdentity();
  if (!client || !userId) return [];
  const { data, error } = await client.rpc("get_my_cart");
  if (error) throw new Error("Não foi possível carregar o carrinho.");
  const rows = z.array(cartItem).parse(data);
  const paths = [
    ...new Set(
      rows
        .filter((row) => row.available > 0)
        .map((row) => row.storage_path)
        .filter((path): path is string => !!path),
    ),
  ];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await client.storage
      .from("catalog-images")
      .createSignedUrls(paths, 15 * 60);
    urls?.forEach((url, index) => {
      if (url.signedUrl) signed.set(paths[index], url.signedUrl);
    });
  }
  return rows.map((row) => ({
    ...row,
    imageSrc: row.storage_path ? (signed.get(row.storage_path) ?? null) : null,
  }));
}
