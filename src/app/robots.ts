import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const allowIndexing = process.env.APP_ENV === "production";

  return {
    rules: {
      userAgent: "*",
      allow: allowIndexing ? "/" : undefined,
      disallow: allowIndexing ? ["/admin", "/conta", "/checkout"] : "/",
    },
    sitemap: allowIndexing ? `${baseUrl}/sitemap.xml` : undefined,
  };
}
