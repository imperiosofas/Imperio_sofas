/**
 * Keeps retries idempotent for the same in-memory request context and creates a
 * fresh key as soon as cart/address/mode inputs differ. It is not persistence.
 */
export function createQuoteIdempotency(makeId) {
  let fingerprint = null;
  let requestId = null;

  return {
    get(fingerprintValue) {
      if (requestId === null || fingerprint !== fingerprintValue) {
        fingerprint = fingerprintValue;
        requestId = makeId();
      }
      return requestId;
    },
    clear() {
      fingerprint = null;
      requestId = null;
    },
  };
}

export function getCartSnapshotFingerprint(cart) {
  return JSON.stringify(
    cart
      .map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        supplierCode: item.logistics?.supplierCode ?? null,
        availableForQuote: item.logistics?.availableForQuote ?? false,
        fulfillmentModes: [...(item.logistics?.fulfillmentModes ?? [])].sort(),
      }))
      .sort((left, right) => left.variantId.localeCompare(right.variantId)),
  );
}

export function getQuoteRequestFingerprint({
  cart,
  supplierModes,
  address,
  verifiedCep,
}) {
  const normalizedModes = supplierModes
    .map((choice) => ({
      supplierCode: choice.supplierCode,
      mode: choice.mode,
      pickupLocationId: choice.pickupLocationId,
    }))
    .sort((left, right) => left.supplierCode.localeCompare(right.supplierCode));

  const canonicalRequest = JSON.stringify({
    cart: getCartSnapshotFingerprint(cart),
    supplierModes: normalizedModes,
    address: address
      ? {
          postalCode: address.postalCode.replace(/\D/g, ""),
          floor: address.floor,
          number: address.number.trim(),
          complement: address.complement.trim(),
        }
      : null,
    verifiedCep: verifiedCep
      ? {
          postalCode: verifiedCep.postalCode,
          municipalityId: verifiedCep.municipalityId,
          city: verifiedCep.city,
          state: verifiedCep.state,
          street: verifiedCep.street,
          neighborhood: verifiedCep.neighborhood,
        }
      : null,
  });

  return globalThis.crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(canonicalRequest))
    .then((digest) =>
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    );
}
