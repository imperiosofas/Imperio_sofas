import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountAccess =
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "mfa_required"; email: string }
  | { status: "authenticated"; email: string };

/** Fail-closed server check for pages that expose account data or controls. */
export async function getAccountAccess(
  supabase: SupabaseClient,
): Promise<AccountAccess> {
  const { data, error } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  if (error || typeof email !== "string" || !email) {
    return { status: "unauthenticated" };
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || !assurance) return { status: "unavailable" };
  if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
    return { status: "mfa_required", email };
  }

  return { status: "authenticated", email };
}
