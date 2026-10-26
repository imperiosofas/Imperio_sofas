import assert from "node:assert/strict";
import test from "node:test";
import {
  logisticsQuoteResponseSchema,
  quoteRequestSchema,
} from "../src/features/logistics/quote-input.mjs";
import { createQuoteRateLimiter } from "../src/features/logistics/quote-rate-limit.mjs";
import { executeWhenServiceConfigured } from "../src/features/logistics/quote-service-gate.mjs";

const validDeliveryRequest = {
  requestId: "4ca68d32-55a2-4eb2-b858-3c79e2de6764",
  supplierModes: [
    { supplierCode: "VALE", mode: "delivery", pickupLocationId: null },
  ],
  address: {
    postalCode: "12200-000",
    floor: 101,
    number: "55",
    complement: "Bloco B",
  },
};

test("accepts non-negative safe-integer floors above 100 without inventing a cap", () => {
  assert.equal(
    quoteRequestSchema.safeParse(validDeliveryRequest).success,
    true,
  );
  assert.equal(
    quoteRequestSchema.safeParse({
      ...validDeliveryRequest,
      address: {
        ...validDeliveryRequest.address,
        floor: Number.MAX_SAFE_INTEGER,
      },
    }).success,
    true,
  );
});

test("rejects negative, fractional, and unsafe floors", () => {
  for (const floor of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      quoteRequestSchema.safeParse({
        ...validDeliveryRequest,
        address: { ...validDeliveryRequest.address, floor },
      }).success,
      false,
      `floor ${String(floor)} must be rejected`,
    );
  }
});

test("rejects browser-supplied identity and derived CEP fields", () => {
  for (const forgedField of [
    { userId: "00000000-0000-4000-8000-000000000000" },
    { city: "São José dos Campos" },
    { street: "Rua inventada" },
    { ibgeCode: "3549904" },
  ]) {
    assert.equal(
      quoteRequestSchema.safeParse({ ...validDeliveryRequest, ...forgedField })
        .success,
      false,
    );
  }
});

test("requires a pickup location and prohibits Mundial pickup", () => {
  assert.equal(
    quoteRequestSchema.safeParse({
      requestId: validDeliveryRequest.requestId,
      supplierModes: [
        { supplierCode: "VALE", mode: "pickup", pickupLocationId: null },
      ],
    }).success,
    false,
  );
  assert.equal(
    quoteRequestSchema.safeParse({
      requestId: validDeliveryRequest.requestId,
      supplierModes: [
        {
          supplierCode: "MUNDIAL",
          mode: "pickup",
          pickupLocationId: "19ee9636-b83c-427c-a0b9-81e7b8f2da18",
        },
      ],
    }).success,
    false,
  );
});

test("requires delivery address and rejects unused address for pickup-only", () => {
  assert.equal(
    quoteRequestSchema.safeParse({
      requestId: validDeliveryRequest.requestId,
      supplierModes: validDeliveryRequest.supplierModes,
    }).success,
    false,
  );
  assert.equal(
    quoteRequestSchema.safeParse({
      requestId: validDeliveryRequest.requestId,
      supplierModes: [
        {
          supplierCode: "VALE",
          mode: "pickup",
          pickupLocationId: "19ee9636-b83c-427c-a0b9-81e7b8f2da18",
        },
      ],
      address: validDeliveryRequest.address,
    }).success,
    false,
  );
});

test("quote response accepts only a UUID and explicit boolean", () => {
  assert.equal(
    logisticsQuoteResponseSchema.safeParse({
      quoteId: validDeliveryRequest.requestId,
      accept: true,
    }).success,
    true,
  );
  assert.equal(
    logisticsQuoteResponseSchema.safeParse({
      quoteId: validDeliveryRequest.requestId,
      accept: "yes",
    }).success,
    false,
  );
});

test("rate limit is a bounded, process-local best-effort guard", () => {
  let now = 0;
  const limiter = createQuoteRateLimiter({
    now: () => now,
    windowMs: 1_000,
    maxAttempts: 2,
    maxKeys: 1,
  });
  assert.equal(limiter.consume("user-a").allowed, true);
  assert.equal(limiter.consume("user-a").allowed, true);
  assert.deepEqual(limiter.consume("user-a"), {
    allowed: false,
    retryAfterSeconds: 1,
  });
  assert.equal(limiter.consume("user-b").allowed, false);
  now = 1_001;
  assert.equal(limiter.consume("user-b").allowed, true);
  assert.equal(limiter.consume("user-a").allowed, false);
});

test("process-local rate limit state is not shared between limiter instances", () => {
  const firstInstance = createQuoteRateLimiter({ maxAttempts: 1 });
  const secondInstance = createQuoteRateLimiter({ maxAttempts: 1 });
  assert.equal(firstInstance.consume("same-user").allowed, true);
  assert.equal(firstInstance.consume("same-user").allowed, false);
  assert.equal(secondInstance.consume("same-user").allowed, true);
});

test("missing service configuration fails closed without invoking privileged work", async () => {
  let invoked = false;
  const result = await executeWhenServiceConfigured(false, async () => {
    invoked = true;
  });
  assert.deepEqual(result, { status: "configuration_pending" });
  assert.equal(invoked, false);
});
