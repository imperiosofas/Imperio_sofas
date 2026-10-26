import "server-only";

import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import { getAdminAnalyticsSnapshot } from "../analytics-data";
import type { AdminAnalyticsSnapshot } from "../analytics-types";
import {
  engagementSummarySchema,
  type EngagementSummary,
} from "../engagement-types";
import { getAdminLogisticsOverview } from "../logistics/data";
import type { LogisticsOverview } from "../logistics/types";

export type OverviewData = {
  snapshot: AdminAnalyticsSnapshot | null;
  engagement: EngagementSummary | null;
  logistics: LogisticsOverview | null;
};

async function getEngagement(): Promise<EngagementSummary | null> {
  try {
    const client = await requireCatalogAdmin("/admin");
    const { data, error } = await client.rpc("admin_get_engagement_summary");
    if (error) return null;
    const parsed = engagementSummarySchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function getSnapshot(): Promise<AdminAnalyticsSnapshot | null> {
  try {
    return await getAdminAnalyticsSnapshot();
  } catch {
    return null;
  }
}

async function getLogistics(): Promise<LogisticsOverview | null> {
  try {
    const result = await getAdminLogisticsOverview();
    return result.status === "ready" ? result.data : null;
  } catch {
    return null;
  }
}

// Each source is optional: one failing RPC must not blank the whole page.
export async function getOverviewData(): Promise<OverviewData> {
  const [snapshot, engagement, logistics] = await Promise.all([
    getSnapshot(),
    getEngagement(),
    getLogistics(),
  ]);
  return { snapshot, engagement, logistics };
}
