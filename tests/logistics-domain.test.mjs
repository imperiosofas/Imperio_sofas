import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCartLogistics,
  calculateFloorSurchargeCents,
  createLogisticsFingerprint,
  getAllowedLogisticsModes,
  getLogisticsLeadTime,
  isLogisticsQuoteCurrent,
  isValidDeliveryFloor,
  isValidLogisticsPostalCode,
  normalizeLogisticsPostalCode,
  validateSupplierMode,
} from "../src/features/logistics/domain.ts";

test("Vale allows pickup and delivery; Mundial allows delivery only", () => {
  assert.deepEqual(getAllowedLogisticsModes("VALE"), ["pickup", "delivery"]);
  assert.deepEqual(getAllowedLogisticsModes("MUNDIAL"), ["delivery"]);
  assert.deepEqual(getAllowedLogisticsModes(undefined), []);
  assert.deepEqual(validateSupplierMode("VALE", "pickup"), {
    valid: true,
    supplierCode: "VALE",
    mode: "pickup",
  });
  assert.equal(validateSupplierMode("VALE", "delivery").valid, true);
  assert.equal(validateSupplierMode("MUNDIAL", "delivery").valid, true);
  assert.deepEqual(validateSupplierMode("MUNDIAL", "pickup"), {
    valid: false,
    reason: "mode_not_supported",
  });
  assert.deepEqual(validateSupplierMode(undefined, "delivery"), {
    valid: false,
    reason: "supplier_unassigned",
  });
  assert.deepEqual(validateSupplierMode("UNKNOWN", "delivery"), {
    valid: false,
    reason: "invalid_supplier",
  });
  assert.deepEqual(validateSupplierMode("VALE", "shipping"), {
    valid: false,
    reason: "invalid_mode",
  });
});

test("normalizes only valid eight-digit CEP input", () => {
  assert.equal(normalizeLogisticsPostalCode("12081670"), "12081670");
  assert.equal(normalizeLogisticsPostalCode("12081-670"), "12081670");
  assert.equal(normalizeLogisticsPostalCode("12081 670"), "12081670");
  assert.equal(isValidLogisticsPostalCode("12081-670"), true);
  assert.equal(normalizeLogisticsPostalCode("1208"), null);
  assert.equal(normalizeLogisticsPostalCode("12081-67A"), null);
  assert.equal(normalizeLogisticsPostalCode("A12081670"), null);
  assert.equal(normalizeLogisticsPostalCode("12081--670"), null);
  assert.equal(normalizeLogisticsPostalCode(null), null);
  assert.equal(isValidLogisticsPostalCode("12.081-670"), false);
});

test("validates non-negative integer floors without inventing a maximum floor", () => {
  for (const floor of [0, 1, 4, 5, 100])
    assert.equal(isValidDeliveryFloor(floor), true);
  for (const floor of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "5"])
    assert.equal(isValidDeliveryFloor(floor), false);
});

test("calculates the confirmed per-floor surcharge in integer cents", () => {
  assert.deepEqual(calculateFloorSurchargeCents(0, "delivery"), {
    ok: true,
    amountCents: 0,
  });
  assert.deepEqual(calculateFloorSurchargeCents(4, "delivery"), {
    ok: true,
    amountCents: 0,
  });
  assert.deepEqual(calculateFloorSurchargeCents(5, "delivery"), {
    ok: true,
    amountCents: 1_000,
  });
  assert.deepEqual(calculateFloorSurchargeCents(6, "delivery"), {
    ok: true,
    amountCents: 2_000,
  });
  assert.deepEqual(calculateFloorSurchargeCents(7, "delivery"), {
    ok: true,
    amountCents: 3_000,
  });
  assert.deepEqual(calculateFloorSurchargeCents(8, "delivery"), {
    ok: true,
    amountCents: 4_000,
  });
  assert.deepEqual(calculateFloorSurchargeCents(8, "pickup"), {
    ok: true,
    amountCents: 0,
  });
  assert.deepEqual(calculateFloorSurchargeCents(-1, "delivery"), {
    ok: false,
    reason: "invalid_floor",
  });
  assert.deepEqual(calculateFloorSurchargeCents(5.5, "delivery"), {
    ok: false,
    reason: "invalid_floor",
  });
  assert.deepEqual(calculateFloorSurchargeCents(5, "pickup-now"), {
    ok: false,
    reason: "invalid_mode",
  });
  assert.deepEqual(
    calculateFloorSurchargeCents(Number.MAX_SAFE_INTEGER, "delivery"),
    { ok: false, reason: "amount_overflow" },
  );
});

test("provides business-day lead times without promising an exact date", () => {
  const valePickup = getLogisticsLeadTime("VALE", "pickup");
  const valeDelivery = getLogisticsLeadTime("VALE", "delivery");
  const mundialDelivery = getLogisticsLeadTime("MUNDIAL", "delivery");

  assert.equal(valePickup.minBusinessDays, 7);
  assert.equal(valePickup.maxBusinessDays, 7);
  assert.equal(valePickup.startsAfter, "payment_confirmed");
  assert.equal(
    valePickup.label,
    "Prazo informado para retirada: 7 dias úteis após a confirmação do pagamento; a data de liberação será confirmada pela loja.",
  );
  assert.equal(valeDelivery.minBusinessDays, 7);
  assert.equal(valeDelivery.maxBusinessDays, 7);
  assert.match(valeDelivery.label, /frete depende de cotação/);
  assert.equal(mundialDelivery.minBusinessDays, 30);
  assert.equal(mundialDelivery.maxBusinessDays, 45);
  assert.equal(mundialDelivery.startsAfter, "payment_confirmed");
  assert.match(mundialDelivery.label, /30 a 45 dias úteis/);
  assert.match(mundialDelivery.label, /frete é negociado antes da compra/);
  assert.doesNotMatch(mundialDelivery.label, /\b\d{2}\/\d{2}\/\d{4}\b/);
  assert.equal(getLogisticsLeadTime(undefined, "delivery"), null);
  assert.equal(getLogisticsLeadTime("MUNDIAL", "pickup"), null);
});

test("groups supplier and mode conditions and charges one mixed-cart delivery once", () => {
  const result = calculateCartLogistics(
    [
      {
        variantKey: "vale-sofa-1",
        supplierCode: "VALE",
        mode: "pickup",
        quantity: 1,
      },
      {
        variantKey: "mundial-sofa-1",
        supplierCode: "MUNDIAL",
        mode: "delivery",
        quantity: 2,
      },
    ],
    6,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.groups.map(({ supplierCode, mode, quantityTotal }) => ({
      supplierCode,
      mode,
      quantityTotal,
    })),
    [
      { supplierCode: "VALE", mode: "pickup", quantityTotal: 1 },
      { supplierCode: "MUNDIAL", mode: "delivery", quantityTotal: 2 },
    ],
  );
  assert.equal(result.floorSurchargeCents, 2_000);
});

test("does not duplicate a surcharge across supplier delivery groups", () => {
  const result = calculateCartLogistics(
    [
      {
        variantKey: "vale-sofa-1",
        supplierCode: "VALE",
        mode: "delivery",
        quantity: 1,
      },
      {
        variantKey: "mundial-sofa-1",
        supplierCode: "MUNDIAL",
        mode: "delivery",
        quantity: 1,
      },
      {
        variantKey: "mundial-sofa-2",
        supplierCode: "MUNDIAL",
        mode: "delivery",
        quantity: 2,
      },
    ],
    5,
  );

  assert.equal(result.ok, true);
  assert.equal(result.groups.length, 2);
  assert.equal(result.floorSurchargeCents, 1_000);
  assert.equal(result.groups[1].quantityTotal, 3);
});

test("pickup-only carts do not require a delivery floor or add a surcharge", () => {
  assert.deepEqual(
    calculateCartLogistics([
      {
        variantKey: "vale-sofa-1",
        supplierCode: "VALE",
        mode: "pickup",
        quantity: 1,
      },
    ]),
    {
      ok: true,
      groups: [
        {
          supplierCode: "VALE",
          mode: "pickup",
          variantKeys: ["vale-sofa-1"],
          quantityTotal: 1,
          leadTime: getLogisticsLeadTime("VALE", "pickup"),
        },
      ],
      floorSurchargeCents: 0,
    },
  );
});

test("rejects unclassified, incompatible, malformed, and invalid-floor carts", () => {
  assert.deepEqual(
    calculateCartLogistics([
      {
        variantKey: "unclassified",
        supplierCode: undefined,
        mode: "delivery",
        quantity: 1,
      },
    ]),
    {
      ok: false,
      reason: "supplier_unassigned",
      variantKey: "unclassified",
    },
  );
  assert.deepEqual(
    calculateCartLogistics([
      {
        variantKey: "mundial-pickup",
        supplierCode: "MUNDIAL",
        mode: "pickup",
        quantity: 1,
      },
    ]),
    {
      ok: false,
      reason: "mode_not_supported",
      variantKey: "mundial-pickup",
    },
  );
  assert.deepEqual(
    calculateCartLogistics(
      [
        {
          variantKey: "vale-delivery",
          supplierCode: "VALE",
          mode: "delivery",
          quantity: 1,
        },
      ],
      2.5,
    ),
    { ok: false, reason: "invalid_floor" },
  );
  assert.deepEqual(
    calculateCartLogistics([
      {
        variantKey: "invalid-quantity",
        supplierCode: "VALE",
        mode: "pickup",
        quantity: 0,
      },
    ]),
    {
      ok: false,
      reason: "invalid_quantity",
      variantKey: "invalid-quantity",
    },
  );
});

test("invalidates a quote when cart or delivery conditions change", () => {
  const original = {
    items: [
      {
        variantKey: "vale-variant",
        supplierCode: "VALE",
        mode: "delivery",
        quantity: 1,
      },
      {
        variantKey: "mundial-variant",
        supplierCode: "MUNDIAL",
        mode: "delivery",
        quantity: 2,
      },
    ],
    destinationFingerprint: "server-derived-address-v1",
    floor: 5,
    conditionsRevision: "delivery-terms-v1",
  };
  const quoteFingerprint = createLogisticsFingerprint(original);

  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      items: [...original.items].reverse(),
    }),
    true,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      items: original.items.map((item) =>
        item.variantKey === "vale-variant" ? { ...item, quantity: 2 } : item,
      ),
    }),
    false,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      destinationFingerprint: "server-derived-address-v2",
    }),
    false,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, { ...original, floor: 6 }),
    false,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      conditionsRevision: "delivery-terms-v2",
    }),
    false,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      items: original.items.slice(1),
    }),
    false,
  );
  assert.equal(
    isLogisticsQuoteCurrent(quoteFingerprint, {
      ...original,
      items: [
        { ...original.items[0], supplierCode: undefined },
        original.items[1],
      ],
    }),
    false,
  );
  assert.equal(isLogisticsQuoteCurrent(quoteFingerprint, original), true);
});

test("fingerprints are stable for pickup-only carts and reject invalid quotes", () => {
  const pickup = {
    items: [
      {
        variantKey: "vale-variant",
        supplierCode: "VALE",
        mode: "pickup",
        quantity: 1,
      },
    ],
    conditionsRevision: "pickup-terms-v1",
  };
  const fingerprint = createLogisticsFingerprint(pickup);

  assert.equal(
    isLogisticsQuoteCurrent(fingerprint, {
      ...pickup,
      floor: 8,
      destinationFingerprint: "not-applicable-to-pickup",
    }),
    true,
  );
  assert.equal(isLogisticsQuoteCurrent(undefined, pickup), false);
  assert.throws(
    () =>
      createLogisticsFingerprint({
        ...pickup,
        items: [{ ...pickup.items[0], supplierCode: undefined }],
      }),
    /supplier_unassigned/,
  );
  assert.throws(
    () =>
      createLogisticsFingerprint({
        ...pickup,
        items: [
          { ...pickup.items[0], supplierCode: "MUNDIAL", mode: "pickup" },
        ],
      }),
    /mode_not_supported/,
  );
});
