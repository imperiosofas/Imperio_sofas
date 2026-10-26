"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelCustomerLogisticsQuote,
  getCustomerLogisticsQuote,
  respondToCustomerLogisticsQuote,
} from "./actions";
import type { CustomerLogisticsQuote } from "./types";
import styles from "./logistics.module.css";

const statusLabel: Record<CustomerLogisticsQuote["status"], string> = {
  awaiting_quote: "Aguardando cotação",
  quoted: "Cotação recebida",
  accepted: "Cotação aceita",
  rejected: "Cotação recusada",
  cancelled: "Cancelada",
  invalidated: "Indisponível",
  expired: "Expirada",
};

function formatBrl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function MyLogisticsQuotes({
  status,
  quotes,
}: {
  status: "ok" | "not_configured" | "unavailable";
  quotes: CustomerLogisticsQuote[];
}) {
  const [details, setDetails] = useState<
    Record<string, CustomerLogisticsQuote>
  >({});
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function loadDetails(id: string) {
    if (details[id]) {
      setDetails((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    startTransition(async () => {
      const result = await getCustomerLogisticsQuote(id);
      if (result.status === "ok")
        setDetails((current) => ({ ...current, [id]: result.quote }));
      else setNotice("Não foi possível carregar os detalhes desta cotação.");
    });
  }

  function respond(id: string, accept: boolean) {
    const message = accept
      ? "A cotação será aceita. Isso não cria pedido nem pagamento."
      : "Deseja recusar esta cotação?";
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await respondToCustomerLogisticsQuote({
        quoteId: id,
        accept,
      });
      setNotice(
        result.status === "ok"
          ? "Resposta registrada. Nenhum pedido ou pagamento foi criado."
          : "Não foi possível registrar sua resposta.",
      );
      if (result.status === "ok") router.refresh();
    });
  }

  function cancel(id: string) {
    if (!window.confirm("Deseja cancelar esta solicitação de cotação?")) return;
    startTransition(async () => {
      const result = await cancelCustomerLogisticsQuote(id);
      setNotice(
        result.status === "ok"
          ? "Solicitação cancelada."
          : "Não foi possível cancelar agora.",
      );
      if (result.status === "ok") router.refresh();
    });
  }

  return (
    <section
      className={styles.quotesPanel}
      aria-labelledby="delivery-quotes-title"
    >
      <div>
        <p className={styles.eyebrow}>ACOMPANHAMENTO</p>
        <h2 id="delivery-quotes-title">Minhas entregas</h2>
        <p>
          As respostas desta etapa são sobre a cotação logística. Aceitar não
          finaliza compra e não cria pedido ou pagamento.
        </p>
      </div>
      {status === "not_configured" ? (
        <p className={styles.accountNotice} role="status">
          A consulta de cotações ainda não está habilitada neste ambiente.
          Nenhuma ação foi realizada.
        </p>
      ) : status === "unavailable" ? (
        <p className={styles.accountNotice} role="status">
          Não foi possível carregar suas cotações agora.
        </p>
      ) : quotes.length === 0 ? (
        <p>Você ainda não tem solicitações de cotação.</p>
      ) : (
        quotes.map((quote) => {
          const date = new Date(quote.createdAt);
          const dateText = Number.isNaN(date.getTime())
            ? "Data indisponível"
            : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                date,
              );
          return (
            <article className={styles.quoteCard} key={quote.id}>
              <h3>{statusLabel[quote.status]}</h3>
              <div className={styles.quoteMeta}>
                <span>Solicitada em {dateText}</span>
                <span>Referência {quote.id.slice(0, 8)}</span>
                {quote.cityName && quote.stateCode ? (
                  <span>
                    {quote.cityName}/{quote.stateCode}
                  </span>
                ) : null}
                {quote.floorNumber !== null ? (
                  <span>
                    Andar {quote.floorNumber} · adicional{" "}
                    {formatBrl(quote.floorChargeCents)}
                  </span>
                ) : null}
              </div>
              <div className={styles.quoteActions}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void loadDetails(quote.id)}
                >
                  {details[quote.id] ? "Ocultar detalhes" : "Ver detalhes"}
                </button>
                {quote.status === "quoted" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => respond(quote.id, true)}
                    >
                      Aceitar cotação
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => respond(quote.id, false)}
                    >
                      Recusar
                    </button>
                  </>
                ) : null}
                {quote.status === "awaiting_quote" ||
                quote.status === "quoted" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => cancel(quote.id)}
                  >
                    Cancelar solicitação
                  </button>
                ) : null}
              </div>
              {details[quote.id] ? (
                <div className={styles.quoteDetails}>
                  {details[quote.id].groups.map((group, index) => (
                    <div key={group.id ?? `${quote.id}-${index}`}>
                      <strong>
                        {group.supplierCode === "VALE"
                          ? "Império Sofás Vale"
                          : "Mundial"}{" "}
                        · {group.mode === "delivery" ? "Entrega" : "Retirada"}
                      </strong>
                      {group.baseFreightCents !== null ? (
                        <p>
                          Frete informado: {formatBrl(group.baseFreightCents)}
                        </p>
                      ) : (
                        <p>Frete ainda não informado.</p>
                      )}
                      {group.items.map((item, itemIndex) => (
                        <p key={`${item.productName}-${itemIndex}`}>
                          {item.quantity} × {item.productName}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })
      )}
      <span role="status" aria-live="polite">
        {notice}
      </span>
    </section>
  );
}
