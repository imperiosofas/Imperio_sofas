const approvedMunicipalities = new Map([
  ["3502507", "Aparecida"],
  ["3508504", "Caçapava"],
  ["3508603", "Cachoeira Paulista"],
  ["3518404", "Guaratinguetá"],
  ["3524402", "Jacareí"],
  ["3527207", "Lorena"],
  ["3538006", "Pindamonhangaba"],
  ["3540754", "Potim"],
  ["3544301", "Roseira"],
  ["3549904", "São José dos Campos"],
  ["3554102", "Taubaté"],
  ["3554805", "Tremembé"],
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeBulkSupplierAssignment(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;

  const rawIds = Array.isArray(value.productIds)
    ? value.productIds
    : [value.productIds];
  const productIds = rawIds.map((id) =>
    typeof id === "string" ? id.trim().toLowerCase() : "",
  );
  const supplierId =
    typeof value.supplierId === "string" ? value.supplierId.trim() : "";
  const confirmed = value.confirmed === true || value.confirmed === "on";

  if (
    !confirmed ||
    productIds.length < 1 ||
    productIds.length > 100 ||
    productIds.some((id) => !uuidPattern.test(id)) ||
    new Set(productIds).size !== productIds.length ||
    !uuidPattern.test(supplierId)
  )
    return null;

  return { productIds, supplierId };
}

export function normalizeMunicipalityName(value) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("pt-BR")
    : "";
}

export function getApprovedMunicipality(ibgeCode, cityName) {
  if (typeof ibgeCode !== "string" || !/^\d{7}$/.test(ibgeCode)) return null;
  const officialName = approvedMunicipalities.get(ibgeCode);
  if (
    !officialName ||
    normalizeMunicipalityName(cityName) !==
      normalizeMunicipalityName(officialName)
  )
    return null;
  return { ibgeCode, cityName: officialName, stateCode: "SP" };
}

export function isApprovedMunicipalityCode(ibgeCode) {
  return typeof ibgeCode === "string" && approvedMunicipalities.has(ibgeCode);
}

export function getApprovedMunicipalityByCode(ibgeCode) {
  if (typeof ibgeCode !== "string") return null;
  const cityName = approvedMunicipalities.get(ibgeCode);
  return cityName ? { ibgeCode, cityName, stateCode: "SP" } : null;
}

export function normalizePickupLocationInput(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;

  const locationCode =
    typeof value.locationCode === "string"
      ? value.locationCode.trim().toUpperCase()
      : "";
  const displayName =
    typeof value.displayName === "string" ? value.displayName.trim() : "";
  const street = typeof value.street === "string" ? value.street.trim() : "";
  const streetNumber =
    typeof value.streetNumber === "string" ? value.streetNumber.trim() : "";
  const neighborhood =
    typeof value.neighborhood === "string" ? value.neighborhood.trim() : "";
  const postalDigits =
    typeof value.postalCode === "string"
      ? value.postalCode.trim().replace("-", "")
      : "";
  const municipality = getApprovedMunicipalityByCode(value.ibgeCode);

  if (
    !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(locationCode) ||
    displayName.length < 1 ||
    displayName.length > 120 ||
    street.length < 1 ||
    street.length > 160 ||
    streetNumber.length < 1 ||
    streetNumber.length > 40 ||
    neighborhood.length < 1 ||
    neighborhood.length > 120 ||
    !/^\d{8}$/.test(postalDigits) ||
    !municipality ||
    typeof value.isActive !== "boolean"
  )
    return null;

  return {
    locationCode,
    displayName,
    street,
    streetNumber,
    neighborhood,
    postalCode: `${postalDigits.slice(0, 5)}-${postalDigits.slice(5)}`,
    ibgeCode: municipality.ibgeCode,
    cityName: municipality.cityName,
    stateCode: municipality.stateCode,
    isActive: value.isActive,
  };
}

export function buildLogisticsSupplierUpdateArgs(value) {
  return {
    p_supplier_id: value.supplierId,
    p_display_name: value.displayName,
    p_is_active: value.isActive,
    p_allows_pickup: value.allowsPickup,
    p_allows_delivery: value.allowsDelivery,
    p_lead_min_business_days: value.leadMinBusinessDays,
    p_lead_max_business_days: value.leadMaxBusinessDays,
    p_delivery_quote_required: value.deliveryQuoteRequired,
    p_admin_notes: value.adminNotes,
  };
}

export function buildLogisticsPickupLocationArgs(
  pickupLocationId,
  supplierId,
  fields,
) {
  return {
    p_pickup_location_id: pickupLocationId,
    p_supplier_id: supplierId,
    p_location_code: fields.locationCode,
    p_display_name: fields.displayName,
    p_street: fields.street,
    p_street_number: fields.streetNumber,
    p_neighborhood: fields.neighborhood,
    p_postal_code: fields.postalCode,
    p_ibge_code: fields.ibgeCode,
    p_is_active: fields.isActive,
  };
}

export function parseBrazilianCurrencyToCents(value) {
  if (typeof value !== "string") return null;
  const input = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!input) return null;

  let whole;
  let fraction = "00";
  if (input.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})$/.test(input)) return null;
    const parts = input.split(",");
    whole = parts[0].replace(/\./g, "");
    fraction = parts[1].padEnd(2, "0");
  } else if (input.includes(".")) {
    if (!/^\d+\.\d{1,2}$/.test(input)) return null;
    const parts = input.split(".");
    whole = parts[0];
    fraction = parts[1].padEnd(2, "0");
  } else {
    if (!/^\d+$/.test(input)) return null;
    whole = input;
  }

  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null;
}

export function parseNonNegativeInteger(value, maximum = 2_147_483_647) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function isValidWhatsappE164(value) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export function normalizeSearchText(value) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase("pt-BR")
    : "";
}
