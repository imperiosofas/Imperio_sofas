import "server-only";

import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";

export async function requireCatalogAdmin(returnTo = "/admin") {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") {
    redirect(`/conta?next=${encodeURIComponent(returnTo)}`);
  }
  // getClaims() only checks the JWT locally; getUser() asks Supabase Auth, so
  // a session revoked by logout stops granting admin access immediately.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || userData.user?.id !== userId) {
    redirect(`/conta?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("catalog_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError || !membership) notFound();

  return supabase as SupabaseClient;
}
