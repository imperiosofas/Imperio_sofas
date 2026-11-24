import "server-only";

import { z } from "zod";
import type { PaymentConfig } from "./payment-config";
import { selectCheckoutUrl } from "./mercadopago-map";

type MercadoPagoConfig = Extract<PaymentConfig, { provider: "mercadopago" }>;

const API_BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

const preferenceResponse = z.object({
  id: z.string().min(1),
  init_point: z.string().url(),
  sandbox_init_point: z.string().url().optional(),
});

const paymentResponse = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string(),
  external_reference: z.string().nullable().optional(),
  transaction_amount: z.number(),
  currency_id: z.string().nullable().optional(),
  collector_id: z.union([z.number(), z.string()]).nullable().optional(),
  date_last_updated: z.string().nullable().optional(),
});
export type MercadoPagoPayment = z.infer<typeof paymentResponse>;

async function request(
  config: MercadoPagoConfig,
  path: string,
  init: RequestInit & { idempotencyKey?: string },
) {
  const { idempotencyKey, ...rest } = init;
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Returns null on any failure: callers must not leak provider details. */
export async function createPreference(
  config: MercadoPagoConfig,
  payload: unknown,
  idempotencyKey: string,
): Promise<{ id: string; checkoutUrl: string } | null> {
  try {
    const response = await request(config, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey,
    });
    if (!response.ok) {
      // Safe diagnostics: HTTP status and Mercado Pago error code only.
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        message?: unknown;
      } | null;
      console.error("mercadopago: preference rejected", {
        status: response.status,
        error: typeof body?.error === "string" ? body.error : null,
        message:
          typeof body?.message === "string" ? body.message.slice(0, 160) : null,
      });
      return null;
    }
    const parsed = preferenceResponse.safeParse(await response.json());
    if (!parsed.success) {
      console.error("mercadopago: unexpected preference response");
      return null;
    }
    return {
      id: parsed.data.id,
      checkoutUrl: selectCheckoutUrl(config.accessToken, parsed.data),
    };
  } catch {
    return null;
  }
}

export async function fetchPayment(
  config: MercadoPagoConfig,
  paymentId: string,
): Promise<MercadoPagoPayment | null> {
  if (!/^[0-9]{1,20}$/.test(paymentId)) return null;
  try {
    const response = await request(config, `/v1/payments/${paymentId}`, {
      method: "GET",
    });
    if (!response.ok) {
      console.error("mercadopago: payment lookup failed", {
        status: response.status,
      });
      return null;
    }
    const parsed = paymentResponse.safeParse(await response.json());
    if (!parsed.success)
      console.error("mercadopago: unexpected payment response");
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
