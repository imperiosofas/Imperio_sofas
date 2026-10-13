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

  const { data: membership, error: membershipError } = await supabase
    .from("catalog_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError || !membership) notFound();

  return supabase as SupabaseClient;
}
