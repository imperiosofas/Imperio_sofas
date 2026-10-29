import { z } from "zod";

export const orderStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "cancelled",
  "expired",
  "refunded",
  "needs_review",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const groupStatusSchema = z.enum([
  "awaiting_payment",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
]);
export type GroupStatus = z.infer<typeof groupStatusSchema>;

const itemSchema = z.object({
  id: z.string().uuid(),
  product_name: z.string(),
  product_slug: z.string(),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().positive(),
  line_total_cents: z.number().int().positive(),
});

const groupSchema = z.object({
  id: z.string().uuid(),
  supplier_code: z.string(),
  supplier_name: z.string(),
  fulfillment_mode: z.enum(["delivery", "pickup"]),
  pickup_label: z.string().nullable(),
  base_freight_cents: z.number().int().nonnegative(),
  lead_min_business_days: z.number().int().nullable(),
  lead_max_business_days: z.number().int().nullable(),
  status: groupStatusSchema,
  order_items: z.array(itemSchema),
});

const paymentSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(["mock", "mercadopago"]),
  status: z.enum([
    "pending",
    "in_process",
    "approved",
    "rejected",
    "cancelled",
    "refunded",
  ]),
  checkout_url: z.string().nullable(),
  created_at: z.string(),
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  status: orderStatusSchema,
  items_subtotal_cents: z.number().int(),
  freight_cents: z.number().int(),
  floor_charge_cents: z.number().int(),
  total_cents: z.number().int(),
  delivery_postal_code: z.string().nullable(),
  delivery_street: z.string().nullable(),
  delivery_number: z.string().nullable(),
  delivery_complement: z.string().nullable(),
  delivery_neighborhood: z.string().nullable(),
  delivery_city: z.string().nullable(),
  delivery_state: z.string().nullable(),
  delivery_floor: z.number().int().nullable(),
  payment_expires_at: z.string(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  order_groups: z.array(groupSchema),
  order_payments: z.array(paymentSchema),
});
export type Order = z.infer<typeof orderSchema>;

export const orderStatusLabel: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
  needs_review: "Em análise",
};

export const groupStatusLabel: Record<GroupStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  preparing: "Em preparação",
  ready_for_pickup: "Pronto para retirada",
  out_for_delivery: "Em entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function leadTimeText(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null || max === null) return null;
  const range = min === max ? `${min}` : `${min} a ${max}`;
  return `${range} dias úteis após a confirmação do pagamento`;
}
