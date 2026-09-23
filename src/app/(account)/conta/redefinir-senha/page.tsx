import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordReset } from "../../../../features/auth/PasswordReset";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PasswordResetPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.email !== "string") redirect("/conta");
  return <PasswordReset />;
}
