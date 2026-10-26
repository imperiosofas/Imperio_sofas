import { handleAnalyticsExportGet } from "../../../../../features/admin/analytics-export/route-handler.mjs";
import { getAdminAnalyticsSnapshot } from "../../../../../features/admin/analytics-data";
import { requireCatalogAdmin } from "../../../../../lib/supabase/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleAnalyticsExportGet(request, {
    requireCatalogAdmin,
    getAdminAnalyticsSnapshot,
  });
}
