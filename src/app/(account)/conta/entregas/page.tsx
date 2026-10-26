import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell } from "../../../../features/account/AccountShell";
import { getAccountSnapshot } from "../../../../features/account/data";
import { getCustomerLogisticsQuotes } from "../../../../features/logistics/customer-data";
import { MyLogisticsQuotes } from "../../../../features/logistics/MyLogisticsQuotes";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getAccountAccess } from "../../../../lib/supabase/account-access";

export const metadata: Metadata = {
  title: "Minhas entregas",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AccountLogisticsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta?next=%2Fconta%2Fentregas");
  const access = await getAccountAccess(supabase);
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Fentregas");
  const [snapshot, quoteResult] = await Promise.all([
    getAccountSnapshot(access.userId),
    getCustomerLogisticsQuotes(),
  ]);

  return (
    <AccountShell
      email={access.email}
      displayName={snapshot.displayName}
      isAdmin={snapshot.isAdmin}
      cartCount={snapshot.cartCount}
      active="deliveries"
    >
      <MyLogisticsQuotes
        status={
          quoteResult.status === "ok"
            ? "ok"
            : quoteResult.status === "not_configured"
              ? "not_configured"
              : "unavailable"
        }
        quotes={quoteResult.status === "ok" ? quoteResult.quotes : []}
      />
    </AccountShell>
  );
}
