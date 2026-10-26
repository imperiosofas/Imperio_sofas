import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAnalyticsSnapshot } from "../analytics-types";

export function handleAnalyticsExportGet(
  request: Request,
  dependencies: {
    requireCatalogAdmin: (returnTo?: string) => Promise<SupabaseClient>;
    getAdminAnalyticsSnapshot: (options: {
      categoryId?: string | null;
    }) => Promise<AdminAnalyticsSnapshot>;
  },
): Promise<Response>;
