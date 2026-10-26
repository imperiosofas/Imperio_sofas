import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsExportProduct } from "./workbook.mjs";

export const ANALYTICS_EXPORT_PAGE_SIZE: 100;
export const ANALYTICS_EXPORT_MAX_PRODUCTS: 2000;
export const ANALYTICS_EXPORT_MAX_PAGES: 20;
export const ANALYTICS_EXPORT_MAX_VARIANTS: 20000;

export class AnalyticsExportLimitError extends Error {}
export class AnalyticsExportDataError extends Error {}

export function fetchAnalyticsExportProducts(
  supabase: SupabaseClient,
  categoryId?: string | null,
): Promise<AnalyticsExportProduct[]>;
