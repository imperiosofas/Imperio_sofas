import assert from "node:assert/strict";
import test from "node:test";
import {
  createQuoteIdempotency,
  getCartSnapshotFingerprint,
  getQuoteRequestFingerprint,
} from "../src/features/logistics/quote-idempotency.mjs";
import {
  classifyQuoteRpcError,
  interpretQuoteRpcResult,
} from "../src/features/logistics/quote-rpc-result.mjs";

const quoteId = "4ca68d32-55a2-4eb2-b858-3c79e2de6764";
const cart = [
  {
    variant_id: "64d50a10-7186-4e51-9e03-77c3f6e7656e",
    quantity: 1,
    logistics: {
      supplierCode: "VALE",
      availableForQuote: true,
      fulfillmentModes: ["delivery", "pickup"],
    },
  },
];
const supplierModes = [
  { supplierCode: "VALE", mode: "delivery", pickupLocationId: null },
];
const address = {
  postalCode: "12200-000",
  floor: 5,
  number: "55",
  complement: "Bloco B",
};
const verifiedCep = {
  postalCode: "12200000",
  municipalityId: "3549904",
  city: "São José dos Campos",
  state: "SP",
  street: "Rua Exemplo",
  neighborhood: "Centro",
};

test("maps explicit database cart-snapshot rejection to a safe conflict state", () => {
  assert.equal(
    classifyQuoteRpcError({
      code: "40001",
      message: "quote input is not the exact current cart snapshot",
    }),
    "cart_changed",
  );
  assert.equal(
    classifyQuoteRpcError({
      code: "22023",
      message: "cart snapshot does not match current cart",
    }),
    "cart_changed",
  );
  assert.equal(
    classifyQuoteRpcError({
      code: "22023",
      message: "submitted quote groups do not match current cart",
    }),
    "cart_changed",
  );
  assert.equal(
    classifyQuoteRpcError({
      code: "22023",
      message: "item not eligible for logistics quote",
    }),
    "cart_changed",
  );
});

test("maps reused idempotency input to a retryable request conflict", () => {
  assert.equal(
    classifyQuoteRpcError({
      code: "22023",
      message: "idempotency key reused with different input",
    }),
    "request_changed",
  );
  assert.equal(
    classifyQuoteRpcError({ code: "42501", message: "permission denied" }),
    null,
  );
});

test("never reports success when RPC rejects, even if response data contains a UUID", () => {
  assert.deepEqual(
    interpretQuoteRpcResult(
      quoteId,
      { code: "40001", message: "cart snapshot changed" },
      (value) => value === quoteId,
    ),
    { status: "cart_changed" },
  );
  assert.deepEqual(
    interpretQuoteRpcResult(
      quoteId,
      { code: "42501", message: "permission denied" },
      (value) => value === quoteId,
    ),
    { status: "backend_unavailable" },
  );
  assert.deepEqual(
    interpretQuoteRpcResult(quoteId, null, (value) => value === quoteId),
    { status: "ok", quoteId },
  );
});

test("idempotency reuses retries but rotates for cart/address changes or invalidation", async () => {
  let next = 0;
  const idempotency = createQuoteIdempotency(() => `request-${++next}`);
  const original = await getQuoteRequestFingerprint({
    cart,
    supplierModes,
    address,
    verifiedCep,
  });
  assert.equal(idempotency.get(original), "request-1");
  assert.equal(idempotency.get(original), "request-1");

  const quantityChanged = [{ ...cart[0], quantity: 2 }];
  assert.notEqual(
    getCartSnapshotFingerprint(cart),
    getCartSnapshotFingerprint(quantityChanged),
  );
  const changedCartFingerprint = await getQuoteRequestFingerprint({
    cart: quantityChanged,
    supplierModes,
    address,
    verifiedCep,
  });
  assert.equal(idempotency.get(changedCartFingerprint), "request-2");

  const changedAddressFingerprint = await getQuoteRequestFingerprint({
    cart: quantityChanged,
    supplierModes,
    address: { ...address, number: "57" },
    verifiedCep,
  });
  assert.equal(idempotency.get(changedAddressFingerprint), "request-3");
  idempotency.clear();
  assert.equal(idempotency.get(changedAddressFingerprint), "request-4");
});

test("request fingerprint changes for supplier mode or verified CEP data", async () => {
  const fingerprint = await getQuoteRequestFingerprint({
    cart,
    supplierModes,
    address,
    verifiedCep,
  });
  assert.notEqual(
    fingerprint,
    await getQuoteRequestFingerprint({
      cart,
      supplierModes: [
        { supplierCode: "VALE", mode: "pickup", pickupLocationId: quoteId },
      ],
      address,
      verifiedCep,
    }),
  );
  assert.notEqual(
    fingerprint,
    await getQuoteRequestFingerprint({
      cart,
      supplierModes,
      address,
      verifiedCep: { ...verifiedCep, neighborhood: "Outro bairro" },
    }),
  );
});

test("request fingerprint is an opaque SHA-256 digest, not serialized address data", async () => {
  const fingerprint = await getQuoteRequestFingerprint({
    cart,
    supplierModes,
    address,
    verifiedCep,
  });

  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint.includes(verifiedCep.street), false);
  assert.equal(fingerprint.includes(address.complement), false);
  assert.equal(fingerprint.includes(verifiedCep.city), false);
});
