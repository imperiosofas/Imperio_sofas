import { normalizePostalCode } from "./cep-lookup.mjs";

export const SUPPLIER_CODES = ["VALE", "MUNDIAL"] as const;
export type SupplierCode = (typeof SUPPLIER_CODES)[number];
export type SupplierAssignment = SupplierCode | undefined;

export const LOGISTICS_MODES = ["pickup", "delivery"] as const;
export type LogisticsMode = (typeof LOGISTICS_MODES)[number];

const ALLOWED_MODES: Record<SupplierCode, readonly LogisticsMode[]> = {
  VALE: Object.freeze(["pickup", "delivery"]),
  MUNDIAL: Object.freeze(["delivery"]),
};
const NO_MODES: readonly LogisticsMode[] = Object.freeze([]);

export function isSupplierCode(value: unknown): value is SupplierCode {
  return SUPPLIER_CODES.some((supplierCode) => supplierCode === value);
}

export function isLogisticsMode(value: unknown): value is LogisticsMode {
  return LOGISTICS_MODES.some((mode) => mode === value);
}

export function getAllowedLogisticsModes(
  supplierCode: SupplierAssignment,
): readonly LogisticsMode[] {
  return isSupplierCode(supplierCode) ? ALLOWED_MODES[supplierCode] : NO_MODES;
}

export type SupplierModeValidation =
  | { valid: true; supplierCode: SupplierCode; mode: LogisticsMode }
  | {
      valid: false;
      reason:
        | "supplier_unassigned"
        | "invalid_supplier"
        | "invalid_mode"
        | "mode_not_supported";
    };

export function validateSupplierMode(
  supplierCode: unknown,
  mode: unknown,
): SupplierModeValidation {
  if (!isLogisticsMode(mode)) return { valid: false, reason: "invalid_mode" };
  if (supplierCode === undefined)
    return { valid: false, reason: "supplier_unassigned" };
  if (!isSupplierCode(supplierCode))
    return { valid: false, reason: "invalid_supplier" };
  if (!ALLOWED_MODES[supplierCode].includes(mode))
    return { valid: false, reason: "mode_not_supported" };

  return { valid: true, supplierCode, mode };
}

/** Accepts an eight-digit CEP, optionally formatted as 12345-678 or 12345 678. */
export function normalizeLogisticsPostalCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{5}(?:[- ]?)\d{3}$/.test(trimmed)) return null;
  return normalizePostalCode(trimmed.replace(" ", "-"));
}

export function isValidLogisticsPostalCode(value: unknown): value is string {
  return normalizeLogisticsPostalCode(value) !== null;
}

/** Floor 0 represents ground level; positive values are numbered floors. */
export function isValidDeliveryFloor(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export type FloorSurchargeResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: "invalid_floor" | "invalid_mode" | "amount_overflow" };

/** A delivery surcharge is per request/address, never per cart item. */
export function calculateFloorSurchargeCents(
  floor: unknown,
  mode: unknown,
): FloorSurchargeResult {
  if (!isLogisticsMode(mode)) return { ok: false, reason: "invalid_mode" };
  if (!isValidDeliveryFloor(floor))
    return { ok: false, reason: "invalid_floor" };
  if (mode === "pickup") return { ok: true, amountCents: 0 };

  const amountCents = Math.max(0, floor - 4) * 1_000;
  if (!Number.isSafeInteger(amountCents))
    return { ok: false, reason: "amount_overflow" };
  return { ok: true, amountCents };
}

export interface LogisticsLeadTime {
  minBusinessDays: number;
  maxBusinessDays: number;
  startsAfter: "payment_confirmed";
  label: string;
}

export function getLogisticsLeadTime(
  supplierCode: SupplierAssignment,
  mode: LogisticsMode,
): LogisticsLeadTime | null {
  const compatibility = validateSupplierMode(supplierCode, mode);
  if (!compatibility.valid) return null;

  if (supplierCode === "VALE" && mode === "pickup") {
    return {
      minBusinessDays: 7,
      maxBusinessDays: 7,
      startsAfter: "payment_confirmed",
      label:
        "Prazo informado para retirada: 7 dias úteis após a confirmação do pagamento; a data de liberação será confirmada pela loja.",
    };
  }

  if (supplierCode === "VALE") {
    return {
      minBusinessDays: 7,
      maxBusinessDays: 7,
      startsAfter: "payment_confirmed",
      label:
        "Prazo informado para entrega: 7 dias úteis após a confirmação do pagamento; a data exata não é garantida e o frete depende de cotação.",
    };
  }

  if (supplierCode === "MUNDIAL" && mode === "delivery") {
    return {
      minBusinessDays: 30,
      maxBusinessDays: 45,
      startsAfter: "payment_confirmed",
      label:
        "Prazo informado para entrega: de 30 a 45 dias úteis após a confirmação do pagamento; a data exata não é garantida e o frete é negociado antes da compra.",
    };
  }

  return null;
}

export interface LogisticsCartItem {
  variantKey: string;
  supplierCode: SupplierAssignment;
  mode: LogisticsMode;
  quantity: number;
}

export interface LogisticsSupplierGroup {
  supplierCode: SupplierCode;
  mode: LogisticsMode;
  variantKeys: string[];
  quantityTotal: number;
  leadTime: LogisticsLeadTime;
}

export type CartLogisticsResult =
  | {
      ok: true;
      groups: LogisticsSupplierGroup[];
      /** Applied once for this calculation's single request/address, not per group. */
      floorSurchargeCents: number;
    }
  | {
      ok: false;
      reason:
        | "empty_variant_key"
        | "invalid_quantity"
        | "supplier_unassigned"
        | "invalid_supplier"
        | "invalid_mode"
        | "mode_not_supported"
        | "invalid_floor"
        | "amount_overflow";
      variantKey?: string;
    };

/** Groups a cart for one request/address. Call separately for each distinct delivery address. */
export function calculateCartLogistics(
  items: readonly LogisticsCartItem[],
  floor?: unknown,
): CartLogisticsResult {
  const groups = new Map<
    string,
    {
      supplierCode: SupplierCode;
      mode: LogisticsMode;
      variantKeys: Set<string>;
      quantityTotal: number;
    }
  >();

  for (const item of items) {
    const variantKey =
      typeof item.variantKey === "string" ? item.variantKey.trim() : "";
    if (!variantKey) return { ok: false, reason: "empty_variant_key" };
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      return { ok: false, reason: "invalid_quantity", variantKey };

    const compatibility = validateSupplierMode(item.supplierCode, item.mode);
    if (!compatibility.valid)
      return { ok: false, reason: compatibility.reason, variantKey };

    const groupKey = `${compatibility.supplierCode}:${compatibility.mode}`;
    const group = groups.get(groupKey) ?? {
      supplierCode: compatibility.supplierCode,
      mode: compatibility.mode,
      variantKeys: new Set<string>(),
      quantityTotal: 0,
    };
    const quantityTotal = group.quantityTotal + item.quantity;
    if (!Number.isSafeInteger(quantityTotal))
      return { ok: false, reason: "invalid_quantity", variantKey };
    group.variantKeys.add(variantKey);
    group.quantityTotal = quantityTotal;
    groups.set(groupKey, group);
  }

  const hasDelivery = [...groups.values()].some(
    (group) => group.mode === "delivery",
  );
  let floorSurchargeCents = 0;
  if (hasDelivery) {
    const surcharge = calculateFloorSurchargeCents(floor, "delivery");
    if (!surcharge.ok)
      return {
        ok: false,
        reason:
          surcharge.reason === "amount_overflow"
            ? "amount_overflow"
            : "invalid_floor",
      };
    floorSurchargeCents = surcharge.amountCents;
  }

  const supplierOrder: Record<SupplierCode, number> = { VALE: 0, MUNDIAL: 1 };
  const modeOrder: Record<LogisticsMode, number> = { pickup: 0, delivery: 1 };
  const resultGroups = [...groups.values()]
    .sort(
      (left, right) =>
        supplierOrder[left.supplierCode] - supplierOrder[right.supplierCode] ||
        modeOrder[left.mode] - modeOrder[right.mode],
    )
    .map((group) => ({
      supplierCode: group.supplierCode,
      mode: group.mode,
      variantKeys: [...group.variantKeys].sort(),
      quantityTotal: group.quantityTotal,
      leadTime: getLogisticsLeadTime(group.supplierCode, group.mode)!,
    }));

  return { ok: true, groups: resultGroups, floorSurchargeCents };
}

export interface LogisticsFingerprintInput {
  items: readonly LogisticsCartItem[];
  /** Opaque server-derived address fingerprint; never pass raw address/PII. */
  destinationFingerprint?: string;
  floor?: number;
  /** Changes whenever a relevant delivery condition or negotiated quote changes. */
  conditionsRevision: string;
}

/**
 * Produces canonical comparison data, not a cryptographic signature or authorization token.
 * The server must independently validate the cart, address, and quote before checkout.
 */
export function createLogisticsFingerprint(
  input: LogisticsFingerprintInput,
): string {
  if (!input.conditionsRevision.trim())
    throw new TypeError("conditionsRevision is required");
  if (input.items.length === 0)
    throw new TypeError("at least one logistics item is required");

  const canonicalItems = input.items.map((item) => {
    const variantKey =
      typeof item.variantKey === "string" ? item.variantKey.trim() : "";
    if (!variantKey) throw new TypeError("variantKey is required");
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
      throw new TypeError("quantity must be a positive safe integer");

    const compatibility = validateSupplierMode(item.supplierCode, item.mode);
    if (!compatibility.valid)
      throw new TypeError(
        `invalid logistics selection: ${compatibility.reason}`,
      );

    return {
      variantKey,
      supplierCode: compatibility.supplierCode,
      mode: compatibility.mode,
      quantity: item.quantity,
    };
  });

  canonicalItems.sort((left, right) => {
    const leftKey = JSON.stringify(left);
    const rightKey = JSON.stringify(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  const hasDelivery = canonicalItems.some((item) => item.mode === "delivery");

  let deliveryConditions: {
    destinationFingerprint: string;
    floor: number;
  } | null = null;
  if (hasDelivery) {
    if (
      typeof input.destinationFingerprint !== "string" ||
      !input.destinationFingerprint.trim()
    )
      throw new TypeError("destinationFingerprint is required for delivery");
    if (!isValidDeliveryFloor(input.floor))
      throw new TypeError("a valid floor is required for delivery");
    deliveryConditions = {
      destinationFingerprint: input.destinationFingerprint,
      floor: input.floor,
    };
  }

  return JSON.stringify({
    version: 1,
    conditionsRevision: input.conditionsRevision,
    items: canonicalItems,
    deliveryConditions,
  });
}

export function isLogisticsQuoteCurrent(
  quotedFingerprint: unknown,
  current: LogisticsFingerprintInput,
): boolean {
  if (typeof quotedFingerprint !== "string") return false;
  try {
    return quotedFingerprint === createLogisticsFingerprint(current);
  } catch {
    return false;
  }
}
