"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "../../lib/supabase/service";
import { lookupPostalCode } from "./cep-lookup.mjs";
import {
  getCartLogisticsProjection,
  type CartLogisticsProjection,
} from "./storefront-data";
import {
  logisticsQuoteIdSchema,
  logisticsQuoteResponseSchema,
  quoteRequestSchema,
} from "./quote-input.mjs";
import { getVerifiedCustomerSession } from "./server-session";
import { logisticsQuoteRateLimiter } from "./quote-rate-limit.mjs";
import { normalizeCustomerLogisticsQuote } from "./customer-quotes";
import { executeWhenServiceConfigured } from "./quote-service-gate.mjs";
import { interpretQuoteRpcResult } from "./quote-rpc-result.mjs";

type ActionResult =
  | { status: "ok"; quoteId: string; whatsappUrl: string | null }
  | {
      status: ActionErrorStatus;
      message: string;
    };

type ActionErrorStatus =
  | "invalid"
  | "unauthenticated"
  | "rate_limited"
  | "configuration_pending"
  | "cep_unavailable"
  | "outside_coverage"
  | "cart_changed"
  | "request_changed"
  | "backend_unavailable";
const POSTGRES_INTEGER_MAX = 2_147_483_647;

function isUuid(value: unknown): value is string {
  return z.string().uuid().safeParse(value).success;
}

function error(status: ActionErrorStatus, message: string): ActionResult {
  return { status, message };
}

function buildWhatsAppUrl(
  phone: string | null,
  quoteId: string,
): string | null {
  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  const message = encodeURIComponent(
    `Olá! Solicitei uma cotação de entrega. Referência ${quoteId.slice(0, 8)}.`,
  );
  return `https://wa.me/${phone.slice(1)}?text=${message}`;
}

function deriveSupplierGroups(
  projection: CartLogisticsProjection,
  selected: z.infer<typeof quoteRequestSchema>["supplierModes"],
) {
  if (
    projection.items.length === 0 ||
    projection.items.some(
      (item) =>
        !item.availableForQuote ||
        !item.supplierAssigned ||
        !item.supplierCode ||
        item.fulfillmentModes.length === 0,
    )
  ) {
    return null;
  }

  const itemsBySupplier = new Map<
    "VALE" | "MUNDIAL",
    { variant_id: string; quantity: number }[]
  >();
  for (const item of projection.items) {
    const supplierCode = item.supplierCode;
    if (!supplierCode) return null;
    const rows = itemsBySupplier.get(supplierCode) ?? [];
    rows.push({ variant_id: item.variantId, quantity: item.quantity });
    itemsBySupplier.set(supplierCode, rows);
  }

  if (selected.length !== itemsBySupplier.size) return null;
  const groups = [];
  for (const choice of selected) {
    const cartItems = itemsBySupplier.get(choice.supplierCode);
    if (!cartItems) return null;
    const locations = projection.pickupLocations.filter(
      (location) => location.supplierCode === choice.supplierCode,
    );
    if (
      !projection.items
        .filter((item) => item.supplierCode === choice.supplierCode)
        .every((item) => item.fulfillmentModes.includes(choice.mode))
    ) {
      return null;
    }
    if (
      choice.mode === "pickup" &&
      !locations.some((location) => location.id === choice.pickupLocationId)
    ) {
      return null;
    }
    groups.push({
      supplier_code: choice.supplierCode,
      fulfillment_mode: choice.mode,
      pickup_location_id:
        choice.mode === "pickup" ? choice.pickupLocationId : null,
      items: cartItems,
    });
  }
  return groups;
}

export async function createCustomerLogisticsQuote(
  input: unknown,
): Promise<ActionResult> {
  const session = await getVerifiedCustomerSession();
  if (!session)
    return error(
      "unauthenticated",
      "Entre novamente para solicitar a cotação.",
    );

  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success)
    return error("invalid", "Revise os dados de modalidade e endereço.");

  const limit = logisticsQuoteRateLimiter.consume(session.userId);
  if (!limit.allowed)
    return error(
      "rate_limited",
      `Aguarde ${limit.retryAfterSeconds} segundos antes de tentar novamente.`,
    );

  // Fail closed before any privileged RPC when the server credential is absent.
  if (!isSupabaseServiceConfigured())
    return error(
      "configuration_pending",
      "A solicitação de cotação não está configurada neste ambiente.",
    );

  const projection = await getCartLogisticsProjection(session.client);
  if (!projection)
    return error(
      "backend_unavailable",
      "Não foi possível validar a logística do carrinho.",
    );
  const supplierGroups = deriveSupplierGroups(
    projection,
    parsed.data.supplierModes,
  );
  if (!supplierGroups)
    return error(
      "cart_changed",
      "O carrinho mudou ou contém item sem logística disponível. Atualize a página e revise os itens.",
    );

  const hasDelivery = supplierGroups.some(
    (group) => group.fulfillment_mode === "delivery",
  );
  if (!hasDelivery)
    return error(
      "invalid",
      "A retirada não precisa de cotação de entrega. Consulte o local selecionado.",
    );

  const addressInput = parsed.data.address;
  if (!addressInput)
    return error("invalid", "Informe o endereço para solicitar a cotação.");
  if (addressInput.floor > POSTGRES_INTEGER_MAX)
    return error(
      "invalid",
      "O andar excede o intervalo estrutural aceito pelo campo inteiro do banco.",
    );
  const floorFee =
    Math.max(
      0,
      addressInput.floor - projection.floorCharge.includedThroughFloor,
    ) * projection.floorCharge.floorChargeCents;
  if (!Number.isSafeInteger(floorFee) || floorFee > POSTGRES_INTEGER_MAX)
    return error(
      "invalid",
      "O adicional de andar excede o intervalo monetário suportado pela cotação.",
    );

  const postalLookup = await lookupPostalCode(addressInput.postalCode);
  if (
    postalLookup.status !== "found" ||
    postalLookup.postalCode !== addressInput.postalCode.replace(/\D/g, "") ||
    !postalLookup.street.trim() ||
    !postalLookup.neighborhood.trim()
  ) {
    return error(
      "cep_unavailable",
      "Não foi possível confirmar o endereço pelo CEP. Tente novamente mais tarde ou confira o CEP.",
    );
  }

  const covered = projection.deliveryAreas.some(
    (area) =>
      area.ibgeCode === postalLookup.municipalityId &&
      area.cityName === postalLookup.city &&
      area.stateCode === postalLookup.state,
  );
  if (!covered)
    return error(
      "outside_coverage",
      "Ainda não atendemos entrega para o município confirmado por este CEP.",
    );

  const verifiedAt = new Date().toISOString();
  try {
    const execution = await executeWhenServiceConfigured(
      isSupabaseServiceConfigured(),
      async () => {
        const serviceClient = createSupabaseServiceClient();
        if (!serviceClient) return null;
        return serviceClient.rpc("logistics_create_quote_server", {
          p_user_id: session.userId,
          p_idempotency_key: parsed.data.requestId,
          p_supplier_modes: supplierGroups,
          p_address: {
            postal_code: postalLookup.postalCode,
            street: postalLookup.street,
            number: addressInput.number,
            complement: addressInput.complement || null,
            neighborhood: postalLookup.neighborhood,
            ibge_code: postalLookup.municipalityId,
            city_name: postalLookup.city,
            state_code: postalLookup.state,
            floor_number: addressInput.floor,
            cep_verified_postal_code: postalLookup.postalCode,
            cep_verification_source: "viacep",
            cep_verified_at: verifiedAt,
          },
        });
      },
    );
    if (execution.status === "configuration_pending" || !execution.result)
      return error(
        "configuration_pending",
        "A solicitação de cotação não está configurada neste ambiente.",
      );
    const { data, error: rpcError } = execution.result;
    const rpcResult = interpretQuoteRpcResult(data, rpcError, isUuid);
    if (rpcResult.status === "cart_changed")
      return error(
        "cart_changed",
        "O carrinho mudou enquanto validávamos a cotação. Atualize as informações, revise os itens e tente novamente.",
      );
    if (rpcResult.status === "request_changed")
      return error(
        "request_changed",
        "Os dados da solicitação mudaram durante a validação. Revise o endereço e tente novamente.",
      );
    if (rpcResult.status !== "ok")
      return error(
        "backend_unavailable",
        "Não foi possível registrar a cotação agora. Tente novamente em instantes.",
      );

    revalidatePath("/carrinho");
    revalidatePath("/conta/entregas");
    return {
      status: "ok",
      quoteId: rpcResult.quoteId,
      whatsappUrl: buildWhatsAppUrl(
        projection.whatsappPhoneE164,
        rpcResult.quoteId,
      ),
    };
  } catch {
    return error(
      "backend_unavailable",
      "Não foi possível registrar a cotação agora. Tente novamente em instantes.",
    );
  }
}

export async function getCustomerLogisticsQuote(input: unknown) {
  const session = await getVerifiedCustomerSession();
  if (!session) return { status: "unauthenticated" as const };
  const parsed = logisticsQuoteIdSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };

  try {
    const { data, error: rpcError } = await session.client.rpc(
      "customer_get_logistics_quote",
      { p_quote_id: parsed.data },
    );
    const quote = normalizeCustomerLogisticsQuote(data);
    if (rpcError || !quote || quote.id !== parsed.data)
      return { status: "unavailable" as const };
    return { status: "ok" as const, quote };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function respondToCustomerLogisticsQuote(input: unknown) {
  const session = await getVerifiedCustomerSession();
  if (!session) return { status: "unauthenticated" as const };
  const parsed = logisticsQuoteResponseSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };
  try {
    const { error: rpcError } = await session.client.rpc(
      "customer_respond_logistics_quote",
      {
        p_quote_id: parsed.data.quoteId,
        p_accept: parsed.data.accept,
      },
    );
    if (rpcError) return { status: "unavailable" as const };
    revalidatePath("/conta/entregas");
    return { status: "ok" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function cancelCustomerLogisticsQuote(input: unknown) {
  const session = await getVerifiedCustomerSession();
  if (!session) return { status: "unauthenticated" as const };
  const parsed = logisticsQuoteIdSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const };
  try {
    const { error: rpcError } = await session.client.rpc(
      "customer_cancel_logistics_quote",
      { p_quote_id: parsed.data },
    );
    if (rpcError) return { status: "unavailable" as const };
    revalidatePath("/conta/entregas");
    return { status: "ok" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}
