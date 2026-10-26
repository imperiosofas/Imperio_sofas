import "server-only";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import type {
  LogisticsArea,
  LogisticsLoadResult,
  LogisticsOverview,
  LogisticsProduct,
  LogisticsQuote,
  LogisticsQuoteGroup,
  LogisticsQuoteItem,
  LogisticsSettings,
  LogisticsSupplier,
  LogisticsVariant,
} from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function parseSettings(value: unknown): LogisticsSettings | null {
  if (!isRecord(value)) return null;
  const {
    floor_charge_cents,
    included_through_floor,
    quote_expiration_minutes,
    whatsapp_phone_e164,
    multi_delivery_policy_status,
  } = value;
  if (
    !isNumber(floor_charge_cents) ||
    !isNumber(included_through_floor) ||
    !isNullableNumber(quote_expiration_minutes) ||
    !isNullableString(whatsapp_phone_e164) ||
    !isString(multi_delivery_policy_status)
  )
    return null;
  return {
    floor_charge_cents,
    included_through_floor,
    quote_expiration_minutes,
    whatsapp_phone_e164,
    multi_delivery_policy_status,
  };
}

function parseOverview(value: unknown): LogisticsOverview | null {
  if (!isRecord(value) || !isRecord(value.quote_counts)) return null;
  const {
    supplier_count,
    active_supplier_count,
    product_count,
    unassigned_product_count,
    enabled_area_count,
    quote_counts,
    open_quote_count,
  } = value;
  const settings = parseSettings(value.settings);
  if (
    !isNumber(supplier_count) ||
    !isNumber(active_supplier_count) ||
    !isNumber(product_count) ||
    !isNumber(unassigned_product_count) ||
    !isNumber(enabled_area_count) ||
    !isNumber(open_quote_count) ||
    !settings
  )
    return null;

  const parsedCounts: Record<string, number> = {};
  for (const [status, count] of Object.entries(quote_counts)) {
    if (!isNumber(count)) return null;
    parsedCounts[status] = count;
  }
  return {
    supplier_count,
    active_supplier_count,
    product_count,
    unassigned_product_count,
    enabled_area_count,
    quote_counts: parsedCounts,
    open_quote_count,
    settings,
  };
}

function parsePickupLocation(value: unknown) {
  if (!isRecord(value)) return null;
  const textFields = [
    "pickup_location_id",
    "location_code",
    "display_name",
    "street",
    "street_number",
    "neighborhood",
    "postal_code",
    "ibge_code",
    "city_name",
    "state_code",
  ] as const;
  if (
    textFields.some((key) => !isString(value[key])) ||
    !isBoolean(value.is_active)
  )
    return null;
  return {
    pickup_location_id: value.pickup_location_id as string,
    location_code: value.location_code as string,
    display_name: value.display_name as string,
    street: value.street as string,
    street_number: value.street_number as string,
    neighborhood: value.neighborhood as string,
    postal_code: value.postal_code as string,
    ibge_code: value.ibge_code as string,
    city_name: value.city_name as string,
    state_code: value.state_code as string,
    is_active: value.is_active as boolean,
  };
}

function parseSupplier(value: unknown): LogisticsSupplier | null {
  if (!isRecord(value)) return null;
  const {
    supplier_id,
    code,
    display_name,
    is_active,
    allows_delivery,
    allows_pickup,
    lead_min_business_days,
    lead_max_business_days,
    lead_time_starts_on,
    delivery_quote_required,
    admin_notes,
    assigned_product_count,
    pickup_locations,
  } = value;
  if (
    !isString(supplier_id) ||
    (code !== "VALE" && code !== "MUNDIAL") ||
    !isString(display_name) ||
    !isBoolean(is_active) ||
    !isBoolean(allows_delivery) ||
    !isBoolean(allows_pickup) ||
    !isNumber(lead_min_business_days) ||
    !isNumber(lead_max_business_days) ||
    !isString(lead_time_starts_on) ||
    !isBoolean(delivery_quote_required) ||
    !isNullableString(admin_notes) ||
    !isNumber(assigned_product_count) ||
    !Array.isArray(pickup_locations)
  )
    return null;
  const locations = pickup_locations.map(parsePickupLocation);
  if (locations.some((location) => location === null)) return null;
  return {
    supplier_id,
    code,
    display_name,
    is_active,
    allows_delivery,
    allows_pickup,
    lead_min_business_days,
    lead_max_business_days,
    lead_time_starts_on,
    delivery_quote_required,
    admin_notes,
    assigned_product_count,
    pickup_locations: locations,
  } as LogisticsSupplier;
}

function parseArea(value: unknown): LogisticsArea | null {
  if (
    !isRecord(value) ||
    !isString(value.ibge_code) ||
    !isString(value.city_name) ||
    !isString(value.state_code) ||
    !isBoolean(value.is_enabled) ||
    !isString(value.source) ||
    !isNumber(value.pickup_location_count)
  )
    return null;
  return {
    ibge_code: value.ibge_code,
    city_name: value.city_name,
    state_code: value.state_code,
    is_enabled: value.is_enabled,
    source: value.source,
    pickup_location_count: value.pickup_location_count,
  };
}

function parseVariant(value: unknown): LogisticsVariant | null {
  if (!isRecord(value)) return null;
  const {
    variant_id,
    sku,
    fabric,
    color,
    width_mm,
    depth_mm,
    height_mm,
    attributes,
    price_cents,
    is_active,
    on_hand,
    reserved,
    low_stock_threshold,
  } = value;
  if (
    !isString(variant_id) ||
    !isString(sku) ||
    !isNullableString(fabric) ||
    !isNullableString(color) ||
    !isNullableNumber(width_mm) ||
    !isNullableNumber(depth_mm) ||
    !isNullableNumber(height_mm) ||
    !isRecord(attributes) ||
    !isNumber(price_cents) ||
    !isBoolean(is_active) ||
    !isNullableNumber(on_hand) ||
    !isNullableNumber(reserved) ||
    !isNullableNumber(low_stock_threshold)
  )
    return null;
  return {
    variant_id,
    sku,
    fabric,
    color,
    width_mm,
    depth_mm,
    height_mm,
    attributes,
    price_cents,
    is_active,
    on_hand,
    reserved,
    low_stock_threshold,
  };
}

function parseProduct(value: unknown): LogisticsProduct | null {
  if (!isRecord(value) || !Array.isArray(value.variants)) return null;
  const variants = value.variants.map(parseVariant);
  if (
    variants.some((variant) => variant === null) ||
    !isString(value.product_id) ||
    !isString(value.name) ||
    !isString(value.slug) ||
    !isString(value.status) ||
    !isString(value.category_id) ||
    !isString(value.category_name) ||
    !isNullableString(value.supplier_id) ||
    !isNullableString(value.supplier_code) ||
    !isNullableString(value.supplier_name)
  )
    return null;
  if (
    value.supplier_code !== null &&
    value.supplier_code !== "VALE" &&
    value.supplier_code !== "MUNDIAL"
  )
    return null;
  return {
    product_id: value.product_id,
    name: value.name,
    slug: value.slug,
    status: value.status,
    category_id: value.category_id,
    category_name: value.category_name,
    supplier_id: value.supplier_id,
    supplier_code: value.supplier_code,
    supplier_name: value.supplier_name,
    variant_count: variants.length,
    active_variant_count: variants.filter((variant) => variant?.is_active)
      .length,
  } as LogisticsProduct;
}

function parseQuoteItem(value: unknown): LogisticsQuoteItem | null {
  if (
    !isRecord(value) ||
    !isString(value.product_id) ||
    !isString(value.variant_id) ||
    !isNumber(value.quantity) ||
    !isString(value.product_name) ||
    !isRecord(value.variant) ||
    !isNumber(value.unit_price_cents_snapshot)
  )
    return null;
  return {
    product_id: value.product_id,
    variant_id: value.variant_id,
    quantity: value.quantity,
    product_name: value.product_name,
    variant: value.variant,
    unit_price_cents_snapshot: value.unit_price_cents_snapshot,
  };
}

function parseQuoteGroup(value: unknown): LogisticsQuoteGroup | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items.map(parseQuoteItem);
  if (
    items.some((item) => item === null) ||
    !isString(value.group_id) ||
    !isString(value.supplier_id) ||
    (value.supplier_code !== "VALE" && value.supplier_code !== "MUNDIAL") ||
    (value.fulfillment_mode !== "delivery" &&
      value.fulfillment_mode !== "pickup") ||
    !isNullableString(value.pickup_location_id) ||
    !["awaiting_quote", "quoted", "cancelled", "invalidated"].includes(
      String(value.status),
    ) ||
    !isNullableNumber(value.base_freight_cents)
  )
    return null;
  return {
    group_id: value.group_id,
    supplier_id: value.supplier_id,
    supplier_code: value.supplier_code,
    fulfillment_mode: value.fulfillment_mode,
    pickup_location_id: value.pickup_location_id,
    status: value.status,
    base_freight_cents: value.base_freight_cents,
    items,
  } as LogisticsQuoteGroup;
}

function parseDeliveryAddress(value: unknown) {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isString(value.postal_code) ||
    !isString(value.street) ||
    !isString(value.number) ||
    !isNullableString(value.complement) ||
    !isString(value.neighborhood) ||
    !isString(value.ibge_code) ||
    !isString(value.city_name) ||
    !isString(value.state_code) ||
    !isNumber(value.floor_number)
  )
    return undefined;
  return {
    postal_code: value.postal_code,
    street: value.street,
    number: value.number,
    complement: value.complement,
    neighborhood: value.neighborhood,
    ibge_code: value.ibge_code,
    city_name: value.city_name,
    state_code: value.state_code,
    floor_number: value.floor_number,
  };
}

function parseQuote(value: unknown): LogisticsQuote | null {
  if (!isRecord(value) || !Array.isArray(value.groups)) return null;
  const groups = value.groups.map(parseQuoteGroup);
  const address = parseDeliveryAddress(value.delivery_address);
  if (
    groups.some((group) => group === null) ||
    address === undefined ||
    !isString(value.quote_id) ||
    ![
      "awaiting_quote",
      "quoted",
      "accepted",
      "rejected",
      "cancelled",
      "invalidated",
      "expired",
    ].includes(String(value.status)) ||
    !isString(value.created_at) ||
    !isString(value.updated_at) ||
    !isNullableString(value.quote_expires_at) ||
    !isNumber(value.floor_charge_cents)
  )
    return null;
  return {
    quote_id: value.quote_id as string,
    status: value.status as LogisticsQuote["status"],
    created_at: value.created_at as string,
    updated_at: value.updated_at as string,
    quote_expires_at: value.quote_expires_at as string | null,
    delivery_address: address,
    floor_charge_cents: value.floor_charge_cents as number,
    groups: groups as LogisticsQuoteGroup[],
  } as unknown as LogisticsQuote;
}

function getUnavailableReason(
  error: { code?: string } | null,
  invalidShape = false,
) {
  if (invalidShape) return "shape_mismatch" as const;
  if (error?.code === "PGRST202" || error?.code === "42883")
    return "rpc_missing" as const;
  return "query_failed" as const;
}

async function getRpc<T>(
  returnTo: string,
  name: string,
  args: Record<string, unknown> | undefined,
  parse: (value: unknown) => T | null,
): Promise<LogisticsLoadResult<T>> {
  const supabase = await requireCatalogAdmin(returnTo);
  const { data, error } = await supabase.rpc(name, args as never);
  if (error)
    return { status: "unavailable", reason: getUnavailableReason(error) };
  const parsed = parse(data);
  if (parsed === null)
    return { status: "unavailable", reason: getUnavailableReason(null, true) };
  return { status: "ready", data: parsed };
}

function parseList<T>(value: unknown, parseItem: (item: unknown) => T | null) {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseItem);
  return parsed.some((item) => item === null) ? null : (parsed as T[]);
}

export function getAdminLogisticsOverview() {
  return getRpc(
    "/admin/entregas",
    "admin_logistics_overview",
    undefined,
    parseOverview,
  );
}

export function getAdminLogisticsSuppliers() {
  return getRpc(
    "/admin/entregas/fornecedores",
    "admin_list_logistics_suppliers",
    undefined,
    (value) => parseList(value, parseSupplier),
  );
}

export function getAdminLogisticsProducts(query: string | null = null) {
  return getRpc(
    "/admin/entregas/produtos",
    "admin_list_logistics_products",
    { p_query: query },
    (value) => parseList(value, parseProduct),
  );
}

export function getAdminLogisticsAreas() {
  return getRpc(
    "/admin/entregas/areas",
    "admin_list_logistics_areas",
    undefined,
    (value) => parseList(value, parseArea),
  );
}

export function getAdminLogisticsQuotes(status: string | null = null) {
  return getRpc(
    "/admin/entregas/solicitacoes",
    "admin_list_logistics_quotes",
    { p_status: status },
    (value) => parseList(value, parseQuote),
  );
}
