import type { Metadata } from "next";
import { AuthExperience } from "../../../features/auth/AuthExperience";
import { AccountHome } from "../../../features/auth/AccountHome";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { isSupabaseAuthConfigured } from "../../../lib/supabase/config";
import { getAccountAccess } from "../../../lib/supabase/account-access";
import { getSafeAuthReturnTo } from "../../../lib/auth-return-to";
import { redirect } from "next/navigation";
import { getAccountSnapshot } from "../../../features/account/data";

export const metadata: Metadata = {
  title: "Minha conta",
  description: "Acesse sua conta Império Sofás com segurança.",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = getSafeAuthReturnTo(
    typeof params.next === "string" ? params.next : undefined,
  );
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const access = await getAccountAccess(supabase);
    if (access.status === "authenticated" && nextPath !== "/conta")
      redirect(nextPath);
    if (access.status === "authenticated") {
      const snapshot = await getAccountSnapshot(access.userId);
      return <AccountHome email={access.email} snapshot={snapshot} />;
    }
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
      initialError={
        params.erro === "confirmacao" || params.erro === "oauth"
          ? params.erro
          : null
      }
    />
  );
}
