import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fetchPayment } from "../../../../features/checkout/mercadopago-client";
import {
  mapMercadoPagoStatus,
  reaisToCents,
} from "../../../../features/checkout/mercadopago-map";
import { verifyMercadoPagoSignature } from "../../../../features/checkout/mercadopago-signature";
import { getPaymentConfig } from "../../../../features/checkout/payment-service";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_384;
const uuid = z.string().uuid();

function respond(status: number, body: Record<string, unknown> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Mercado Pago notification. The signed id is only a pointer: the payment is
 * fetched from the provider API with our credentials, so a forged body cannot
 * change an order. Replays are absorbed by the database (provider + event id).
 */
export async function POST(request: NextRequest) {
  const config = getPaymentConfig();
  if (config.status !== "ready" || config.provider !== "mercadopago")
    return respond(503);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return respond(413);
  let body: { type?: unknown; data?: { id?: unknown } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return respond(400);
  }

  const dataId =
    request.nextUrl.searchParams.get("data.id") ??
    (body.data?.id !== undefined ? String(body.data.id) : null);
  const valid = verifyMercadoPagoSignature({
    secret: config.webhookSecret,
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!valid) return respond(401);

  const type = request.nextUrl.searchParams.get("type") ?? body.type;
  if (type !== "payment" || !dataId) return respond(200, { ignored: true });

  const payment = await fetchPayment(config, dataId);
  if (!payment) return respond(502);

  const orderId = uuid.safeParse(payment.external_reference);
  const status = mapMercadoPagoStatus(payment.status);
  const cents = reaisToCents(payment.transaction_amount);
  const collectorMatches =
    !config.expectedCollectorId ||
    String(payment.collector_id ?? "") === config.expectedCollectorId;
  if (
    !orderId.success ||
    !status ||
    cents === null ||
    payment.currency_id !== "BRL" ||
    !collectorMatches
  )
    return respond(200, { ignored: true });

  const service = createSupabaseServiceClient();
  if (!service) return respond(503);
  const { data, error } = await service.rpc("order_apply_payment_event", {
    p_provider: "mercadopago",
    p_event_id: `${payment.id}:${payment.status}:${payment.date_last_updated ?? ""}`,
    p_order_id: orderId.data,
    p_provider_payment_id: String(payment.id),
    p_status: status,
    p_amount_cents: cents,
  });
  // A failure here must be retried by the provider.
  if (error) return respond(500);
  return respond(200, {
    outcome: (data as { outcome?: string } | null)?.outcome ?? null,
  });
}
