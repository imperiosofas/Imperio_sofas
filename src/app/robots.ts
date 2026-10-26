import type { MetadataRoute } from "next";
import { resolveAppUrl } from "../lib/env/app-url.mjs";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveAppUrl();
  const allowIndexing = process.env.APP_ENV === "production";

  return {
    rules: {
      userAgent: "*",
      allow: allowIndexing ? "/" : undefined,
      disallow: allowIndexing ? ["/admin", "/conta", "/checkout"] : "/",
    },
    sitemap: allowIndexing ? new URL("/sitemap.xml", baseUrl).href : undefined,
  };
}
