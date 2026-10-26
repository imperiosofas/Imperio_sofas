"use server";

import { revalidatePath } from "next/cache";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import {
  buildLogisticsPickupLocationArgs,
  buildLogisticsSupplierUpdateArgs,
  getApprovedMunicipality,
  isValidWhatsappE164,
  normalizeSearchText,
  normalizeBulkSupplierAssignment,
  parseBrazilianCurrencyToCents,
  parseNonNegativeInteger,
  normalizePickupLocationInput,
} from "./validation.mjs";

type ActionResult = { ok: true } | { ok: false; message: string };
type ActionError = { code?: string } | null;
type MunicipalityOption = {
  ibgeCode: string;
  cityName: string;
  stateCode: "SP";
  approved: boolean;
};
type MunicipalitySearchResult =
  | { ok: true; municipalities: MunicipalityOption[] }
  | { ok: false; municipalities: MunicipalityOption[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInput(input: unknown, key: string): unknown {
  if (input instanceof FormData) return input.get(key);
  return isRecord(input) ? input[key] : undefined;
}

function readString(input: unknown, key: string): string | null {
  const value = readInput(input, key);
  return typeof value === "string" ? value : null;
}

function readBoolean(input: unknown, key: string): boolean | null {
  const value = readInput(input, key);
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "on") return true;
  if (value === "false") return false;
  return null;
}

function hasInput(input: unknown): boolean {
  return input instanceof FormData || isRecord(input);
}

function getErrorMessage(error: ActionError): ActionResult {
  if (error?.code === "PGRST202" || error?.code === "42883")
    return {
      ok: false,
      message:
        "Esta operação ainda não está disponível no banco. A RPC administrativa correspondente precisa ser concluída e aplicada.",
    };
  return {
    ok: false,
    message: "Não foi possível salvar. Confira os dados e tente novamente.",
  };
}

function revalidateLogistics() {
  for (const path of [
    "/admin/entregas",
    "/admin/entregas/solicitacoes",
    "/admin/entregas/areas",
    "/admin/entregas/fornecedores",
    "/admin/entregas/produtos",
    "/admin/entregas/retiradas",
    "/admin/entregas/configuracoes",
  ])
    revalidatePath(path);
}

export async function assignProductSupplier(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/produtos");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };
  const productId = readString(input, "productId");
  const supplierValue = readString(input, "supplierId");
  const supplierId = supplierValue === "" ? null : supplierValue;
  if (
    typeof productId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      productId,
    ) ||
    (supplierId !== null &&
      (typeof supplierId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          supplierId,
        )))
  )
    return { ok: false, message: "Produto ou fornecedor inválido." };

  const { error } = await supabase.rpc("admin_assign_product_supplier", {
    p_product_id: productId,
    p_supplier_id: supplierId,
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function bulkAssignProductSuppliers(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/produtos");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };

  const productIds =
    input instanceof FormData
      ? input.getAll("productIds")
      : readInput(input, "productIds");
  const assignment = normalizeBulkSupplierAssignment({
    productIds,
    supplierId: readString(input, "supplierId"),
    confirmed: readBoolean(input, "confirm"),
  });
  if (!assignment)
    return {
      ok: false,
      message:
        "Selecione de 1 a 100 produtos distintos, escolha Vale ou Mundial e confirme a alteração.",
    };

  const { data, error } = await supabase.rpc("admin_assign_products_supplier", {
    p_product_ids: assignment.productIds,
    p_supplier_id: assignment.supplierId,
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  if (data !== assignment.productIds.length)
    return {
      ok: false,
      message:
        "A operação foi recebida, mas não foi possível confirmar a quantidade. Atualize a página antes de repetir.",
    };
  return { ok: true };
}

export async function setLogisticsArea(input: unknown): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/areas");
  const enabled = readBoolean(input, "enabled");
  if (!hasInput(input) || enabled === null)
    return { ok: false, message: "Dados da área inválidos." };
  const approved = getApprovedMunicipality(
    readInput(input, "ibgeCode"),
    readInput(input, "cityName"),
  );
  if (!approved)
    return {
      ok: false,
      message:
        "Este município não está entre as áreas aprovadas para habilitação.",
    };

  const { error } = await supabase.rpc("admin_set_logistics_area", {
    p_ibge_code: approved.ibgeCode,
    p_city_name: approved.cityName,
    p_enabled: enabled,
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function updateLogisticsSettings(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/configuracoes");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };

  const floorChargeCents = parseBrazilianCurrencyToCents(
    readInput(input, "floorCharge"),
  );
  const includedThroughFloor = parseNonNegativeInteger(
    readInput(input, "includedThroughFloor"),
  );
  const expirationText =
    readString(input, "quoteExpirationMinutes")?.trim() ?? "";
  const expiration = expirationText
    ? parseNonNegativeInteger(expirationText)
    : null;
  const phone = readString(input, "whatsappPhoneE164")?.trim() ?? "";

  if (
    floorChargeCents === null ||
    includedThroughFloor === null ||
    (expirationText !== "" && (!expiration || expiration <= 0)) ||
    (phone !== "" && !isValidWhatsappE164(phone))
  )
    return {
      ok: false,
      message:
        "Revise o adicional, o andar incluído, a validade (em minutos) e o telefone em formato internacional.",
    };

  const { error } = await supabase.rpc("admin_update_logistics_settings", {
    p_floor_charge_cents: floorChargeCents,
    p_included_through_floor: includedThroughFloor,
    p_quote_expiration_minutes: expiration,
    p_whatsapp_phone_e164: phone || null,
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function setLogisticsGroupFreight(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/solicitacoes");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };
  const quoteId = readString(input, "quoteId");
  const supplierCode = readString(input, "supplierCode");
  const baseFreightCents = parseBrazilianCurrencyToCents(
    readInput(input, "baseFreight"),
  );
  if (
    typeof quoteId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      quoteId,
    ) ||
    (supplierCode !== "VALE" && supplierCode !== "MUNDIAL") ||
    baseFreightCents === null
  )
    return {
      ok: false,
      message: "Informe uma solicitação, fornecedor e frete base válidos.",
    };

  const { error } = await supabase.rpc("admin_set_logistics_group_freight", {
    p_quote_id: quoteId,
    p_supplier_code: supplierCode,
    p_base_freight_cents: baseFreightCents,
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function updateLogisticsSupplier(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/fornecedores");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };
  const code = readString(input, "code");
  const supplierId = readString(input, "supplierId");
  const displayName = readString(input, "displayName")?.trim() ?? "";
  const isActive = readBoolean(input, "isActive");
  const allowsPickup = readBoolean(input, "allowsPickup");
  const allowsDelivery = readBoolean(input, "allowsDelivery");
  const leadMinBusinessDays = readInput(input, "leadMinBusinessDays");
  const leadMaxBusinessDays = readInput(input, "leadMaxBusinessDays");
  const deliveryQuoteRequired = readBoolean(input, "deliveryQuoteRequired");
  const adminNotes = readInput(input, "adminNotes");
  const minimum = parseNonNegativeInteger(leadMinBusinessDays);
  const maximum = parseNonNegativeInteger(leadMaxBusinessDays);
  if (
    (code !== "VALE" && code !== "MUNDIAL") ||
    typeof supplierId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      supplierId,
    ) ||
    displayName.length < 1 ||
    displayName.length > 80 ||
    typeof isActive !== "boolean" ||
    typeof allowsDelivery !== "boolean" ||
    typeof allowsPickup !== "boolean" ||
    typeof deliveryQuoteRequired !== "boolean" ||
    minimum === null ||
    maximum === null ||
    maximum < minimum ||
    (code === "MUNDIAL" && allowsPickup) ||
    (allowsDelivery && deliveryQuoteRequired !== true) ||
    (adminNotes !== null && typeof adminNotes !== "string") ||
    (typeof adminNotes === "string" && adminNotes.length > 2_000)
  )
    return {
      ok: false,
      message:
        "Revise os dados do fornecedor. Mundial não oferece retirada e toda entrega exige cotação.",
    };

  const { error } = await supabase.rpc("admin_update_logistics_supplier", {
    ...buildLogisticsSupplierUpdateArgs({
      supplierId,
      displayName,
      isActive,
      allowsPickup,
      allowsDelivery,
      leadMinBusinessDays: minimum,
      leadMaxBusinessDays: maximum,
      deliveryQuoteRequired,
      adminNotes:
        typeof adminNotes === "string" && adminNotes.trim()
          ? adminNotes.trim()
          : null,
    }),
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function saveLogisticsPickupLocation(
  input: unknown,
): Promise<ActionResult> {
  const supabase = await requireCatalogAdmin("/admin/entregas/retiradas");
  if (!hasInput(input)) return { ok: false, message: "Dados inválidos." };

  const pickupLocationValue = readString(input, "pickupLocationId");
  const pickupLocationId =
    pickupLocationValue === "" ? null : pickupLocationValue;
  const supplierId = readString(input, "supplierId");
  const fields = normalizePickupLocationInput({
    locationCode: readInput(input, "locationCode"),
    displayName: readInput(input, "displayName"),
    street: readInput(input, "street"),
    streetNumber: readInput(input, "streetNumber"),
    neighborhood: readInput(input, "neighborhood"),
    postalCode: readInput(input, "postalCode"),
    ibgeCode: readInput(input, "ibgeCode"),
    isActive: readBoolean(input, "isActive"),
  });

  if (
    (pickupLocationId !== null &&
      (typeof pickupLocationId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          pickupLocationId,
        ))) ||
    typeof supplierId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      supplierId,
    ) ||
    !fields
  )
    return {
      ok: false,
      message:
        "Revise o identificador, endereço, CEP e município aprovado do local de retirada.",
    };

  const { error } = await supabase.rpc("admin_save_logistics_pickup_location", {
    ...buildLogisticsPickupLocationArgs(pickupLocationId, supplierId, fields),
  } as never);
  if (error) return getErrorMessage(error);
  revalidateLogistics();
  return { ok: true };
}

export async function searchIbgeMunicipalities(
  input: unknown,
): Promise<MunicipalitySearchResult> {
  await requireCatalogAdmin("/admin/entregas/areas");
  const query = readString(input, "query")?.trim() ?? "";
  if (query.length < 2 || query.length > 80)
    return { ok: true, municipalities: [] };

  try {
    const response = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome",
      { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(6_000) },
    );
    if (!response.ok) return { ok: false, municipalities: [] };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { ok: false, municipalities: [] };

    const normalizedQuery = normalizeSearchText(query);
    const municipalities = payload
      .filter(
        (row): row is { id: number; nome: string } =>
          isRecord(row) &&
          Number.isSafeInteger(row.id) &&
          typeof row.nome === "string",
      )
      .map((row) => ({
        ibgeCode: String(row.id).padStart(7, "0"),
        cityName: row.nome,
        stateCode: "SP" as const,
        approved:
          getApprovedMunicipality(String(row.id).padStart(7, "0"), row.nome) !==
          null,
      }))
      .filter((row) =>
        normalizeSearchText(row.cityName).includes(normalizedQuery),
      )
      .slice(0, 8);
    return { ok: true, municipalities };
  } catch {
    return { ok: false, municipalities: [] };
  }
}
