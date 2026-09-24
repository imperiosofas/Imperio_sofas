import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordReset } from "../../../../features/auth/PasswordReset";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getAccountAccess } from "../../../../lib/supabase/account-access";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PasswordResetPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const access = await getAccountAccess(supabase);
  if (access.status === "mfa_required")
    redirect("/conta?mfa=required&next=%2Fconta%2Fredefinir-senha");
  if (access.status !== "authenticated") redirect("/conta");
  return <PasswordReset />;
}
