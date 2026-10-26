const CART_SNAPSHOT_CODES = new Set(["40001", "P0001", "22023"]);

function normalizedMessage(error) {
  return [error?.message, error?.details, error?.hint]
    .filter((part) => typeof part === "string")
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

/** Maps only explicit, known database conflicts to safe customer-facing states. */
export function classifyQuoteRpcError(error) {
  if (!error || typeof error !== "object") return null;
  const message = normalizedMessage(error);
  if (
    message.includes("idempotency key reused with different input") ||
    message.includes("request fingerprint changed")
  ) {
    return "request_changed";
  }
  const isExplicitSnapshotConflict =
    message.includes("cart snapshot") ||
    message.includes("current cart snapshot") ||
    message.includes("cart contents changed") ||
    message.includes("item not eligible for logistics quote") ||
    /(?:cart|quote items?).{0,100}(?:snapshot|match|mismatch|changed|differ|not eligible|not exact)/.test(
      message,
    ) ||
    /(?:submitted )?quote groups.{0,100}(?:match|snapshot).{0,100}cart/.test(
      message,
    ) ||
    /(?:snapshot|mismatch|changed|differ).{0,100}cart/.test(message);
  if (
    error.code === "40001" ||
    (CART_SNAPSHOT_CODES.has(error.code) && isExplicitSnapshotConflict)
  ) {
    return "cart_changed";
  }
  return null;
}

/** An RPC error must never be interpreted as success, even if it carries a UUID. */
export function interpretQuoteRpcResult(data, rpcError, isUuid) {
  if (rpcError) {
    return { status: classifyQuoteRpcError(rpcError) ?? "backend_unavailable" };
  }
  if (!isUuid(data)) return { status: "backend_unavailable" };
  return { status: "ok", quoteId: data };
}
