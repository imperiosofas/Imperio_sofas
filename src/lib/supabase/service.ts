import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createSecretKeyFetch } from "./secret-key-fetch.mjs";

/** Returns only a boolean; never expose the privileged credential to callers. */
export function isSupabaseServiceConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    global: { fetch: createSecretKeyFetch(secretKey) },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
