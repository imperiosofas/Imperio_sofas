import "server-only";

import { requireCatalogAdmin } from "../../lib/supabase/admin-access";
import {
  adminAnalyticsCategoryIdSchema,
  adminAnalyticsSnapshotSchema,
  type AdminAnalyticsSnapshotOptions,
  type AdminAnalyticsSnapshot,
} from "./analytics-types";

export async function getAdminAnalyticsSnapshot(
  options: AdminAnalyticsSnapshotOptions = {},
): Promise<AdminAnalyticsSnapshot> {
  const categoryId = adminAnalyticsCategoryIdSchema.safeParse(
    options.categoryId ?? null,
  );
  if (!categoryId.success) {
    throw new Error("A categoria selecionada é inválida.");
  }

  const supabase = await requireCatalogAdmin();
  let response;
  try {
    response = await supabase.rpc("admin_get_analytics_snapshot", {
      p_category_id: categoryId.data,
    });
  } catch {
    throw new Error("Não foi possível carregar os indicadores do catálogo.");
  }

  const { data, error } = response;

  if (error) {
    throw new Error("Não foi possível carregar os indicadores do catálogo.");
  }

  const snapshot = adminAnalyticsSnapshotSchema.safeParse(data);
  if (!snapshot.success) {
    throw new Error(
      "Os indicadores do catálogo retornaram um formato inválido.",
    );
  }

  return snapshot.data;
}
