import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AccountShell } from "../../../../features/account/AccountShell";
import { getAccountSnapshot } from "../../../../features/account/data";
import { listMyOrders } from "../../../../features/checkout/orders-data";
import {
  groupStatusLabel,
  orderStatusLabel,
} from "../../../../features/checkout/types";
import { formatBrlFromCents } from "../../../../lib/money";
import { getAccountAccess } from "../../../../lib/supabase/account-access";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Meus pedidos",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/conta");
  const access = await getAccountAccess(supabase);
  if (access.status !== "authenticated")
    redirect("/conta?next=%2Fconta%2Fpedidos");
  const [{ displayName, isAdmin, cartCount }, orders] = await Promise.all([
    getAccountSnapshot(access.userId),
    listMyOrders(),
  ]);

  return (
    <AccountShell
      email={access.email}
      displayName={displayName}
      isAdmin={isAdmin}
      cartCount={cartCount}
      active="orders"
    >
      <div className="min-h-[60vh] text-ivory">
        <h2 className="font-display text-4xl">Meus pedidos</h2>
        <p className="mb-6 mt-2 max-w-xl text-sm leading-6 text-muted">
          Acompanhe o pagamento e o andamento de cada entrega ou retirada.
        </p>
        {orders === null ? (
          <p className="text-muted">
            Não foi possível carregar seus pedidos agora. Tente novamente em
            instantes.
          </p>
        ) : orders.length ? (
          <ul className="grid gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/pedido/${order.id}`}
                  className="grid gap-2 rounded-2xl border border-white/15 bg-white/[0.03] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span className="grid gap-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <strong className="text-base">Pedido nº {order.order_number}</strong>
                      <span className="rounded-full bg-gold/15 px-3 py-0.5 text-xs font-semibold text-gold">
                        {orderStatusLabel[order.status]}
                      </span>
                    </span>
                    <span className="text-sm text-muted">
                      {dateFormat.format(new Date(order.created_at))} ·{" "}
                      {order.order_groups
                        .map(
                          (group) =>
                            `${group.supplier_name}: ${groupStatusLabel[group.status]}`,
                        )
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 font-semibold">
                    {formatBrlFromCents(order.total_cents)}
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-t border-white/20 py-10">
            <p className="text-ivory">Você ainda não fez nenhum pedido.</p>
            <p className="mt-2 text-sm text-muted">
              Quando você finalizar uma compra, ela aparece aqui.
            </p>
            <Link
              href="/loja"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-gold px-6 font-bold text-ink"
            >
              Explorar a loja
            </Link>
          </div>
        )}
      </div>
    </AccountShell>
  );
}
