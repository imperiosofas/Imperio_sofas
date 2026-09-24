import type { Metadata } from "next";
import { AuthExperience } from "../../../features/auth/AuthExperience";
import { AccountHome } from "../../../features/auth/AccountHome";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { isSupabaseAuthConfigured } from "../../../lib/supabase/config";
import { getAccountAccess } from "../../../lib/supabase/account-access";

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
    const access = await getAccountAccess(supabase);
    if (access.status === "authenticated")
      return <AccountHome email={access.email} />;
    if (access.status === "mfa_required")
      return (
        <AuthExperience
          isConfigured={isSupabaseAuthConfigured()}
          nextPath={nextPath}
          initialError={null}
          initialMfaRequired
        />
      );
    if (access.status === "unavailable")
      return (
        <AuthExperience
          isConfigured={isSupabaseAuthConfigured()}
          nextPath={nextPath}
          initialError="Não foi possível confirmar a segurança da sessão. Tente novamente."
        />
      );
  }

  return (
    <AuthExperience
      isConfigured={isSupabaseAuthConfigured()}
      nextPath={nextPath}
      initialError={params.erro === "confirmacao" ? "confirmacao" : null}
    />
  );
}
