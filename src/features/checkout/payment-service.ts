import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppUrl } from "../../lib/env/app-url.mjs";
import { resolveRuntimeConfig } from "../../lib/env/runtime-config.mjs";
import { createSupabaseServiceClient } from "../../lib/supabase/service";
import { buildPreference } from "./mercadopago-map";
import { createPreference } from "./mercadopago-client";
import { resolvePaymentConfig, type PaymentConfig } from "./payment-config";

export function getPaymentConfig(): PaymentConfig {
  try {
    const { appEnv } = resolveRuntimeConfig(process.env);
    return resolvePaymentConfig({ ...process.env, APP_ENV: appEnv });
  } catch {
    return { status: "disabled", reason: "invalid_app_env" };
  }
}

export type StartPaymentResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code: "payments_disabled" | "order_unavailable" | "provider_error";
    };

type OrderForPayment = {
  id: string;
  order_number: number;
  status: string;
  freight_cents: number;
  floor_charge_cents: number;
  customer_email: string | null;
  payment_expires_at: string;
  order_items: {
    product_name: string;
    quantity: number;
    unit_price_cents: number;
  }[];
  order_payments: {
    provider: string;
    status: string;
    checkout_url: string | null;
  }[];
};

/**
 * Creates (or reuses) the payment attempt for a pending order. The browser
 * client reads the order under RLS; the attempt is recorded with the service
 * role. No amount is ever taken from the browser.
 */
export async function startOrderPayment(
  client: SupabaseClient,
  orderId: string,
): Promise<StartPaymentResult> {
  const config = getPaymentConfig();
  if (config.status !== "ready")
    return { ok: false, code: "payments_disabled" };

  const { data, error } = await client
    .from("orders")
    .select(
      `id, order_number, status, freight_cents, floor_charge_cents, customer_email,
       payment_expires_at,
       order_items (product_name, quantity, unit_price_cents),
       order_payments (provider, status, checkout_url)`,
    )
    .eq("id", orderId)
    .maybeSingle();
  const order = data as OrderForPayment | null;
  if (
    error ||
    !order ||
    order.status !== "pending_payment" ||
    new Date(order.payment_expires_at).getTime() <= Date.now()
  )
    return { ok: false, code: "order_unavailable" };

  const reusable = order.order_payments.find(
    (payment) =>
      payment.provider === config.provider &&
      payment.status === "pending" &&
      payment.checkout_url,
  );
  if (reusable?.checkout_url) return { ok: true, url: reusable.checkout_url };

  const service = createSupabaseServiceClient();
  if (!service) return { ok: false, code: "provider_error" };

  const idempotencyKey = randomUUID();
  let preferenceId: string;
  let checkoutUrl: string;

  if (config.provider === "mock") {
    preferenceId = `mock-${order.id}`;
    checkoutUrl = `/pedido/${order.id}?pagar=teste`;
  } else {
    const base = resolveAppUrl(process.env);
    const returnUrl = (status: string) =>
      new URL(`/pedido/${order.id}?retorno=${status}`, base).href;
    const preference = await createPreference(
      config,
      buildPreference(
        {
          id: order.id,
          orderNumber: order.order_number,
          email: order.customer_email,
          items: order.order_items.map((item) => ({
            name: item.product_name,
            quantity: item.quantity,
            unitPriceCents: item.unit_price_cents,
          })),
          freightCents: order.freight_cents,
          floorChargeCents: order.floor_charge_cents,
          expiresAt: new Date(order.payment_expires_at).toISOString(),
        },
        {
          notification: new URL("/api/webhooks/mercadopago", base).href,
          success: returnUrl("sucesso"),
          pending: returnUrl("pendente"),
          failure: returnUrl("falha"),
        },
      ),
      idempotencyKey,
    );
    if (!preference) return { ok: false, code: "provider_error" };
    preferenceId = preference.id;
    checkoutUrl = preference.checkoutUrl;
  }

  const { error: registerError } = await service.rpc("order_register_payment", {
    p_order_id: order.id,
    p_provider: config.provider,
    p_idempotency_key: idempotencyKey,
    p_preference_id: preferenceId,
    p_checkout_url: checkoutUrl,
  });
  if (registerError) return { ok: false, code: "provider_error" };
  return { ok: true, url: checkoutUrl };
}

/** Best effort: frees stock held by unpaid orders before a new reservation. */
export async function releaseExpiredOrders() {
  const service = createSupabaseServiceClient();
  if (!service) return;
  await service.rpc("expire_pending_orders");
}
