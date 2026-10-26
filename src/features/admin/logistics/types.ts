export type LogisticsReadIssue =
  "rpc_missing" | "query_failed" | "shape_mismatch";

export type LogisticsLoadResult<T> =
  | { status: "ready"; data: T }
  | {
      status: "unavailable";
      reason: LogisticsReadIssue;
    };

export type LogisticsQuoteStatus =
  | "awaiting_quote"
  | "quoted"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "invalidated"
  | "expired";

export interface LogisticsSettings {
  floor_charge_cents: number;
  included_through_floor: number;
  quote_expiration_minutes: number | null;
  whatsapp_phone_e164: string | null;
  multi_delivery_policy_status: string;
}

export interface LogisticsOverview {
  supplier_count: number;
  active_supplier_count: number;
  product_count: number;
  unassigned_product_count: number;
  enabled_area_count: number;
  quote_counts: Partial<Record<LogisticsQuoteStatus, number>>;
  open_quote_count: number;
  settings: LogisticsSettings;
}

export interface LogisticsPickupLocation {
  pickup_location_id: string;
  location_code: string;
  display_name: string;
  street: string;
  street_number: string;
  neighborhood: string;
  postal_code: string;
  ibge_code: string;
  city_name: string;
  state_code: string;
  is_active: boolean;
}

export interface LogisticsSupplier {
  supplier_id: string;
  code: "VALE" | "MUNDIAL";
  display_name: string;
  is_active: boolean;
  allows_delivery: boolean;
  allows_pickup: boolean;
  lead_min_business_days: number;
  lead_max_business_days: number;
  lead_time_starts_on: string;
  delivery_quote_required: boolean;
  admin_notes: string | null;
  assigned_product_count: number;
  pickup_locations: LogisticsPickupLocation[];
}

export interface LogisticsArea {
  ibge_code: string;
  city_name: string;
  state_code: string;
  is_enabled: boolean;
  source: string;
  pickup_location_count: number;
}

export interface LogisticsVariant {
  variant_id: string;
  sku: string;
  fabric: string | null;
  color: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  attributes: Record<string, unknown>;
  price_cents: number;
  is_active: boolean;
  on_hand: number | null;
  reserved: number | null;
  low_stock_threshold: number | null;
}

export interface LogisticsProduct {
  product_id: string;
  name: string;
  slug: string;
  status: string;
  category_id: string;
  category_name: string;
  supplier_id: string | null;
  supplier_code: "VALE" | "MUNDIAL" | null;
  supplier_name: string | null;
  variant_count: number;
  active_variant_count: number;
}

export interface LogisticsQuoteItem {
  product_id: string;
  variant_id: string;
  quantity: number;
  product_name: string;
  variant: Record<string, unknown>;
  unit_price_cents_snapshot: number;
}

export interface LogisticsQuoteGroup {
  group_id: string;
  supplier_id: string;
  supplier_code: "VALE" | "MUNDIAL";
  fulfillment_mode: "delivery" | "pickup";
  pickup_location_id: string | null;
  status: "awaiting_quote" | "quoted" | "cancelled" | "invalidated";
  base_freight_cents: number | null;
  items: LogisticsQuoteItem[];
}

export interface LogisticsDeliveryAddress {
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  ibge_code: string;
  city_name: string;
  state_code: string;
  floor_number: number;
}

export interface LogisticsQuote {
  quote_id: string;
  status: LogisticsQuoteStatus;
  created_at: string;
  updated_at: string;
  quote_expires_at: string | null;
  delivery_address: LogisticsDeliveryAddress | null;
  floor_charge_cents: number;
  groups: LogisticsQuoteGroup[];
}

export type LogisticsPageSection =
  | "overview"
  | "requests"
  | "areas"
  | "suppliers"
  | "products"
  | "pickup"
  | "settings";
