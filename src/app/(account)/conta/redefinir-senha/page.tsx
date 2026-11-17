import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PASSWORD_RECOVERY_COOKIE } from "../../../../lib/auth/password-recovery";
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
  if (access.status !== "authenticated") redirect("/conta");
  const store = await cookies();
  // The marker must belong to the signed-in user (another account signing in
  // on the same browser within 15 minutes does not inherit it).
  if (store.get(PASSWORD_RECOVERY_COOKIE)?.value !== access.userId)
    redirect("/conta/seguranca");
  return <PasswordReset />;
}
