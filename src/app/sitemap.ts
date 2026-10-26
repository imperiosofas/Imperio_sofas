import type { MetadataRoute } from "next";
import { resolveAppUrl } from "../lib/env/app-url.mjs";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = resolveAppUrl().href;

  return [{ url: baseUrl, changeFrequency: "weekly", priority: 1 }];
}
