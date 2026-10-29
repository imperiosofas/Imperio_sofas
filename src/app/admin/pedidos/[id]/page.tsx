import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCatalogAdmin } from "../../../../lib/supabase/admin-access";
import { formatBrlFromCents } from "../../../../lib/money";
import {
  groupStatusLabel,
  groupStatusSchema,
  leadTimeText,
  orderStatusLabel,
  orderStatusSchema,
} from "../../../../features/checkout/types";
import styles from "../orders.module.css";

export const metadata: Metadata = {
  title: "Pedido | Administração",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number(),
  unit_price_cents: z.number(),
  line_total_cents: z.number(),
});
const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number(),
  status: orderStatusSchema,
  items_subtotal_cents: z.number(),
  freight_cents: z.number(),
  floor_charge_cents: z.number(),
  total_cents: z.number(),
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
  delivery_postal_code: z.string().nullable(),
  delivery_street: z.string().nullable(),
  delivery_number: z.string().nullable(),
  delivery_complement: z.string().nullable(),
  delivery_neighborhood: z.string().nullable(),
  delivery_city: z.string().nullable(),
  delivery_state: z.string().nullable(),
  delivery_floor: z.number().nullable(),
  payment_expires_at: z.string(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  cancel_reason: z.string().nullable(),
  groups: z.array(
    z.object({
      id: z.string().uuid(),
      supplier_code: z.string(),
      supplier_name: z.string(),
      fulfillment_mode: z.enum(["delivery", "pickup"]),
      pickup_label: z.string().nullable(),
      base_freight_cents: z.number(),
      lead_min_business_days: z.number().nullable(),
      lead_max_business_days: z.number().nullable(),
      status: groupStatusSchema,
      items: z.array(itemSchema),
    }),
  ),
  payments: z.array(
    z.object({
      provider: z.string(),
      status: z.string(),
      amount_cents: z.number(),
      created_at: z.string(),
      approved_at: z.string().nullable(),
    }),
  ),
  events: z.array(
    z.object({
      event_type: z.string(),
      actor_type: z.string(),
      occurred_at: z.string(),
    }),
  ),
});

const eventLabels: Record<string, string> = {
  order_created: "Pedido criado",
  order_cancelled: "Pedido cancelado",
  order_expired: "Prazo de pagamento terminou",
  payment_started: "Pagamento iniciado",
  payment_approved: "Pagamento aprovado",
  payment_pending: "Pagamento pendente",
  payment_in_process: "Pagamento em análise no provedor",
  payment_rejected: "Pagamento recusado",
  payment_cancelled: "Pagamento cancelado",
  payment_refunded: "Pagamento reembolsado",
  payment_amount_mismatch: "Valor pago diferente do pedido (conferir)",
  late_payment_recovered: "Pagamento tardio aceito",
  late_payment_no_stock: "Pagamento tardio sem estoque (conferir)",
  group_ready_for_pickup: "Pronto para retirada",
  group_out_for_delivery: "Saiu para entrega",
  group_completed: "Concluído",
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function advanceGroup(formData: FormData) {
  "use server";
  const client = await requireCatalogAdmin("/admin/pedidos");
  const groupId = z.string().uuid().safeParse(formData.get("groupId"));
  const orderId = z.string().uuid().safeParse(formData.get("orderId"));
  const next = groupStatusSchema.safeParse(formData.get("next"));
  if (!groupId.success || !orderId.success || !next.success) return;
  const { error } = await client.rpc("admin_set_order_group_status", {
    p_group_id: groupId.data,
    p_status: next.data,
  });
  if (error) throw new Error("Não foi possível atualizar o andamento.");
  revalidatePath(`/admin/pedidos/${orderId.data}`);
  revalidatePath("/admin/pedidos");
}

function nextStep(
  status: z.infer<typeof groupStatusSchema>,
  mode: "delivery" | "pickup",
): { next: z.infer<typeof groupStatusSchema>; label: string } | null {
  if (status === "preparing")
    return mode === "pickup"
      ? { next: "ready_for_pickup", label: "Marcar como pronto para retirada" }
      : { next: "out_for_delivery", label: "Marcar como saiu para entrega" };
  if (status === "ready_for_pickup")
    return { next: "completed", label: "Confirmar retirada concluída" };
  if (status === "out_for_delivery")
    return { next: "completed", label: "Confirmar entrega concluída" };
  return null;
}

function whatsappLink(phone: string, orderNumber: number) {
  const text = `Olá! Aqui é da Império Sofás sobre o seu pedido nº ${orderNumber}.`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const client = await requireCatalogAdmin(`/admin/pedidos/${id}`);
  const { data, error } = await client.rpc("admin_get_order", {
    p_order_id: id,
  });
  if (error) throw new Error("Não foi possível carregar o pedido.");
  if (!data) notFound();
  const order = orderSchema.parse(data);

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <Link href="/admin/pedidos" className={styles.back}>
          ← Pedidos
        </Link>
        <p className={styles.eyebrow}>Pedido nº {order.order_number}</p>
        <h1>{orderStatusLabel[order.status]}</h1>
        <p className={styles.lead}>
          Criado em {dateFormat.format(new Date(order.created_at))}
          {order.paid_at
            ? ` · pago em ${dateFormat.format(new Date(order.paid_at))}`
            : ""}
          {order.cancel_reason ? ` · motivo: ${order.cancel_reason}` : ""}
        </p>
      </div>

      {order.status === "needs_review" && (
        <p className={styles.section} role="alert">
          Este pedido precisa de conferência: o valor recebido não bateu com o
          total ou o pagamento chegou depois de o estoque ser liberado. Confira
          no painel do provedor antes de qualquer envio.
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.stack}>
          {order.groups.map((group) => {
            const step =
              order.status === "paid"
                ? nextStep(group.status, group.fulfillment_mode)
                : null;
            return (
              <section className={styles.section} key={group.id}>
                <div className={styles.cardTop}>
                  <h2>
                    {group.supplier_name} ·{" "}
                    {group.fulfillment_mode === "pickup"
                      ? "Retirada"
                      : "Entrega"}
                  </h2>
                  <span
                    className={`${styles.pill} ${group.status === "completed" ? styles.pillOk : ""}`}
                  >
                    {groupStatusLabel[group.status]}
                  </span>
                </div>
                <ul className={styles.items}>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.product_name}
                        <small>
                          {item.quantity} ×{" "}
                          {formatBrlFromCents(item.unit_price_cents)}
                        </small>
                      </span>
                      <strong>
                        {formatBrlFromCents(item.line_total_cents)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <dl className={styles.facts} style={{ marginTop: 12 }}>
                  {group.fulfillment_mode === "pickup" &&
                    group.pickup_label && (
                      <div>
                        <dt>Retirada em</dt>
                        <dd>{group.pickup_label}</dd>
                      </div>
                    )}
                  {group.fulfillment_mode === "delivery" && (
                    <div>
                      <dt>Frete combinado</dt>
                      <dd>{formatBrlFromCents(group.base_freight_cents)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Prazo informado</dt>
                    <dd>
                      {leadTimeText(
                        group.lead_min_business_days,
                        group.lead_max_business_days,
                      ) ?? "—"}
                    </dd>
                  </div>
                </dl>
                {step && (
                  <div className={styles.actions}>
                    <form action={advanceGroup}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="next" value={step.next} />
                      <button type="submit" className={styles.primary}>
                        {step.label}
                      </button>
                    </form>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className={styles.stack}>
          <section className={styles.section}>
            <h2>Valores</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Produtos</dt>
                <dd>{formatBrlFromCents(order.items_subtotal_cents)}</dd>
              </div>
              <div>
                <dt>Frete</dt>
                <dd>{formatBrlFromCents(order.freight_cents)}</dd>
              </div>
              {order.floor_charge_cents > 0 && (
                <div>
                  <dt>Adicional por andar</dt>
                  <dd>{formatBrlFromCents(order.floor_charge_cents)}</dd>
                </div>
              )}
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{formatBrlFromCents(order.total_cents)}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.section}>
            <h2>Cliente</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Nome</dt>
                <dd>{order.customer_name ?? "—"}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{order.customer_email ?? "—"}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{order.customer_phone ?? "—"}</dd>
              </div>
            </dl>
            <div className={styles.actions}>
              {order.customer_email && (
                <a href={`mailto:${order.customer_email}`}>Enviar e-mail</a>
              )}
              {order.customer_phone && (
                <a
                  href={whatsappLink(order.customer_phone, order.order_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              )}
            </div>
            {order.delivery_street && (
              <p className={styles.lead} style={{ marginTop: 14 }}>
                Entrega: {order.delivery_street}, {order.delivery_number}
                {order.delivery_complement
                  ? ` - ${order.delivery_complement}`
                  : ""}{" "}
                - {order.delivery_neighborhood}, {order.delivery_city}/
                {order.delivery_state}, CEP {order.delivery_postal_code}
                {order.delivery_floor !== null
                  ? `, ${order.delivery_floor}º andar`
                  : ""}
              </p>
            )}
          </section>

          <section className={styles.section}>
            <h2>Pagamentos</h2>
            {order.payments.length ? (
              <ul className={styles.timeline}>
                {order.payments.map((payment, index) => (
                  <li key={index}>
                    <span>
                      {payment.provider === "mock" ? "Teste" : "Mercado Pago"} ·{" "}
                      {payment.status} ·{" "}
                      {formatBrlFromCents(payment.amount_cents)}
                    </span>
                    <time dateTime={payment.created_at}>
                      {dateFormat.format(new Date(payment.created_at))}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                Nenhuma tentativa de pagamento ainda.
              </p>
            )}
          </section>

          <section className={styles.section}>
            <h2>Histórico</h2>
            <ul className={styles.timeline}>
              {order.events.map((event, index) => (
                <li key={index}>
                  <span>
                    {eventLabels[event.event_type] ?? event.event_type}
                  </span>
                  <time dateTime={event.occurred_at}>
                    {dateFormat.format(new Date(event.occurred_at))}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
