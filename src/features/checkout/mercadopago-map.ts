export type InternalPaymentStatus =
  "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded";

export function mapMercadoPagoStatus(
  status: string | null | undefined,
): InternalPaymentStatus | null {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "authorized":
    case "in_process":
    case "in_mediation":
      return "in_process";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return null;
  }
}

/** Converts a BRL decimal from the provider to integer cents without drift. */
export function reaisToCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Math.abs(amount * 100 - cents) < 0.0001 ? cents : null;
}

export type PreferenceOrder = {
  id: string;
  orderNumber: number;
  email: string | null;
  items: { name: string; quantity: number; unitPriceCents: number }[];
  freightCents: number;
  floorChargeCents: number;
  expiresAt: string;
};

export type PreferenceUrls = {
  notification: string;
  success: string;
  pending: string;
  failure: string;
};

/**
 * Builds the Checkout Pro preference. Freight and the floor charge are extra
 * line items, so the provider total is always the order total.
 */
export function buildPreference(order: PreferenceOrder, urls: PreferenceUrls) {
  const lines = order.items.map((item, index) => ({
    id: `item-${index + 1}`,
    title: item.name.slice(0, 120),
    quantity: item.quantity,
    unit_price: item.unitPriceCents / 100,
    currency_id: "BRL",
  }));
  if (order.freightCents > 0)
    lines.push({
      id: "freight",
      title: "Frete",
      quantity: 1,
      unit_price: order.freightCents / 100,
      currency_id: "BRL",
    });
  if (order.floorChargeCents > 0)
    lines.push({
      id: "floor-charge",
      title: "Adicional por andar",
      quantity: 1,
      unit_price: order.floorChargeCents / 100,
      currency_id: "BRL",
    });

  return {
    items: lines,
    ...(order.email ? { payer: { email: order.email } } : {}),
    external_reference: order.id,
    notification_url: urls.notification,
    back_urls: {
      success: urls.success,
      pending: urls.pending,
      failure: urls.failure,
    },
    auto_return: "approved",
    expires: true,
    expiration_date_to: order.expiresAt,
    statement_descriptor: "IMPERIO SOFAS",
    metadata: { order_id: order.id, order_number: order.orderNumber },
  };
}
