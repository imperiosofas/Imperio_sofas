"use server";

import { createClient } from "@supabase/supabase-js";
import { getVerifiedCustomerSession } from "../logistics/server-session";

export type CurrentPasswordCheck = {
  ok: boolean;
  reason?: "mismatch" | "rate_limited" | "unavailable";
};

/**
 * Confirms the signed-in user's current password before a password change.
 * This is a UX guard: the server-side enforcement is Supabase's "require
 * current password when updating" setting (the client also sends
 * `current_password`). It
 * signs in with a throwaway, non-persistent client and ends that extra
 * session right away.
 */
export async function verifyCurrentPassword(
  password: unknown,
): Promise<CurrentPasswordCheck> {
  const session = await getVerifiedCustomerSession();
  if (!session) return { ok: false, reason: "unavailable" };
  const { data } = await session.client.auth.getUser();
  const user = data.user;
  // Accounts created with Google/Apple have no password to confirm yet.
  if (user && !user.identities?.some((i) => i.provider === "email"))
    return { ok: true };
  if (typeof password !== "string" || !password || password.length > 200)
    return { ok: false, reason: "mismatch" };
  const email = user?.email;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!email || !url || !key) return { ok: false, reason: "unavailable" };

  const probe = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: signIn, error } = await probe.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return {
      ok: false,
      reason: error.status === 429 ? "rate_limited" : "mismatch",
    };
  }
  // Only the probe's own session is revoked; the user's browser session stays.
  const { error: signOutError } = await probe.auth.signOut({ scope: "local" });
  if (signOutError)
    console.warn("verifyCurrentPassword: probe sign-out failed");
  if (signIn.user?.id !== session.userId)
    return { ok: false, reason: "mismatch" };
  return { ok: true };
}
