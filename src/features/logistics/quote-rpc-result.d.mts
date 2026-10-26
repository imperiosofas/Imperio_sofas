export type QuoteRpcFailure =
  | { status: "cart_changed" }
  | { status: "request_changed" }
  | { status: "backend_unavailable" };

export function classifyQuoteRpcError(
  error: unknown,
): "cart_changed" | "request_changed" | null;

export function interpretQuoteRpcResult(
  data: unknown,
  rpcError: unknown,
  isUuid: (value: unknown) => value is string,
): QuoteRpcFailure | { status: "ok"; quoteId: string };
