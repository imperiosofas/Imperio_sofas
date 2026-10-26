import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type {
  CartLogisticsPresentation,
  CartItemLogistics,
  DeliveryArea,
  FloorCharge,
  LogisticsMode,
  PickupLocation,
  PublicProductLogistics,
  SupplierCode,
} from "./types";

const supplierCode = z.enum(["VALE", "MUNDIAL"]).nullable();
const logisticsMode = z.enum(["pickup", "delivery"]);
const deliveryAreaSchema = z.object({
  ibge_code: z.string().regex(/^\d{7}$/),
  city_name: z.string().min(1),
  state_code: z.string().regex(/^[A-Z]{2}$/),
});
const floorChargeSchema = z.object({
  floor_charge_cents: z.number().int().nonnegative(),
  included_through_floor: z.number().int().nonnegative(),
  applied_once_per_quote_address: z.boolean(),
});
const publicProductLogisticsSchema = z.object({
  supplier_code: supplierCode,
  supplier_name: z.string().nullable(),
  supplier_active: z.boolean(),
  supplier_assigned: z.boolean(),
  fulfillment_modes: z.array(logisticsMode),
  lead_min_business_days: z.number().int().positive().nullable(),
  lead_max_business_days: z.number().int().positive().nullable(),
  delivery_quote_required: z.boolean().nullable(),
  delivery_areas: z.array(deliveryAreaSchema),
  pickup_locations: z.array(
    z.object({
      id: z.string().uuid(),
      display_name: z.string().min(1),
      street: z.string(),
      street_number: z.string(),
      neighborhood: z.string(),
      postal_code: z.string(),
      city_name: z.string(),
      state_code: z.string(),
    }),
  ),
  floor_charge: floorChargeSchema,
});
const cartLogisticsSchema = z.object({
  items: z.array(
    z.object({
      variant_id: z.string().uuid(),
      quantity: z.number().int().positive(),
      supplier_code: supplierCode,
      supplier_name: z.string().nullable(),
      supplier_assigned: z.boolean(),
      available_for_quote: z.boolean(),
      fulfillment_modes: z.array(logisticsMode),
    }),
  ),
  delivery_areas: z.array(deliveryAreaSchema),
  pickup_locations: z.array(
    z.object({
      id: z.string().uuid(),
      supplier_code: supplierCode,
      display_name: z.string().min(1),
      street: z.string(),
      street_number: z.string(),
      neighborhood: z.string(),
      postal_code: z.string(),
      city_name: z.string(),
      state_code: z.string(),
    }),
  ),
  floor_charge: floorChargeSchema,
  whatsapp_phone_e164: z.string().nullable().optional(),
  quote_expiration_minutes: z.number().int().positive().nullable().optional(),
});

export type CartLogisticsProjection = {
  items: {
    variantId: string;
    quantity: number;
    supplierCode: SupplierCode | null;
    supplierName: string | null;
    supplierAssigned: boolean;
    availableForQuote: boolean;
    fulfillmentModes: LogisticsMode[];
  }[];
  deliveryAreas: DeliveryArea[];
  pickupLocations: PickupLocation[];
  floorCharge: FloorCharge;
  whatsappPhoneE164: string | null;
};

function parseFloorCharge(
  value: z.infer<typeof floorChargeSchema>,
): FloorCharge {
  return {
    floorChargeCents: value.floor_charge_cents,
    includedThroughFloor: value.included_through_floor,
    appliedOncePerQuoteAddress: value.applied_once_per_quote_address,
  };
}

function parseDeliveryAreas(
  rows: z.infer<typeof deliveryAreaSchema>[],
): DeliveryArea[] {
  return rows.map((row) => ({
    ibgeCode: row.ibge_code,
    cityName: row.city_name,
    stateCode: row.state_code,
  }));
}

function parsePickupLocations(
  rows: z.infer<typeof cartLogisticsSchema>["pickup_locations"],
): PickupLocation[] {
  return rows.map((row) => ({
    id: row.id,
    supplierCode: row.supplier_code,
    displayName: row.display_name,
    street: row.street,
    streetNumber: row.street_number,
    neighborhood: row.neighborhood,
    postalCode: row.postal_code,
    cityName: row.city_name,
    stateCode: row.state_code,
  }));
}

export async function getPublicProductLogistics(
  slug: string,
): Promise<PublicProductLogistics | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;

  try {
    const { data, error } = await client.rpc("get_public_product_logistics", {
      p_slug: slug,
    });
    if (error || !data) return null;
    const parsed = publicProductLogisticsSchema.safeParse(data);
    if (!parsed.success) return null;
    const row = parsed.data;
    return {
      supplierCode: row.supplier_code,
      supplierName: row.supplier_name,
      supplierActive: row.supplier_active,
      supplierAssigned: row.supplier_assigned,
      fulfillmentModes: row.fulfillment_modes,
      minBusinessDays: row.lead_min_business_days,
      maxBusinessDays: row.lead_max_business_days,
      deliveryQuoteRequired: row.delivery_quote_required,
      deliveryAreas: parseDeliveryAreas(row.delivery_areas),
      pickupLocations: row.pickup_locations.map((location) => ({
        id: location.id,
        supplierCode: row.supplier_code,
        displayName: location.display_name,
        street: location.street,
        streetNumber: location.street_number,
        neighborhood: location.neighborhood,
        postalCode: location.postal_code,
        cityName: location.city_name,
        stateCode: location.state_code,
      })),
      floorCharge: parseFloorCharge(row.floor_charge),
    };
  } catch {
    return null;
  }
}

export async function getCartLogisticsProjection(
  client: SupabaseClient,
): Promise<CartLogisticsProjection | null> {
  try {
    const { data, error } = await client.rpc("get_my_cart_logistics");
    if (error || !data) return null;
    const parsed = cartLogisticsSchema.safeParse(data);
    if (!parsed.success) return null;
    const row = parsed.data;
    return {
      items: row.items.map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        supplierCode: item.supplier_code,
        supplierName: item.supplier_name,
        supplierAssigned: item.supplier_assigned,
        availableForQuote: item.available_for_quote,
        fulfillmentModes: item.fulfillment_modes,
      })),
      deliveryAreas: parseDeliveryAreas(row.delivery_areas),
      pickupLocations: parsePickupLocations(row.pickup_locations),
      floorCharge: parseFloorCharge(row.floor_charge),
      whatsappPhoneE164: row.whatsapp_phone_e164 ?? null,
    };
  } catch {
    return null;
  }
}

export function toCartLogisticsPresentation(
  projection: CartLogisticsProjection | null,
): CartLogisticsPresentation | null {
  if (!projection) return null;
  return {
    deliveryAreas: projection.deliveryAreas,
    pickupLocations: projection.pickupLocations,
    floorCharge: projection.floorCharge,
  };
}

export function toCartItemLogistics(
  projection: CartLogisticsProjection | null,
  variantId: string,
): CartItemLogistics | null {
  const item = projection?.items.find((row) => row.variantId === variantId);
  if (!item) return null;
  return {
    supplierCode: item.supplierCode,
    supplierName: item.supplierName,
    supplierAssigned: item.supplierAssigned,
    availableForQuote: item.availableForQuote,
    fulfillmentModes: item.fulfillmentModes,
  };
}
