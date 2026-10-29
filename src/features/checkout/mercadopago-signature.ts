import { createHmac, timingSafeEqual } from "node:crypto";

// Mercado Pago signs webhook notifications with an HMAC-SHA256 over a manifest
// built from the notification id, the request id and the signature timestamp.
// https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications

export function parseSignatureHeader(
  header: string | null | undefined,
): { ts: string; v1: string } | null {
  if (!header) return null;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  return ts && v1 ? { ts, v1 } : null;
}

export function buildManifest({
  dataId,
  requestId,
  ts,
}: {
  dataId: string | null | undefined;
  requestId: string | null | undefined;
  ts: string;
}) {
  const parts: string[] = [];
  if (dataId) {
    // Alphanumeric ids are compared in lower case.
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    parts.push(`id:${id};`);
  }
  if (requestId) parts.push(`request-id:${requestId};`);
  parts.push(`ts:${ts};`);
  return parts.join("");
}

export function verifyMercadoPagoSignature({
  secret,
  signatureHeader,
  requestId,
  dataId,
}: {
  secret: string;
  signatureHeader: string | null | undefined;
  requestId: string | null | undefined;
  dataId: string | null | undefined;
}): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed || !/^[0-9a-f]{64}$/i.test(parsed.v1)) return false;
  const expected = createHmac("sha256", secret)
    .update(buildManifest({ dataId, requestId, ts: parsed.ts }))
    .digest();
  const received = Buffer.from(parsed.v1, "hex");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
