"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendOrderEmail } from "../email/order-emails";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TERMS_VERSION } from "../legal/content";
import { createSupabaseServiceClient } from "../../lib/supabase/service";
import { getVerifiedCustomerSession } from "../logistics/server-session";
import {
  getPaymentConfig,
  releaseExpiredOrders,
  startOrderPayment,
} from "./payment-service";

export type CheckoutState = { error: string | null };

const databaseMessages: Record<string, string> = {
  "checkout disabled": "O pagamento online ainda não está liberado nesta loja.",
  "cart empty": "Seu carrinho está vazio.",
  "cart has unavailable items":
    "Algum item do carrinho ficou indisponível. Revise o carrinho.",
  "insufficient stock":
    "Não há estoque suficiente de algum item. Revise as quantidades no carrinho.",
  "accepted quote required":
    "Aceite a cotação de entrega em Minhas entregas antes de pagar.",
  "quote expired": "A cotação de entrega expirou. Solicite uma nova.",
  "quote does not match cart":
    "O carrinho mudou desde a cotação. Solicite uma nova cotação de entrega.",
  "quote has an unpriced delivery group":
    "A cotação ainda não tem todos os fretes informados.",
  "delivery quote required":
    "Os produtos com entrega precisam de uma cotação aceita antes do pagamento.",
  "multi delivery policy pending":
    "Pedidos com duas entregas ao mesmo tempo ainda não estão liberados. Finalize um fornecedor por vez ou fale com a loja.",
  "pickup location required": "Escolha o local de retirada.",
  "pickup location unavailable":
    "O local de retirada escolhido não está disponível.",
  "supplier unavailable": "Um dos fornecedores está indisponível no momento.",
};

function friendly(message: string | undefined) {
  return (
    (message && databaseMessages[message]) ||
    "Não foi possível criar o pedido agora. Tente novamente em instantes."
  );
}

const startSchema = z.object({
  idempotencyKey: z.string().uuid(),
  quoteId: z.string().uuid().nullable(),
  pickup: z
    .array(
      z.object({
        supplier_code: z.string().min(1).max(20),
        pickup_location_id: z.string().uuid(),
      }),
    )
    .max(2),
});

export async function startCheckoutAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await getVerifiedCustomerSession();
  if (!session) redirect("/conta?next=%2Fcheckout");

  if (getPaymentConfig().status !== "ready")
    return { error: "O pagamento online ainda não está disponível." };

  if (formData.get("acceptTerms") !== "on")
    return {
      error:
        "Para continuar, aceite os termos de compra e a política de trocas.",
    };

  let pickup: unknown = [];
  try {
    pickup = JSON.parse(String(formData.get("pickup") ?? "[]"));
  } catch {
    return { error: "Não foi possível ler a retirada escolhida." };
  }
  const parsed = startSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    quoteId: formData.get("quoteId") || null,
    pickup,
  });
  if (!parsed.success)
    return { error: "Confira os dados do pedido e tente novamente." };

  await releaseExpiredOrders();

  const { data, error } = await session.client.rpc("create_checkout_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_quote_id: parsed.data.quoteId,
    p_pickup: parsed.data.pickup,
  });
  if (error || typeof data !== "string")
    return { error: friendly(error?.message) };

  // The checkbox is enforced above; this stores which terms version was
  // accepted. Payment refuses orders without it, so a failure is reported.
  const terms = await session.client.rpc("record_order_terms_acceptance", {
    p_order_id: data,
    p_terms_version: TERMS_VERSION,
  });
  if (terms.error) {
    console.error("checkout: terms acceptance not recorded", {
      code: terms.error.code,
    });
    // Same idempotency key on retry: create_checkout_order returns this order
    // and the acceptance is recorded again.
    return {
      error: "Não foi possível registrar o aceite dos termos. Tente novamente.",
    };
  }

  // Optional and independent from the purchase; failure must not block payment.
  if (formData.get("marketingWhatsapp") === "on") {
    const consent = await session.client.rpc("record_order_marketing_consent", {
      p_order_id: data,
    });
    if (consent.error)
      console.error("checkout: marketing consent not recorded", {
        code: consent.error.code,
      });
  }

  // Immediate confirmation with the order summary (Decreto 7.962, art. 4º).
  after(() => sendOrderEmail(data, "created"));

  const payment = await startOrderPayment(session.client, data);
  revalidatePath("/carrinho");
  if (!payment.ok) {
    // The order exists and holds stock until it expires: send the customer to
    // it so payment can be retried instead of creating a second order.
    redirect(`/pedido/${data}?retorno=erro`);
  }
  redirect(payment.url);
}

/** Right of withdrawal (CDC art. 49): records the request with a timestamp. */
export async function requestWithdrawalAction(
  orderId: string,
  formData: FormData,
) {
  const session = await getVerifiedCustomerSession();
  if (!session) redirect("/conta");
  if (!z.string().uuid().safeParse(orderId).success) redirect("/conta/pedidos");
  const reasonValue = formData.get("reason");
  const reason =
    typeof reasonValue === "string" ? reasonValue.trim().slice(0, 500) : "";
  const { error } = await session.client.rpc("request_order_withdrawal", {
    p_order_id: orderId,
    p_reason: reason || null,
  });
  // Confirmation of receipt of the withdrawal (Decreto 7.962, art. 5º, § 4º).
  if (!error) after(() => sendOrderEmail(orderId, "withdrawal"));
  revalidatePath(`/pedido/${orderId}`);
  redirect(
    `/pedido/${orderId}?retorno=${error ? "desistencia-erro" : "desistencia"}`,
  );
}

export async function retryPaymentAction(orderId: string) {
  const session = await getVerifiedCustomerSession();
  if (!session) redirect("/conta");
  if (!z.string().uuid().safeParse(orderId).success) redirect("/conta/pedidos");
  const result = await startOrderPayment(session.client, orderId);
  if (!result.ok) redirect(`/pedido/${orderId}?retorno=erro`);
  redirect(result.url);
}

export async function cancelOrderAction(orderId: string) {
  const session = await getVerifiedCustomerSession();
  if (!session) redirect("/conta");
  if (!z.string().uuid().safeParse(orderId).success) return;
  await session.client.rpc("cancel_my_order", { p_order_id: orderId });
  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/conta/pedidos");
  revalidatePath("/carrinho");
  redirect(`/pedido/${orderId}`);
}

/**
 * Test-environment only: lets the owner walk the whole flow without a payment
 * provider. It is refused unless the mock provider is the active configuration
 * (never in production) and the order belongs to the signed-in customer.
 */
export async function simulateMockPaymentAction(
  orderId: string,
  outcome: "approved" | "rejected",
) {
  // Server Action arguments are untrusted: validate before any use.
  if (
    !z.string().uuid().safeParse(orderId).success ||
    !z.enum(["approved", "rejected"]).safeParse(outcome).success
  )
    return;
  const session = await getVerifiedCustomerSession();
  if (!session) redirect("/conta");
  const config = getPaymentConfig();
  if (config.status !== "ready" || config.provider !== "mock")
    redirect(`/pedido/${orderId}`);

  const { data: order } = await session.client
    .from("orders")
    .select("id, total_cents, status")
    .eq("id", orderId)
    .maybeSingle();
  const service = createSupabaseServiceClient();
  if (!order || !service || order.status === "paid")
    redirect(`/pedido/${orderId}`);

  const { data: applied } = await service.rpc("order_apply_payment_event", {
    p_provider: "mock",
    p_event_id: `mock-${randomUUID()}`,
    p_order_id: orderId,
    p_provider_payment_id: `mock-payment-${orderId}`,
    p_status: outcome,
    p_amount_cents: order.total_cents,
  });
  if ((applied as { outcome?: string } | null)?.outcome === "paid")
    after(() => sendOrderEmail(orderId, "paid"));
  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/carrinho");
  redirect(
    `/pedido/${orderId}?retorno=${outcome === "approved" ? "sucesso" : "falha"}`,
  );
}
