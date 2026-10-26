import type { z } from "zod";
export const quoteRequestSchema: z.ZodType<{
  requestId: string;
  supplierModes: {
    supplierCode: "VALE" | "MUNDIAL";
    mode: "pickup" | "delivery";
    pickupLocationId: string | null;
  }[];
  address?: {
    postalCode: string;
    floor: number;
    number: string;
    complement: string;
  };
}>;
export const logisticsQuoteIdSchema: z.ZodString;
export const logisticsQuoteResponseSchema: z.ZodType<{
  quoteId: string;
  accept: boolean;
}>;
