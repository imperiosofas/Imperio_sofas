// Lets the proxy answer HTTP 404 for unknown product/category URLs before the
// page starts streaming. The product and category pages have a loading.tsx,
// so Next sends the 200 status with the loading skeleton before the page can
// call notFound(). Checking here keeps the skeleton for real pages and gives
// crawlers and monitors a real 404 for missing ones.
//
// It uses the same public RPCs the pages use (get_catalog_product_detail,
// get_catalog_categories), so the answer always matches what the page would
// render. Results are cached per server instance for a short time; any error
// lets the request through unchanged (the page still shows "não encontrado").

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { exists: boolean; at: number }>();

type Kind = "product" | "category";

export function catalogRouteTarget(
  pathname: string,
): { kind: Kind; slug: string } | null {
  const match = /^\/(produto|loja)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!slug || slug.length > 200) return null;
  return { kind: match[1] === "produto" ? "product" : "category", slug };
}

async function lookup(
  kind: Kind,
  slug: string,
  url: string,
  key: string,
): Promise<boolean | null> {
  const endpoint =
    kind === "product"
      ? "get_catalog_product_detail"
      : "get_catalog_categories";
  const response = await fetch(`${url}/rest/v1/rpc/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(kind === "product" ? { p_slug: slug } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  if (kind === "product") return data !== null && typeof data === "object";
  return (
    Array.isArray(data) &&
    data.some(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item as { slug?: unknown }).slug === slug,
    )
  );
}

/** true / false when known, null when the check could not be made. */
export async function catalogRouteExists(
  kind: Kind,
  slug: string,
  url: string,
  key: string,
): Promise<boolean | null> {
  const cacheKey = `${kind}:${slug}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;
  try {
    const exists = await lookup(kind, slug, url, key);
    if (exists === null) return null;
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(cacheKey, { exists, at: Date.now() });
    return exists;
  } catch {
    return null;
  }
}
