import "server-only";

import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import { getAdminAnalyticsSnapshot } from "../analytics-data";
import type { AdminAnalyticsSnapshot } from "../analytics-types";
import {
  engagementSummarySchema,
  type EngagementSummary,
} from "../engagement-types";
import { z } from "zod";
import { getAdminLogisticsOverview } from "../logistics/data";
import type { LogisticsOverview } from "../logistics/types";

const ordersSummarySchema = z.object({
  total: z.number(),
  pending_payment: z.number(),
  paid: z.number(),
  needs_review: z.number(),
  cancelled: z.number(),
  refunded: z.number(),
  paid_last_7_days: z.number(),
  revenue_cents: z.number(),
  average_ticket_cents: z.number(),
});
export type OrdersSummary = z.infer<typeof ordersSummarySchema>;

export type OverviewData = {
  snapshot: AdminAnalyticsSnapshot | null;
  engagement: EngagementSummary | null;
  logistics: LogisticsOverview | null;
  orders: OrdersSummary | null;
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

async function getOrders(): Promise<OrdersSummary | null> {
  try {
    const client = await requireCatalogAdmin("/admin");
    const { data, error } = await client.rpc("admin_get_orders_summary");
    if (error) return null;
    const parsed = ordersSummarySchema.safeParse(data);
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
  const [snapshot, engagement, logistics, orders] = await Promise.all([
    getSnapshot(),
    getEngagement(),
    getLogistics(),
    getOrders(),
  ]);
  return { snapshot, engagement, logistics, orders };
}
