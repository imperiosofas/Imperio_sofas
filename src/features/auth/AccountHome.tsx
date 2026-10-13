import { AccountShell } from "../account/AccountShell";
import type { AccountSnapshot } from "../account/data";

export function AccountHome({
  email,
  snapshot,
}: {
  email: string;
  snapshot: AccountSnapshot;
}) {
  return (
    <AccountShell
      email={email}
      displayName={snapshot.displayName}
      isAdmin={snapshot.isAdmin}
      cartCount={snapshot.cartCount}
      active="home"
      showAccountMenu
    >
      <div className="hidden md:block">
        <p className="text-sm leading-7 text-muted">
          Acompanhe suas escolhas, gerencie seus dados e continue de onde parou.
        </p>
      </div>
    </AccountShell>
  );
}
