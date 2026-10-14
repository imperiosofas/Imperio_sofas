import "server-only";

import { localCatalogRepository } from "./localCatalogRepository";
import { supabaseCatalogRepository } from "./supabaseCatalogRepository";
import type { CatalogRepository } from "./types";
import { resolveRuntimeConfig } from "../../lib/env/runtime-config.mjs";

export function getCatalogRepository(): CatalogRepository {
  const { catalogSource } = resolveRuntimeConfig(process.env);

  if (catalogSource === "local") return localCatalogRepository;

  // The server-only client is created lazily on the first database operation.
  return supabaseCatalogRepository;
}
