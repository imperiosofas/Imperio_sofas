import "server-only";

import { z } from "zod";
import { localCatalogRepository } from "./localCatalogRepository";
import { supabaseCatalogRepository } from "./supabaseCatalogRepository";
import type { CatalogRepository } from "./types";

const catalogSourceSchema = z.enum(["local", "supabase"]);
const appEnvironmentSchema = z.enum(["local", "staging", "production"]);

export function getCatalogRepository(): CatalogRepository {
  const appEnv = appEnvironmentSchema.parse(process.env.APP_ENV ?? "local");
  const source = catalogSourceSchema.parse(
    process.env.CATALOG_SOURCE ?? (appEnv === "local" ? "local" : "supabase"),
  );

  if (appEnv !== "local" && source !== "supabase") {
    throw new Error("Staging e produção exigem o catálogo persistente.");
  }

  if (source === "local") return localCatalogRepository;

  // The server-only client is created lazily on the first database operation.
  return supabaseCatalogRepository;
}
