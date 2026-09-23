import type { Metadata } from "next";
import { AuthExperience } from "../../../features/auth/AuthExperience";
import { AccountHome } from "../../../features/auth/AccountHome";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { isSupabaseAuthConfigured } from "../../../lib/supabase/config";

export const metadata: Metadata = {
  title: "Minha conta",
  description: "Acesse sua conta Império Sofás com segurança.",
  robots: { index: false, follow: false },
};

function safeNextPath(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/conta";
  }
  return value;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    const email =
      typeof data?.claims?.email === "string" ? data.claims.email : null;
    if (email) return <AccountHome email={email} />;
  }

  return (
    <AuthExperience
      isConfigured={isSupabaseAuthConfigured()}
      nextPath={nextPath}
      initialError={typeof params.erro === "string" ? params.erro : null}
    />
  );
}
