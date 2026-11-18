import "server-only";

import { z } from "zod";
import { resolveAppUrl } from "../../lib/env/app-url.mjs";
import { createSupabaseServiceClient } from "../../lib/supabase/service";
import { COMPANY } from "../legal/content";
import {
  buildOrderEmail,
  type OrderEmailData,
  type OrderEmailKind,
} from "./order-email-content";

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Império Sofás <pedidos@imperiosofas.com.br>";

const row = z.object({
  id: z.string().uuid(),
  order_number: z.number(),
  customer_email: z.string().nullable(),
  customer_name: z.string().nullable(),
  items_subtotal_cents: z.number(),
  freight_cents: z.number(),
  floor_charge_cents: z.number(),
  total_cents: z.number(),
  payment_expires_at: z.string(),
  paid_at: z.string().nullable(),
  delivery_street: z.string().nullable(),
  delivery_number: z.string().nullable(),
  delivery_complement: z.string().nullable(),
  delivery_neighborhood: z.string().nullable(),
  delivery_city: z.string().nullable(),
  delivery_state: z.string().nullable(),
  delivery_postal_code: z.string().nullable(),
  delivery_floor: z.number().nullable(),
  terms_version: z.string().nullable(),
  withdrawal_requested_at: z.string().nullable(),
  withdrawal_reason: z.string().nullable(),
  order_groups: z.array(
    z.object({
      supplier_name: z.string(),
      fulfillment_mode: z.enum(["delivery", "pickup"]),
      pickup_label: z.string().nullable(),
      lead_min_business_days: z.number().nullable(),
      lead_max_business_days: z.number().nullable(),
      order_items: z.array(
        z.object({
          product_name: z.string(),
          quantity: z.number(),
          unit_price_cents: z.number(),
          line_total_cents: z.number(),
        }),
      ),
    }),
  ),
});

function address(o: z.infer<typeof row>) {
  if (!o.delivery_street) return null;
  return [
    `${o.delivery_street}, ${o.delivery_number ?? "s/n"}`,
    o.delivery_complement,
    o.delivery_neighborhood,
    `${o.delivery_city ?? ""}/${o.delivery_state ?? ""}`,
    o.delivery_postal_code ? `CEP ${o.delivery_postal_code}` : null,
    o.delivery_floor !== null ? `${o.delivery_floor}º andar` : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function toEmailData(o: z.infer<typeof row>): OrderEmailData {
  return {
    id: o.id,
    number: o.order_number,
    customerName: o.customer_name,
    itemsCents: o.items_subtotal_cents,
    freightCents: o.freight_cents,
    floorCents: o.floor_charge_cents,
    totalCents: o.total_cents,
    paymentExpiresAt: o.payment_expires_at,
    paidAt: o.paid_at,
    deliveryAddress: address(o),
    termsVersion: o.terms_version,
    withdrawalRequestedAt: o.withdrawal_requested_at,
    withdrawalReason: o.withdrawal_reason,
    groups: o.order_groups.map((g) => ({
      supplierName: g.supplier_name,
      mode: g.fulfillment_mode,
      pickupLabel: g.pickup_label,
      leadMin: g.lead_min_business_days,
      leadMax: g.lead_max_business_days,
      items: g.order_items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unitCents: i.unit_price_cents,
        lineCents: i.line_total_cents,
      })),
    })),
  };
}

/**
 * Sends one transactional e-mail about an order. Best effort: it never throws
 * and never blocks checkout or payment. Resend's Idempotency-Key makes a
 * repeated call (webhook retry, double click) deliver at most one message per
 * order and kind. Store copy goes to STORE_NOTIFY_EMAIL (default: COMPANY).
 */
export async function sendOrderEmail(
  orderId: string,
  kind: OrderEmailKind,
): Promise<"sent" | "skipped" | "failed"> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("order-email: RESEND_API_KEY not set, skipped", { kind });
    return "skipped";
  }
  try {
    const service = createSupabaseServiceClient();
    if (!service) return "skipped";
    const { data, error } = await service
      .from("orders")
      .select(
        `id, order_number, customer_email, customer_name, items_subtotal_cents,
         freight_cents, floor_charge_cents, total_cents, payment_expires_at,
         paid_at, delivery_street, delivery_number, delivery_complement,
         delivery_neighborhood, delivery_city, delivery_state,
         delivery_postal_code, delivery_floor, terms_version,
         withdrawal_requested_at, withdrawal_reason,
         order_groups (supplier_name, fulfillment_mode, pickup_label,
           lead_min_business_days, lead_max_business_days,
           order_items (product_name, quantity, unit_price_cents, line_total_cents))`,
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) {
      console.error("order-email: order not loaded", {
        kind,
        code: error?.code,
      });
      return "failed";
    }
    const order = row.parse(data);
    if (!order.customer_email) return "skipped";

    const email = buildOrderEmail(
      kind,
      toEmailData(order),
      COMPANY,
      resolveAppUrl(process.env).toString(),
    );
    const storeCopy = process.env.STORE_NOTIFY_EMAIL ?? COMPANY.email;
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `order-${kind}-${order.id}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [order.customer_email],
        // The store is copied on payments and withdrawals, which need action.
        bcc: kind === "created" ? undefined : [storeCopy],
        reply_to: COMPANY.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("order-email: provider rejected", {
        kind,
        status: response.status,
      });
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("order-email: unexpected failure", {
      kind,
      message: error instanceof Error ? error.message : "unknown",
    });
    return "failed";
  }
}
