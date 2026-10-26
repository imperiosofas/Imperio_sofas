import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBulkSupplierAssignment,
  buildLogisticsPickupLocationArgs,
  buildLogisticsSupplierUpdateArgs,
  getApprovedMunicipality,
  getApprovedMunicipalityByCode,
  isApprovedMunicipalityCode,
  isValidWhatsappE164,
  normalizeMunicipalityName,
  normalizePickupLocationInput,
  parseBrazilianCurrencyToCents,
  parseNonNegativeInteger,
} from "./validation.mjs";

test("parses Brazilian money as integer cents without floating-point rounding", () => {
  assert.equal(parseBrazilianCurrencyToCents("0,00"), 0);
  assert.equal(parseBrazilianCurrencyToCents("10,5"), 1_050);
  assert.equal(parseBrazilianCurrencyToCents("1.234,56"), 123_456);
  assert.equal(parseBrazilianCurrencyToCents("1234.56"), 123_456);
  assert.equal(parseBrazilianCurrencyToCents("R$ 3.828,00"), 382_800);
  assert.equal(parseBrazilianCurrencyToCents(""), null);
  assert.equal(parseBrazilianCurrencyToCents("12,345"), null);
  assert.equal(parseBrazilianCurrencyToCents("1.23,45"), null);
  assert.equal(parseBrazilianCurrencyToCents("-1,00"), null);
  assert.equal(parseBrazilianCurrencyToCents("999999999999999999,00"), null);
});

test("integer settings accept the SQL integer range without a commercial ceiling", () => {
  assert.equal(parseNonNegativeInteger("0"), 0);
  assert.equal(parseNonNegativeInteger("32768"), 32_768);
  assert.equal(parseNonNegativeInteger("2147483647"), 2_147_483_647);
  assert.equal(parseNonNegativeInteger("1.5"), null);
  assert.equal(parseNonNegativeInteger("-1"), null);
  assert.equal(parseNonNegativeInteger("2147483648"), null);
  assert.equal(parseNonNegativeInteger("9007199254740992"), null);
});

test("bulk supplier assignment requires explicit confirmation and unique valid IDs", () => {
  const productIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  ];
  const supplierId = "5d4e4c8a-7a70-4b0a-bf36-0b056126dd59";

  assert.deepEqual(
    normalizeBulkSupplierAssignment({
      productIds,
      supplierId,
      confirmed: true,
    }),
    { productIds, supplierId },
  );
  assert.equal(
    normalizeBulkSupplierAssignment({
      productIds,
      supplierId,
      confirmed: false,
    }),
    null,
  );
  assert.equal(
    normalizeBulkSupplierAssignment({
      productIds: [productIds[0], productIds[0]],
      supplierId,
      confirmed: true,
    }),
    null,
  );
  assert.equal(
    normalizeBulkSupplierAssignment({
      productIds: [],
      supplierId,
      confirmed: true,
    }),
    null,
  );
  assert.equal(
    normalizeBulkSupplierAssignment({
      productIds: [...productIds, "not-a-uuid"],
      supplierId,
      confirmed: true,
    }),
    null,
  );
  assert.equal(
    normalizeBulkSupplierAssignment({
      productIds: Array.from(
        { length: 101 },
        (_, index) =>
          `${String(index + 1).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      ),
      supplierId,
      confirmed: true,
    }),
    null,
  );
});

test("only the owner-approved IBGE municipalities can be enabled", () => {
  assert.deepEqual(getApprovedMunicipality("3554102", "Taubaté"), {
    ibgeCode: "3554102",
    cityName: "Taubaté",
    stateCode: "SP",
  });
  assert.deepEqual(getApprovedMunicipality("3554102", "TAUBATE"), {
    ibgeCode: "3554102",
    cityName: "Taubaté",
    stateCode: "SP",
  });
  assert.equal(getApprovedMunicipality("3554102", "São Paulo"), null);
  assert.equal(getApprovedMunicipality("3550308", "São Paulo"), null);
  assert.equal(isApprovedMunicipalityCode("3554102"), true);
  assert.equal(isApprovedMunicipalityCode("3550308"), false);
});

test("pickup address input normalizes its code and CEP and accepts only approved IBGE cities", () => {
  const normalized = normalizePickupLocationInput({
    locationCode: " vale_galpao ",
    displayName: " Galpão Vale ",
    street: " Rua Agostinho Abifadel ",
    streetNumber: " 35 ",
    neighborhood: " Terra Nova ",
    postalCode: "12081670",
    ibgeCode: "3554102",
    isActive: true,
  });

  assert.deepEqual(normalized, {
    locationCode: "VALE_GALPAO",
    displayName: "Galpão Vale",
    street: "Rua Agostinho Abifadel",
    streetNumber: "35",
    neighborhood: "Terra Nova",
    postalCode: "12081-670",
    ibgeCode: "3554102",
    cityName: "Taubaté",
    stateCode: "SP",
    isActive: true,
  });
  assert.deepEqual(getApprovedMunicipalityByCode("3554102"), {
    ibgeCode: "3554102",
    cityName: "Taubaté",
    stateCode: "SP",
  });
  assert.equal(
    normalizePickupLocationInput({
      locationCode: "UNKNOWN",
      displayName: "Local",
      street: "Rua A",
      streetNumber: "1",
      neighborhood: "Centro",
      postalCode: "12345678",
      ibgeCode: "3550308",
      isActive: false,
    }),
    null,
  );
  assert.equal(
    normalizePickupLocationInput({
      locationCode: "VALE",
      displayName: "Local",
      street: "Rua A",
      streetNumber: "1",
      neighborhood: "Centro",
      postalCode: "12-081-670",
      ibgeCode: "3554102",
      isActive: false,
    }),
    null,
  );
});

test("supplier update RPC payload includes the required display name", () => {
  assert.deepEqual(
    buildLogisticsSupplierUpdateArgs({
      supplierId: "5d4e4c8a-7a70-4b0a-bf36-0b056126dd59",
      displayName: "Fornecedor Vale",
      isActive: true,
      allowsPickup: true,
      allowsDelivery: true,
      leadMinBusinessDays: 2,
      leadMaxBusinessDays: 5,
      deliveryQuoteRequired: true,
      adminNotes: null,
    }),
    {
      p_supplier_id: "5d4e4c8a-7a70-4b0a-bf36-0b056126dd59",
      p_display_name: "Fornecedor Vale",
      p_is_active: true,
      p_allows_pickup: true,
      p_allows_delivery: true,
      p_lead_min_business_days: 2,
      p_lead_max_business_days: 5,
      p_delivery_quote_required: true,
      p_admin_notes: null,
    },
  );
});

test("pickup RPC payload distinguishes create, edit, activate and deactivate", () => {
  const fields = normalizePickupLocationInput({
    locationCode: "VALE_GALPAO",
    displayName: "Galpão Vale",
    street: "Rua Agostinho Abifadel",
    streetNumber: "35",
    neighborhood: "Terra Nova",
    postalCode: "12081670",
    ibgeCode: "3554102",
    isActive: false,
  });
  assert.ok(fields);

  const createArgs = buildLogisticsPickupLocationArgs(
    null,
    "5d4e4c8a-7a70-4b0a-bf36-0b056126dd59",
    fields,
  );
  assert.equal(createArgs.p_pickup_location_id, null);
  assert.equal(createArgs.p_is_active, false);
  assert.equal(createArgs.p_postal_code, "12081-670");
  assert.equal(createArgs.p_ibge_code, "3554102");

  const editAndActivateArgs = buildLogisticsPickupLocationArgs(
    "7db03b5b-22a2-49e5-a1d2-f860a312ff6c",
    "5d4e4c8a-7a70-4b0a-bf36-0b056126dd59",
    { ...fields, isActive: true },
  );
  assert.equal(
    editAndActivateArgs.p_pickup_location_id,
    "7db03b5b-22a2-49e5-a1d2-f860a312ff6c",
  );
  assert.equal(editAndActivateArgs.p_is_active, true);
});

test("normalizes official municipality labels for safe lookup comparisons", () => {
  assert.equal(
    normalizeMunicipalityName("  São José   dos Campos "),
    "sao jose dos campos",
  );
  assert.equal(normalizeMunicipalityName(null), "");
});

test("WhatsApp accepts only E.164 international numbers", () => {
  assert.equal(isValidWhatsappE164("+5512999999999"), true);
  assert.equal(isValidWhatsappE164("5512999999999"), false);
  assert.equal(isValidWhatsappE164("+01299999999"), false);
  assert.equal(isValidWhatsappE164("+1234567"), false);
});
