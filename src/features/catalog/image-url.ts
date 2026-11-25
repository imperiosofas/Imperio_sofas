/**
 * Catalog photos stay in the PRIVATE `catalog-images` bucket. The storefront
 * reads them through `/media/catalog/<storage path>`, a route on this domain
 * that downloads with the anonymous key, so the existing storage policy
 * ("published catalog images are readable") decides what can be served: draft,
 * unpublished or out-of-catalog photos get a 404. The URL never changes for a
 * given photo, so the Vercel CDN, the browser and the Next.js image optimizer
 * can cache it.
 *
 * Maximum exposure after a product is unpublished: the route response is
 * cached for CATALOG_IMAGE_CACHE_SECONDS at the CDN, and the optimizer caches
 * its resized copy for the same time (next.config.ts `minimumCacheTTL`), so a
 * resized photo can still be served for at most 2 × 30 min = 60 min. After
 * that every request goes back to Supabase and gets a 404. Browsers that
 * already downloaded the photo keep their own copy for up to 30 min.
 */
export const CATALOG_IMAGE_CACHE_SECONDS = 30 * 60;

export const CATALOG_IMAGE_PATH =
  /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

/** Stable storefront URL of a catalog photo, or null for an invalid path. */
export function catalogImageUrl(storagePath: string): string | null {
  if (!CATALOG_IMAGE_PATH.test(storagePath)) return null;
  return `/media/catalog/${storagePath}`;
}
