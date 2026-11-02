"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
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

type Ask = {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
};

function ConfirmDialog({
  ask,
  pending,
  onClose,
}: {
  ask: Ask | null;
  pending: boolean;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ask) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask, onClose]);
  if (!ask) return null;
  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="quote-dialog-title"
        aria-describedby="quote-dialog-text"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="quote-dialog-title">{ask.title}</h3>
        <p id="quote-dialog-text">{ask.text}</p>
        <div className={styles.dialogActions}>
          <button type="button" onClick={onClose} disabled={pending}>
            Voltar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={ask.danger ? styles.dialogDanger : styles.dialogPrimary}
            disabled={pending}
            onClick={() => {
              onClose();
              ask.run();
            }}
          >
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [ask, setAsk] = useState<Ask | null>(null);
  const [accepted, setAccepted] = useState(false);
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
    const run = () =>
      startTransition(async () => {
        const result = await respondToCustomerLogisticsQuote({
          quoteId: id,
          accept,
        });
        setAccepted(result.status === "ok" && accept);
        setNotice(
          result.status === "ok"
            ? accept
              ? "Cotação aceita. Agora é só finalizar a compra."
              : "Cotação recusada."
            : "Não foi possível registrar sua resposta.",
        );
        if (result.status === "ok") router.refresh();
      });
    setAsk(
      accept
        ? {
            title: "Aceitar esta cotação?",
            text: "Você confirma os fretes informados para este endereço. O pagamento só acontece depois, na finalização da compra.",
            confirmLabel: "Aceitar cotação",
            run,
          }
        : {
            title: "Recusar esta cotação?",
            text: "Você poderá pedir uma nova cotação a qualquer momento.",
            confirmLabel: "Recusar",
            danger: true,
            run,
          },
    );
  }

  function cancel(id: string) {
    setAsk({
      title: "Cancelar esta solicitação?",
      text: "A solicitação de cotação será cancelada. Você pode pedir outra depois.",
      confirmLabel: "Cancelar solicitação",
      danger: true,
      run: () =>
        startTransition(async () => {
          const result = await cancelCustomerLogisticsQuote(id);
          setAccepted(false);
          setNotice(
            result.status === "ok"
              ? "Solicitação cancelada."
              : "Não foi possível cancelar agora.",
          );
          if (result.status === "ok") router.refresh();
        }),
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
          Aqui você acompanha as cotações de frete. Depois de aceitar uma
          cotação, finalize a compra para pagar.
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
        {accepted ? (
          <>
            {" "}
            <Link href="/checkout">Ir para o pagamento</Link>
          </>
        ) : null}
      </span>
      <ConfirmDialog ask={ask} pending={pending} onClose={() => setAsk(null)} />
    </section>
  );
}
