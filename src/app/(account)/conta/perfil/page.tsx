import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell } from "../../../../features/account/AccountShell";
import { getAccountSnapshot } from "../../../../features/account/data";
import { ProfileEditor } from "../../../../features/account/ProfileEditor";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getAccountAccess } from "../../../../lib/supabase/account-access";

export const metadata: Metadata = {
  title: "Dados pessoais",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const access = await getAccountAccess(supabase);
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Fperfil");
  const snapshot = await getAccountSnapshot(access.userId);

  return (
    <AccountShell
      email={access.email}
      displayName={snapshot.displayName}
      isAdmin={snapshot.isAdmin}
      cartCount={snapshot.cartCount}
      active="profile"
    >
      <ProfileEditor
        displayName={snapshot.displayName}
        contactPhone={snapshot.contactPhone}
        email={access.email}
      />
    </AccountShell>
  );
}
