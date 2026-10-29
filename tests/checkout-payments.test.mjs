import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { resolvePaymentConfig } from "../src/features/checkout/payment-config.ts";
import {
  buildManifest,
  parseSignatureHeader,
  verifyMercadoPagoSignature,
} from "../src/features/checkout/mercadopago-signature.ts";
import {
  buildPreference,
  mapMercadoPagoStatus,
  reaisToCents,
} from "../src/features/checkout/mercadopago-map.ts";

const credentials = {
  MP_ACCESS_TOKEN: "test-token",
  MP_WEBHOOK_SECRET: "test-secret",
};

test("mock provider runs outside production only", () => {
  assert.deepEqual(
    resolvePaymentConfig({ APP_ENV: "staging", INTEGRATION_MODE: "mock" }),
    { status: "ready", provider: "mock" },
  );
  assert.deepEqual(resolvePaymentConfig({ APP_ENV: "local" }), {
    status: "ready",
    provider: "mock",
  });
  assert.deepEqual(
    resolvePaymentConfig({ APP_ENV: "production", INTEGRATION_MODE: "mock" }),
    { status: "disabled", reason: "mock_not_allowed_in_production" },
  );
});

test("empty or unknown environment disables payments", () => {
  assert.equal(resolvePaymentConfig({ APP_ENV: "" }).status, "disabled");
  assert.equal(resolvePaymentConfig({}).status, "disabled");
  assert.deepEqual(
    resolvePaymentConfig({ APP_ENV: "staging", INTEGRATION_MODE: "banana" }),
    { status: "disabled", reason: "invalid_integration_mode" },
  );
});

test("sandbox needs credentials and a sandbox provider environment", () => {
  assert.deepEqual(
    resolvePaymentConfig({ APP_ENV: "staging", INTEGRATION_MODE: "sandbox" }),
    { status: "disabled", reason: "missing_credentials" },
  );
  assert.deepEqual(
    resolvePaymentConfig({
      APP_ENV: "staging",
      INTEGRATION_MODE: "sandbox",
      MP_ENV: "live",
      ...credentials,
    }),
    { status: "disabled", reason: "provider_environment_mismatch" },
  );
  const ready = resolvePaymentConfig({
    APP_ENV: "staging",
    INTEGRATION_MODE: "sandbox",
    MP_ENV: "sandbox",
    ...credentials,
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.provider, "mercadopago");
  assert.equal(ready.environment, "sandbox");
});

test("sandbox is refused in production", () => {
  assert.deepEqual(
    resolvePaymentConfig({
      APP_ENV: "production",
      INTEGRATION_MODE: "sandbox",
      MP_ENV: "sandbox",
      ...credentials,
    }),
    { status: "disabled", reason: "sandbox_not_allowed_in_production" },
  );
});

test("live payments need production, live credentials and a collector id", () => {
  const base = {
    INTEGRATION_MODE: "live",
    MP_ENV: "live",
    ...credentials,
  };
  assert.deepEqual(resolvePaymentConfig({ ...base, APP_ENV: "staging" }), {
    status: "disabled",
    reason: "live_requires_production",
  });
  assert.deepEqual(resolvePaymentConfig({ ...base, APP_ENV: "production" }), {
    status: "disabled",
    reason: "missing_collector_id",
  });
  assert.deepEqual(
    resolvePaymentConfig({
      ...base,
      APP_ENV: "production",
      MP_ENV: "sandbox",
      MP_EXPECTED_COLLECTOR_ID: "123",
    }),
    { status: "disabled", reason: "provider_environment_mismatch" },
  );
  const ready = resolvePaymentConfig({
    ...base,
    APP_ENV: "production",
    MP_EXPECTED_COLLECTOR_ID: "123",
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.environment, "live");
  assert.equal(ready.expectedCollectorId, "123");
});

function sign({ secret, dataId, requestId, ts }) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

test("signature header parsing", () => {
  assert.deepEqual(parseSignatureHeader("ts=1700000000,v1=abc123"), {
    ts: "1700000000",
    v1: "abc123",
  });
  assert.equal(parseSignatureHeader("v1=abc"), null);
  assert.equal(parseSignatureHeader(""), null);
  assert.equal(parseSignatureHeader(null), null);
});

test("manifest lower-cases alphanumeric ids and omits missing parts", () => {
  assert.equal(
    buildManifest({ dataId: "ABC123", requestId: "req-1", ts: "99" }),
    "id:abc123;request-id:req-1;ts:99;",
  );
  assert.equal(
    buildManifest({ dataId: null, requestId: null, ts: "99" }),
    "ts:99;",
  );
});

test("valid signature is accepted", () => {
  const ts = "1700000000";
  const v1 = sign({ secret: "s3cret", dataId: "999", requestId: "r-1", ts });
  assert.equal(
    verifyMercadoPagoSignature({
      secret: "s3cret",
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestId: "r-1",
      dataId: "999",
    }),
    true,
  );
});

test("tampered, wrong-secret or malformed signatures are rejected", () => {
  const ts = "1700000000";
  const v1 = sign({ secret: "s3cret", dataId: "999", requestId: "r-1", ts });
  const header = `ts=${ts},v1=${v1}`;
  const base = { secret: "s3cret", signatureHeader: header, requestId: "r-1" };
  assert.equal(verifyMercadoPagoSignature({ ...base, dataId: "1000" }), false);
  assert.equal(
    verifyMercadoPagoSignature({ ...base, dataId: "999", secret: "other" }),
    false,
  );
  assert.equal(
    verifyMercadoPagoSignature({ ...base, dataId: "999", requestId: "r-2" }),
    false,
  );
  assert.equal(
    verifyMercadoPagoSignature({
      ...base,
      dataId: "999",
      signatureHeader: `ts=${ts},v1=zz`,
    }),
    false,
  );
  assert.equal(
    verifyMercadoPagoSignature({
      ...base,
      dataId: "999",
      signatureHeader: null,
    }),
    false,
  );
  assert.equal(
    verifyMercadoPagoSignature({ ...base, dataId: "999", secret: "" }),
    false,
  );
});

test("provider statuses map to internal statuses", () => {
  assert.equal(mapMercadoPagoStatus("approved"), "approved");
  assert.equal(mapMercadoPagoStatus("pending"), "pending");
  assert.equal(mapMercadoPagoStatus("in_process"), "in_process");
  assert.equal(mapMercadoPagoStatus("authorized"), "in_process");
  assert.equal(mapMercadoPagoStatus("rejected"), "rejected");
  assert.equal(mapMercadoPagoStatus("cancelled"), "cancelled");
  assert.equal(mapMercadoPagoStatus("refunded"), "refunded");
  assert.equal(mapMercadoPagoStatus("charged_back"), "refunded");
  assert.equal(mapMercadoPagoStatus("whatever"), null);
  assert.equal(mapMercadoPagoStatus(undefined), null);
});

test("provider amounts convert to exact cents", () => {
  assert.equal(reaisToCents(3828), 382800);
  assert.equal(reaisToCents(10.1), 1010);
  assert.equal(reaisToCents(0.29), 29);
  assert.equal(reaisToCents(1299.99), 129999);
  assert.equal(reaisToCents(10.005), null);
  assert.equal(reaisToCents(-1), null);
  assert.equal(reaisToCents(Number.NaN), null);
});

test("the preference total equals the order total, freight and floor included", () => {
  const order = {
    id: "11111111-1111-4111-8111-111111111111",
    orderNumber: 1001,
    email: "cliente@example.com",
    items: [
      { name: "Sofá Berlim", quantity: 1, unitPriceCents: 382800 },
      { name: "Cama Lopas", quantity: 2, unitPriceCents: 129900 },
    ],
    freightCents: 30000,
    floorChargeCents: 1000,
    expiresAt: "2026-10-28T20:00:00.000Z",
  };
  const preference = buildPreference(order, {
    notification: "https://loja.example/api/webhooks/mercadopago",
    success: "https://loja.example/ok",
    pending: "https://loja.example/pendente",
    failure: "https://loja.example/falha",
  });
  const total = preference.items.reduce(
    (sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity,
    0,
  );
  assert.equal(total, 382800 + 2 * 129900 + 30000 + 1000);
  assert.equal(preference.external_reference, order.id);
  assert.equal(preference.items.at(-1).title, "Adicional por andar");
  assert.equal(preference.payer.email, "cliente@example.com");
  assert.equal(preference.auto_return, "approved");
});

test("a pickup order has no freight lines", () => {
  const preference = buildPreference(
    {
      id: "22222222-2222-4222-8222-222222222222",
      orderNumber: 1002,
      email: null,
      items: [{ name: "Poltrona Josy", quantity: 1, unitPriceCents: 39900 }],
      freightCents: 0,
      floorChargeCents: 0,
      expiresAt: "2026-10-28T20:00:00.000Z",
    },
    {
      notification: "https://loja.example/n",
      success: "https://loja.example/s",
      pending: "https://loja.example/p",
      failure: "https://loja.example/f",
    },
  );
  assert.equal(preference.items.length, 1);
  assert.equal("payer" in preference, false);
});
