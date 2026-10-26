import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export type VerifiedCustomerSession = {
  client: SupabaseClient;
  userId: string;
};

/** Validate both the signed claims and the current Auth user on every call. */
export async function getVerifiedCustomerSession(): Promise<VerifiedCustomerSession | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;

  const { data: claimsData, error: claimsError } =
    await client.auth.getClaims();
  if (claimsError) return null;
  const claimsUserId = claimsData?.claims?.sub;
  if (typeof claimsUserId !== "string" || !claimsUserId) return null;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user?.id || userData.user.id !== claimsUserId) {
    return null;
  }

  return { client, userId: userData.user.id };
}
