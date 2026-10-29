import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  cancelOrderAction,
  retryPaymentAction,
  simulateMockPaymentAction,
} from "../../../../features/checkout/actions";
import styles from "../../../../features/checkout/checkout.module.css";
import { getMyOrder } from "../../../../features/checkout/orders-data";
import { getPaymentConfig } from "../../../../features/checkout/payment-service";
import {
  groupStatusLabel,
  leadTimeText,
  orderStatusLabel,
} from "../../../../features/checkout/types";
import { getCommerceIdentity } from "../../../../features/commerce/data";
import { formatBrlFromCents } from "../../../../lib/money";

export const metadata: Metadata = {
  title: "Seu pedido",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const returnMessages: Record<string, { text: string; tone: string }> = {
  sucesso: {
    text: "Recebemos o retorno do pagamento. A confirmação aparece aqui assim que o pagamento é aprovado.",
    tone: "bannerOk",
  },
  pendente: {
    text: "O pagamento está em análise. Atualizamos este pedido assim que houver resposta.",
    tone: "banner",
  },
  falha: {
    text: "O pagamento não foi aprovado. Você pode tentar de novo enquanto o pedido estiver aguardando pagamento.",
    tone: "bannerError",
  },
  erro: {
    text: "Não foi possível abrir a página de pagamento. Tente novamente em instantes.",
    tone: "bannerError",
  },
};

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function isPast(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retorno?: string; pagar?: string }>;
}) {
  const { id } = await params;
  const { retorno, pagar } = await searchParams;
  const { userId } = await getCommerceIdentity();
  if (!userId) redirect(`/conta?next=${encodeURIComponent(`/pedido/${id}`)}`);
  const order = await getMyOrder(id);
  if (!order) notFound();

  const config = getPaymentConfig();
  const pending = order.status === "pending_payment";
  const expired = isPast(order.payment_expires_at);
  const canPay = pending && !expired && config.status === "ready";
  const mock =
    canPay && config.status === "ready" && config.provider === "mock";
  const message = retorno ? returnMessages[retorno] : undefined;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Pedido nº {order.order_number}</p>
            <h1>{orderStatusLabel[order.status]}</h1>
          </div>
          <span className={styles.meta}>
            Feito em {timeFormat.format(new Date(order.created_at))}
          </span>
        </div>

        {message && (
          <p
            className={`${styles.banner} ${styles[message.tone as keyof typeof styles]}`}
            role="status"
          >
            {message.text}
          </p>
        )}
        {order.status === "paid" && (
          <p className={`${styles.banner} ${styles.bannerOk}`}>
            Pagamento confirmado em{" "}
            {order.paid_at ? timeFormat.format(new Date(order.paid_at)) : "—"}.
            Acompanhe abaixo o andamento de cada entrega ou retirada.
          </p>
        )}
        {pending && !expired && (
          <p className={styles.banner}>
            Seu estoque está reservado até{" "}
            <strong>
              {timeFormat.format(new Date(order.payment_expires_at))}
            </strong>
            . Depois desse horário o pedido é cancelado automaticamente.
          </p>
        )}
        {(order.status === "expired" || (pending && expired)) && (
          <p className={`${styles.banner} ${styles.bannerError}`}>
            O prazo de pagamento terminou e o estoque foi liberado. Volte ao
            carrinho para fazer um novo pedido.
          </p>
        )}
        {order.status === "needs_review" && (
          <p className={styles.banner}>
            Estamos conferindo o seu pagamento. A loja entra em contato se
            precisar de algo.
          </p>
        )}
        {mock && pagar === "teste" && (
          <p className={`${styles.banner} ${styles.bannerTest}`}>
            Ambiente de teste: nenhum pagamento real é feito. Use os botões
            abaixo para simular o resultado.
          </p>
        )}

        <div className={styles.columns}>
          <div className={styles.stack}>
            {order.order_groups.map((group) => (
              <section className={styles.panel} key={group.id}>
                <div className={styles.groupHead}>
                  <h3>
                    {group.supplier_name} ·{" "}
                    {group.fulfillment_mode === "pickup"
                      ? "Retirada"
                      : "Entrega"}
                  </h3>
                  <span
                    className={`${styles.badge} ${
                      group.status === "completed" ? styles.badgeOk : ""
                    }`}
                  >
                    {groupStatusLabel[group.status]}
                  </span>
                </div>
                <ul className={styles.items}>
                  {group.order_items.map((item) => (
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
                {group.fulfillment_mode === "pickup" && group.pickup_label && (
                  <p className={styles.place}>
                    Retirar em: {group.pickup_label}
                  </p>
                )}
                {group.fulfillment_mode === "delivery" &&
                  order.delivery_street && (
                    <p className={styles.place}>
                      Entregar em: {order.delivery_street},{" "}
                      {order.delivery_number}
                      {order.delivery_complement
                        ? ` - ${order.delivery_complement}`
                        : ""}
                      {" - "}
                      {order.delivery_neighborhood}, {order.delivery_city}/
                      {order.delivery_state}
                      {order.delivery_floor !== null
                        ? ` (${order.delivery_floor}º andar)`
                        : ""}
                    </p>
                  )}
                <p className={styles.lead}>
                  Prazo:{" "}
                  {leadTimeText(
                    group.lead_min_business_days,
                    group.lead_max_business_days,
                  ) ?? "informado pela loja"}
                  . O prazo não é uma data garantida.
                </p>
              </section>
            ))}
          </div>

          <aside className={styles.summary}>
            <h2>Valores</h2>
            <div className={styles.row}>
              <span>Produtos</span>
              <strong>{formatBrlFromCents(order.items_subtotal_cents)}</strong>
            </div>
            <div className={styles.row}>
              <span>Frete</span>
              <strong>{formatBrlFromCents(order.freight_cents)}</strong>
            </div>
            {order.floor_charge_cents > 0 && (
              <div className={styles.row}>
                <span>Adicional por andar</span>
                <strong>{formatBrlFromCents(order.floor_charge_cents)}</strong>
              </div>
            )}
            <div className={`${styles.row} ${styles.grand}`}>
              <span>Total</span>
              <strong>{formatBrlFromCents(order.total_cents)}</strong>
            </div>

            {canPay && (
              <form action={retryPaymentAction.bind(null, order.id)}>
                <button className={styles.primary} type="submit">
                  Pagar agora
                </button>
              </form>
            )}
            {mock && (
              <div className={styles.testBox}>
                <form
                  action={simulateMockPaymentAction.bind(
                    null,
                    order.id,
                    "approved",
                  )}
                >
                  <button className={styles.secondary} type="submit">
                    Simular pagamento aprovado
                  </button>
                </form>
                <form
                  action={simulateMockPaymentAction.bind(
                    null,
                    order.id,
                    "rejected",
                  )}
                >
                  <button className={styles.secondary} type="submit">
                    Simular pagamento recusado
                  </button>
                </form>
              </div>
            )}
            {pending && (
              <form action={cancelOrderAction.bind(null, order.id)}>
                <button className={styles.danger} type="submit">
                  Cancelar pedido
                </button>
              </form>
            )}
            <div className={styles.links}>
              <Link href="/conta/pedidos">Meus pedidos</Link>
              <Link href="/loja">Continuar explorando a loja</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
