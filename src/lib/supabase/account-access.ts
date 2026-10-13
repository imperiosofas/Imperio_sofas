import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountAccess =
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "authenticated"; email: string; userId: string };

/** Require a verified session; MFA is optional and is not an access gate. */
export async function getAccountAccess(
  supabase: SupabaseClient,
): Promise<AccountAccess> {
  const { data, error } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  const userId = data?.claims?.sub;

  if (
    error ||
    typeof email !== "string" ||
    !email ||
    typeof userId !== "string" ||
    !userId
  ) {
    return { status: "unauthenticated" };
  }
  return { status: "authenticated", email, userId };
}
