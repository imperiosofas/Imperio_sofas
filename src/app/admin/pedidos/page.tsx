import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import { formatBrlFromCents } from "../../../lib/money";
import {
  orderStatusLabel,
  orderStatusSchema,
} from "../../../features/checkout/types";
import styles from "./orders.module.css";

export const metadata: Metadata = {
  title: "Pedidos | Administração",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const rowSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number(),
  status: orderStatusSchema,
  total_cents: z.number(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  item_count: z.number(),
  modes: z.string(),
});

const summarySchema = z.object({
  total: z.number(),
  pending_payment: z.number(),
  paid: z.number(),
  needs_review: z.number(),
  revenue_cents: z.number(),
  average_ticket_cents: z.number(),
});

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending_payment", label: "Aguardando pagamento" },
  { value: "paid", label: "Pagos" },
  { value: "needs_review", label: "Em análise" },
  { value: "closed", label: "Encerrados" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const CLOSED = new Set(["cancelled", "expired", "refunded"]);
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function pillClass(status: z.infer<typeof orderStatusSchema>) {
  if (status === "paid") return styles.pillOk;
  if (status === "needs_review") return styles.pillAlert;
  if (status === "pending_payment") return styles.pillWarn;
  return "";
}

function modeText(modes: string) {
  const parts = modes.split(",").filter(Boolean);
  return parts
    .map((mode) => (mode === "pickup" ? "Retirada" : "Entrega"))
    .join(" + ");
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const client = await requireCatalogAdmin("/admin/pedidos");
  const { status } = await searchParams;
  const filter: Filter = FILTERS.some((item) => item.value === status)
    ? (status as Filter)
    : "all";

  // Free stock held by unpaid orders whose window has passed (service role).
  const { releaseExpiredOrders } =
    await import("../../../features/checkout/payment-service");
  await releaseExpiredOrders();

  const rpcStatus = filter === "all" || filter === "closed" ? null : filter;
  const [listResult, summaryResult] = await Promise.all([
    client.rpc("admin_list_orders", { p_status: rpcStatus, p_limit: 200 }),
    client.rpc("admin_get_orders_summary"),
  ]);
  if (listResult.error)
    throw new Error("Não foi possível carregar os pedidos.");
  let rows = z.array(rowSchema).parse(listResult.data ?? []);
  if (filter === "closed") rows = rows.filter((row) => CLOSED.has(row.status));
  const summary = summarySchema.safeParse(summaryResult.data);

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Vendas</p>
        <h1>Pedidos</h1>
        <p className={styles.lead}>
          Acompanhe o pagamento e o andamento de cada entrega ou retirada. O
          dinheiro só é considerado recebido quando o provedor de pagamento
          confirma o valor exato do pedido.
        </p>
      </div>

      {summary.success && (
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Pedidos pagos</p>
            <p className={styles.tileValue}>{summary.data.paid}</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Aguardando pagamento</p>
            <p className={styles.tileValue}>{summary.data.pending_payment}</p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Receita (pagos)</p>
            <p className={styles.tileValue}>
              {formatBrlFromCents(summary.data.revenue_cents)}
            </p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Ticket médio</p>
            <p className={styles.tileValue}>
              {summary.data.paid
                ? formatBrlFromCents(summary.data.average_ticket_cents)
                : "—"}
            </p>
          </div>
        </div>
      )}

      <nav aria-label="Filtrar pedidos" className={styles.filters}>
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={
              item.value === "all"
                ? "/admin/pedidos"
                : `/admin/pedidos?status=${item.value}`
            }
            aria-current={filter === item.value ? "page" : undefined}
          >
            {item.label}
            {item.value === "needs_review" &&
            summary.success &&
            summary.data.needs_review > 0
              ? ` (${summary.data.needs_review})`
              : ""}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.card}>
              <Link href={`/admin/pedidos/${row.id}`}>
                <span className={styles.cardTop}>
                  <strong>Pedido nº {row.order_number}</strong>
                  <span className={`${styles.pill} ${pillClass(row.status)}`}>
                    {orderStatusLabel[row.status]}
                  </span>
                </span>
                <span className={styles.meta}>
                  <span>{formatBrlFromCents(row.total_cents)}</span>
                  <span>
                    {row.item_count} {row.item_count === 1 ? "item" : "itens"}
                  </span>
                  <span>{modeText(row.modes)}</span>
                  <span>{dateFormat.format(new Date(row.created_at))}</span>
                </span>
                <span className={styles.meta}>
                  <span>
                    {row.customer_name || row.customer_email || "Cliente"}
                  </span>
                  {row.customer_name && row.customer_email && (
                    <span>{row.customer_email}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          {filter === "all"
            ? "Ainda não há pedidos. Quando um cliente finalizar uma compra, ela aparece aqui."
            : "Nenhum pedido neste filtro."}
        </p>
      )}
    </section>
  );
}
