import "server-only";

import { z } from "zod";

const idSchema = z.string().uuid();
const labelSchema = z.string().min(1);
const countSchema = z.number().int().nonnegative();

export const adminAnalyticsCategoryIdSchema = idSchema.nullable();

export type AdminAnalyticsSnapshotOptions = {
  categoryId?: string | null;
};

const summarySchema = z
  .object({
    products_total: countSchema,
    active_products: countSchema,
    draft_products: countSchema,
    archived_products: countSchema,
    categories_total: countSchema,
    active_variants: countSchema,
    low_stock_variants: countSchema,
    out_of_stock_variants: countSchema,
    available_units_total: countSchema,
  })
  .strict();

const categorySnapshotSchema = z
  .object({
    category_id: idSchema,
    category_name: labelSchema,
    product_count: countSchema,
    variants_total: countSchema,
    variants_in_stock: countSchema,
    low_stock_variants: countSchema,
    out_of_stock_variants: countSchema,
    available_units: countSchema,
  })
  .strict();

const attentionItemSchema = z
  .object({
    product_id: idSchema,
    product_name: labelSchema,
    slug: labelSchema,
    category_name: labelSchema,
    variant_id: idSchema,
    sku: labelSchema.nullable(),
    available_units: countSchema,
    low_stock_threshold: countSchema,
    is_low_stock: z.boolean(),
  })
  .strict();

const topInventoryProductSchema = z
  .object({
    product_id: idSchema,
    product_name: labelSchema,
    slug: labelSchema,
    category_name: labelSchema,
    available_units: countSchema,
    active_variant_count: countSchema,
  })
  .strict();

export const adminAnalyticsSnapshotSchema = z
  .object({
    snapshot_at: z.string().datetime({ offset: true }),
    summary: summarySchema,
    categories: z.array(categorySnapshotSchema),
    attention: z.array(attentionItemSchema),
    top_inventory_products: z.array(topInventoryProductSchema),
  })
  .strict();

export type AdminAnalyticsSnapshot = z.infer<
  typeof adminAnalyticsSnapshotSchema
>;
export type AdminAnalyticsSummary = AdminAnalyticsSnapshot["summary"];
export type AdminAnalyticsCategory =
  AdminAnalyticsSnapshot["categories"][number];
export type AdminAnalyticsAttentionItem =
  AdminAnalyticsSnapshot["attention"][number];
export type AdminAnalyticsTopInventoryProduct =
  AdminAnalyticsSnapshot["top_inventory_products"][number];
