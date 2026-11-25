import { createClient } from "@supabase/supabase-js";
import {
  CATALOG_IMAGE_CACHE_SECONDS,
  CATALOG_IMAGE_PATH,
} from "../../../../features/catalog/image-url";

// Serves published catalog photos from the private bucket at a stable URL.
// See features/catalog/image-url.ts for the access rule and the cache window.

const TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function sniff(bytes: Uint8Array): (typeof TYPES)[keyof typeof TYPES] | null {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return "image/webp";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  )
    return "image/png";
  return null;
}

// Not found / not allowed / not an image: never cached, so a product that is
// published later shows its photos right away.
const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const name = path.join("/");
  const match = CATALOG_IMAGE_PATH.exec(name);
  if (!match) return notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return notFound();

  // Anonymous client with no session: the storage policy for anon decides,
  // so only photos of published products can be downloaded.
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.storage
    .from("catalog-images")
    .download(name);
  if (error || !data) return notFound();

  const bytes = new Uint8Array(await data.arrayBuffer());
  const type = sniff(bytes);
  const expected = TYPES[match[1] as keyof typeof TYPES];
  if (!type || type !== expected) return notFound();

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": `public, max-age=${CATALOG_IMAGE_CACHE_SECONDS}, s-maxage=${CATALOG_IMAGE_CACHE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
