import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSecurity } from "../../../../features/auth/AccountSecurity";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getAccountAccess } from "../../../../lib/supabase/account-access";

export const metadata: Metadata = {
  title: "Segurança da conta",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const access = await getAccountAccess(supabase);
  if (access.status === "mfa_required")
    redirect("/conta?mfa=required&next=%2Fconta%2Fseguranca");
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Fseguranca");
  return <AccountSecurity />;
}
