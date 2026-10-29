import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  CheckoutForm,
  type PickupGroup,
} from "../../../features/checkout/CheckoutForm";
import { getPaymentConfig } from "../../../features/checkout/payment-service";
import styles from "../../../features/checkout/checkout.module.css";
import {
  getCommerceIdentity,
  getMyCart,
  type CartItem,
} from "../../../features/commerce/data";
import { getCustomerLogisticsQuotes } from "../../../features/logistics/customer-data";
import type { CustomerLogisticsQuote } from "../../../features/logistics/types";
import { getVerifiedCustomerSession } from "../../../features/logistics/server-session";
import { formatBrlFromCents } from "../../../lib/money";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Group = {
  code: string;
  name: string;
  items: CartItem[];
};

function groupBySupplier(items: CartItem[]): Group[] | null {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const info = item.logistics;
    if (!info?.supplierCode || !info.supplierAssigned) return null;
    const group = groups.get(info.supplierCode) ?? {
      code: info.supplierCode,
      name: info.supplierName ?? info.supplierCode,
      items: [],
    };
    group.items.push(item);
    groups.set(info.supplierCode, group);
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export default async function CheckoutPage() {
  const { userId } = await getCommerceIdentity();
  if (!userId) redirect("/conta?next=%2Fcheckout");

  const cart = await getMyCart();
  if (!cart.items.length) redirect("/carrinho");

  const session = await getVerifiedCustomerSession();
  const [{ data: settings }, quotesResult] = await Promise.all([
    session
      ? session.client
          .from("commerce_settings")
          .select("checkout_enabled")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getCustomerLogisticsQuotes(),
  ]);
  const quotes: CustomerLogisticsQuote[] =
    quotesResult.status === "ok" ? quotesResult.quotes : [];
  const acceptedQuote =
    [...quotes]
      .filter((quote) => quote.status === "accepted")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const awaitingResponse = quotes.some((quote) => quote.status === "quoted");

  const unavailable = cart.items.filter(
    (item) => item.stock_status === "unavailable",
  );
  const groups = groupBySupplier(cart.items);
  const paymentReady = getPaymentConfig().status === "ready";
  const checkoutOpen = settings?.checkout_enabled === true && paymentReady;

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price_cents * item.quantity,
    0,
  );

  // Delivery follows the accepted quote; otherwise a cart whose every supplier
  // offers pickup can be bought for pickup.
  const quoteGroups = acceptedQuote?.groups ?? [];
  const deliveryGroups = quoteGroups.filter(
    (group) => group.mode === "delivery",
  );
  const freight = deliveryGroups.reduce(
    (sum, group) => sum + (group.baseFreightCents ?? 0),
    0,
  );
  const floorCharge = deliveryGroups.length
    ? (acceptedQuote?.floorChargeCents ?? 0)
    : 0;

  const pickupGroups: PickupGroup[] = (groups ?? []).map((group) => ({
    supplierCode: group.code,
    supplierName: group.name,
    locations: (cart.logistics?.pickupLocations ?? [])
      .filter((location) => location.supplierCode === group.code)
      .map((location) => ({
        id: location.id,
        label: `${location.displayName} - ${location.street}, ${location.streetNumber} - ${location.neighborhood}`,
      })),
  }));
  const canPickup =
    !!groups &&
    groups.every((group) => {
      const modes = group.items[0]?.logistics?.fulfillmentModes ?? [];
      const hasPlace = pickupGroups.find((p) => p.supplierCode === group.code)
        ?.locations.length;
      return modes.includes("pickup") && !!hasPlace;
    });

  const mode: "quote" | "pickup" | "blocked" = acceptedQuote
    ? "quote"
    : canPickup
      ? "pickup"
      : "blocked";
  const total = subtotal + (mode === "quote" ? freight + floorCharge : 0);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Última etapa</p>
            <h1>Finalizar compra</h1>
          </div>
          <span className={styles.meta}>
            {cart.items.reduce((sum, item) => sum + item.quantity, 0)} itens
          </span>
        </div>

        {!checkoutOpen && (
          <p className={styles.banner}>
            O pagamento online ainda não está liberado nesta loja. Você pode
            conferir o resumo, mas não é possível concluir a compra agora.
          </p>
        )}
        {unavailable.length > 0 && (
          <p className={`${styles.banner} ${styles.bannerError}`} role="alert">
            Há itens indisponíveis no carrinho. Remova-os para continuar.{" "}
            <Link href="/carrinho">Voltar ao carrinho</Link>
          </p>
        )}

        <div className={styles.columns}>
          <div className={styles.stack}>
            {(groups ?? []).map((group) => {
              const quoteGroup = quoteGroups.find(
                (g) => g.supplierCode === group.code,
              );
              const modeLabel =
                mode === "quote"
                  ? quoteGroup?.mode === "pickup"
                    ? "Retirada"
                    : "Entrega"
                  : "Retirada";
              return (
                <section className={styles.panel} key={group.code}>
                  <div className={styles.groupHead}>
                    <h3>{group.name}</h3>
                    <span>{modeLabel}</span>
                  </div>
                  <ul className={styles.items}>
                    {group.items.map((item) => (
                      <li key={item.variant_id}>
                        <span>
                          {item.name}
                          <small>Quantidade: {item.quantity}</small>
                        </span>
                        <strong>
                          {formatBrlFromCents(item.price_cents * item.quantity)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  {mode === "quote" && quoteGroup?.mode === "delivery" && (
                    <p className={styles.place}>
                      Frete combinado:{" "}
                      <strong>
                        {formatBrlFromCents(quoteGroup.baseFreightCents ?? 0)}
                      </strong>
                    </p>
                  )}
                </section>
              );
            })}

            {mode === "quote" && acceptedQuote && (
              <section className={styles.panel}>
                <h2>Entrega</h2>
                <p className={styles.place}>
                  {acceptedQuote.cityName}/{acceptedQuote.stateCode}, CEP{" "}
                  {acceptedQuote.postalCode}
                  {acceptedQuote.floorNumber !== null
                    ? `, ${acceptedQuote.floorNumber}º andar`
                    : ""}
                  .
                </p>
                <p className={styles.lead}>
                  Os prazos são contados em dias úteis a partir da confirmação
                  do pagamento. A cotação aceita vale apenas para estes itens e
                  este endereço.
                </p>
              </section>
            )}

            {mode === "pickup" && (
              <section className={styles.panel}>
                <h2>Retirada</h2>
                <p className={styles.lead}>
                  Você retira o pedido no local escolhido ao lado, sem frete. A
                  loja avisa quando estiver pronto.
                </p>
              </section>
            )}

            {mode === "blocked" && (
              <section className={styles.panel}>
                <h2>Falta combinar a entrega</h2>
                <p className={styles.lead}>
                  {groups
                    ? "Algum produto do carrinho é entregue com frete combinado (não há retirada). Solicite a cotação no carrinho, aguarde a resposta da loja e aceite em Minhas entregas. Depois volte aqui para pagar."
                    : "Algum produto ainda não tem fornecedor definido, então a loja ainda não consegue calcular a entrega. Fale com a loja."}
                </p>
                <div className={styles.links}>
                  <Link href="/carrinho">Solicitar cotação no carrinho</Link>
                  <Link href="/conta/entregas">
                    {awaitingResponse
                      ? "Você tem uma cotação para responder"
                      : "Ver minhas entregas"}
                  </Link>
                </div>
              </section>
            )}
          </div>

          <aside className={styles.summary}>
            <h2>Resumo</h2>
            <div className={styles.row}>
              <span>Produtos</span>
              <strong>{formatBrlFromCents(subtotal)}</strong>
            </div>
            <div className={styles.row}>
              <span>Frete</span>
              <strong>
                {mode === "quote" ? formatBrlFromCents(freight) : "Sem frete"}
              </strong>
            </div>
            {mode === "quote" && floorCharge > 0 && (
              <div className={styles.row}>
                <span>Adicional por andar</span>
                <strong>{formatBrlFromCents(floorCharge)}</strong>
              </div>
            )}
            <div className={`${styles.row} ${styles.grand}`}>
              <span>Total</span>
              <strong>{formatBrlFromCents(total)}</strong>
            </div>
            <p className={styles.note}>
              O valor final é confirmado pela loja ao criar o pedido. O estoque
              fica reservado enquanto você paga.
            </p>
            {checkoutOpen && mode !== "blocked" && unavailable.length === 0 ? (
              <CheckoutForm
                idempotencyKey={randomUUID()}
                quoteId={mode === "quote" ? acceptedQuote!.id : null}
                pickupGroups={mode === "pickup" ? pickupGroups : []}
              />
            ) : (
              <Link className={styles.secondary} href="/carrinho">
                Voltar ao carrinho
              </Link>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
