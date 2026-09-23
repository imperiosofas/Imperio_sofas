import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  return [{ url: baseUrl, changeFrequency: "weekly", priority: 1 }];
}
