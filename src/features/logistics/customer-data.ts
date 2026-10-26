import "server-only";

import { getVerifiedCustomerSession } from "./server-session";
import { normalizeCustomerLogisticsQuoteList } from "./customer-quotes";
import type { CustomerLogisticsQuote } from "./types";

export type CustomerQuotesResult =
  | { status: "ok"; quotes: CustomerLogisticsQuote[] }
  | { status: "unauthenticated" }
  | { status: "not_configured" }
  | { status: "unavailable" };

export async function getCustomerLogisticsQuotes(): Promise<CustomerQuotesResult> {
  const session = await getVerifiedCustomerSession();
  if (!session) return { status: "unauthenticated" };

  try {
    const { data, error } = await session.client.rpc(
      "customer_list_my_logistics_quotes",
    );
    if (error) {
      return {
        status:
          error.code === "PGRST202" || error.code === "42883"
            ? "not_configured"
            : "unavailable",
      };
    }
    const quotes = normalizeCustomerLogisticsQuoteList(data);
    return quotes ? { status: "ok", quotes } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
