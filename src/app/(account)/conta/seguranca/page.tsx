import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSecurity } from "../../../../features/auth/AccountSecurity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Segurança da conta",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.email !== "string")
    redirect("/conta?next=%2Fconta%2Fseguranca");
  return <AccountSecurity />;
}
