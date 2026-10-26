import { z } from "zod";

// Shape returned by public.admin_get_engagement_summary(): aggregate counts
// only, never which customer saved or reviewed what.
export const engagementSummarySchema = z.object({
  reviews: z.object({
    total: z.number(),
    published: z.number(),
    hidden: z.number(),
    last_7_days: z.number(),
    average_rating: z.number(),
    distribution: z.object({
      "1": z.number(),
      "2": z.number(),
      "3": z.number(),
      "4": z.number(),
      "5": z.number(),
    }),
  }),
  favorites: z.object({
    total: z.number(),
    customers: z.number(),
    products: z.number(),
    last_7_days: z.number(),
  }),
  top_favorited: z.array(
    z.object({
      product_id: z.string(),
      name: z.string(),
      slug: z.string(),
      status: z.string(),
      favorites: z.number(),
      review_count: z.number(),
      average_rating: z.number().nullable(),
    }),
  ),
});

export type EngagementSummary = z.infer<typeof engagementSummarySchema>;
