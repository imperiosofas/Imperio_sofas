import type { AdminAnalyticsSnapshot } from "../analytics-types";

export type AnalyticsExportVariant = {
  id: string;
  sku: string | null;
  price_cents: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  fabric: string | null;
  color: string | null;
  is_active: boolean;
  inventory: {
    on_hand: number;
    reserved: number;
    low_stock_threshold: number;
  } | null;
};

export type AnalyticsExportProduct = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  categories: { name: string | null; slug: string | null } | null;
  product_variants: AnalyticsExportVariant[];
};

export function safeXlsxValue(value: unknown): unknown;

export function buildAnalyticsWorkbookBuffer(
  snapshot: AdminAnalyticsSnapshot,
  products: readonly AnalyticsExportProduct[],
  categoryFilter?: string | null,
): Promise<Buffer>;
