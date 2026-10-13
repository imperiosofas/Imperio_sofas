import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSecurity } from "../../../../features/auth/AccountSecurity";
import { AccountShell } from "../../../../features/account/AccountShell";
import { getAccountSnapshot } from "../../../../features/account/data";
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
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Fseguranca");
  const [snapshot, userResult] = await Promise.all([
    getAccountSnapshot(access.userId),
    supabase.auth.getUser(),
  ]);
  return (
    <AccountShell
      email={access.email}
      displayName={snapshot.displayName}
      isAdmin={snapshot.isAdmin}
      cartCount={snapshot.cartCount}
      active="security"
    >
      <AccountSecurity
        email={access.email}
        pendingEmail={userResult.data.user?.new_email ?? null}
      />
    </AccountShell>
  );
}
