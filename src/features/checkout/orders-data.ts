import "server-only";

import { z } from "zod";
import { getVerifiedCustomerSession } from "../logistics/server-session";
import { orderSchema, type Order } from "./types";

const ORDER_SELECT = `
  id, order_number, status, items_subtotal_cents, freight_cents, floor_charge_cents,
  total_cents, delivery_postal_code, delivery_street, delivery_number,
  delivery_complement, delivery_neighborhood, delivery_city, delivery_state,
  delivery_floor, payment_expires_at, paid_at, created_at,
  order_groups (
    id, supplier_code, supplier_name, fulfillment_mode, pickup_label,
    base_freight_cents, lead_min_business_days, lead_max_business_days, status,
    order_items (id, product_name, product_slug, quantity, unit_price_cents, line_total_cents)
  ),
  order_payments (id, provider, status, checkout_url, created_at)
`;

export async function listMyOrders(): Promise<Order[] | null> {
  const session = await getVerifiedCustomerSession();
  if (!session) return null;
  const { data, error } = await session.client
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return null;
  const parsed = z.array(orderSchema).safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getMyOrder(id: string): Promise<Order | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const session = await getVerifiedCustomerSession();
  if (!session) return null;
  const { data, error } = await session.client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = orderSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
