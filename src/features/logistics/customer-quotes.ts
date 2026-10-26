import "server-only";

import { z } from "zod";
import type { CustomerLogisticsQuote, LogisticsQuoteGroup } from "./types";

const quoteStatus = z.enum([
  "awaiting_quote",
  "quoted",
  "accepted",
  "rejected",
  "cancelled",
  "invalidated",
  "expired",
]);
const groupStatus = z.enum([
  "awaiting_quote",
  "quoted",
  "cancelled",
  "invalidated",
]);
const supplierCode = z.enum(["VALE", "MUNDIAL"]);
const fulfillmentMode = z.enum(["pickup", "delivery"]);

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function normalizeGroup(value: unknown): LogisticsQuoteGroup | null {
  const row = record(value);
  if (!row) return null;
  const code = supplierCode.safeParse(
    firstValue(row, ["supplier_code_snapshot", "supplier_code"]),
  );
  const mode = fulfillmentMode.safeParse(
    firstValue(row, ["fulfillment_mode", "mode"]),
  );
  const status = groupStatus.safeParse(row.status ?? "awaiting_quote");
  const id = z.string().uuid().safeParse(row.id);
  if (!code.success || !mode.success || !status.success) return null;

  const rawItems = firstValue(row, ["items", "quote_items"]);
  const items = Array.isArray(rawItems)
    ? rawItems.flatMap((value) => {
        const item = record(value);
        if (!item) return [];
        const quantity = nullableInteger(item.quantity);
        const productName = nullableString(
          firstValue(item, ["product_name_snapshot", "product_name", "name"]),
        );
        return quantity && quantity > 0 && productName
          ? [{ productName, quantity }]
          : [];
      })
    : [];

  return {
    ...(id.success ? { id: id.data } : {}),
    supplierCode: code.data,
    mode: mode.data,
    status: status.data,
    baseFreightCents: nullableInteger(
      firstValue(row, ["base_freight_cents", "freight_cents"]),
    ),
    items,
  };
}

export function normalizeCustomerLogisticsQuote(
  value: unknown,
): CustomerLogisticsQuote | null {
  let row = record(value);
  if (row && row.quote) row = record(row.quote);
  if (!row) return null;

  const id = z
    .string()
    .uuid()
    .safeParse(firstValue(row, ["id", "quote_id"]));
  const status = quoteStatus.safeParse(row.status);
  const createdAt = nullableString(
    firstValue(row, ["created_at", "createdAt"]),
  );
  if (!id.success || !status.success || !createdAt) return null;

  const rawGroups = firstValue(row, ["groups", "quote_groups"]);
  const groups = Array.isArray(rawGroups) ? rawGroups.map(normalizeGroup) : [];
  if (groups.some((group) => group === null)) return null;

  const floorCharge = nullableInteger(
    firstValue(row, ["floor_charge_cents", "floorChargeCents"]),
  );
  const address = record(row.address);
  return {
    id: id.data,
    status: status.data,
    createdAt,
    cityName: nullableString(
      firstValue(row, ["delivery_city_name_snapshot", "city_name"]) ??
        address?.city_name,
    ),
    stateCode: nullableString(
      firstValue(row, ["delivery_state_code", "state_code"]) ??
        address?.state_code,
    ),
    postalCode: nullableString(
      firstValue(row, ["delivery_postal_code", "postal_code"]) ??
        address?.postal_code,
    ),
    floorNumber: nullableInteger(
      firstValue(row, ["delivery_floor_number", "floor_number"]) ??
        address?.floor_number,
    ),
    floorChargeCents:
      floorCharge !== null && floorCharge >= 0 ? floorCharge : 0,
    groups: groups as LogisticsQuoteGroup[],
  };
}

export function normalizeCustomerLogisticsQuoteList(
  value: unknown,
): CustomerLogisticsQuote[] | null {
  let rows: unknown;
  if (Array.isArray(value)) rows = value;
  else {
    const payload = record(value);
    rows = payload?.quotes;
  }
  if (!Array.isArray(rows)) return null;
  const normalized = rows.map(normalizeCustomerLogisticsQuote);
  if (normalized.some((quote) => quote === null)) return null;
  return normalized as CustomerLogisticsQuote[];
}
