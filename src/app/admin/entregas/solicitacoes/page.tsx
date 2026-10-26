import { setLogisticsGroupFreight } from "../../../../features/admin/logistics/actions";
import { LogisticsActionForm } from "../../../../features/admin/logistics/LogisticsActionForm";
import {
  LogisticsEmpty,
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../../features/admin/logistics/LogisticsComponents";
import { getAdminLogisticsQuotes } from "../../../../features/admin/logistics/data";
import type { LogisticsQuote } from "../../../../features/admin/logistics/types";
import {
  formatBRLFromCents,
  formatBRLInputFromCents,
  statusLabel,
} from "../../../../features/admin/logistics/values.mjs";
import styles from "../../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

const statusOptions = [
  ["", "Todas as solicitações"],
  ["awaiting_quote", "Aguardando cotação"],
  ["quoted", "Cotação enviada"],
  ["accepted", "Aceita pelo cliente"],
  ["rejected", "Recusada"],
  ["cancelled", "Cancelada"],
  ["invalidated", "Invalidada"],
  ["expired", "Expirada"],
] as const;
const allowedStatuses = new Set<string>(statusOptions.map(([value]) => value));

function dateLabel(value: string | null): string {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function QuoteCard({ quote }: { quote: LogisticsQuote }) {
  const delivery = quote.delivery_address;
  return (
    <article className={styles.quoteCard}>
      <header className={styles.quoteHeader}>
        <div>
          <h3>Solicitação {quote.quote_id.slice(0, 8).toUpperCase()}</h3>
          <div className={styles.quoteMeta}>
            <span>
              {delivery
                ? `${delivery.city_name}, ${delivery.state_code}`
                : "Retirada / sem destino de entrega"}
            </span>
            <span>Recebida em {dateLabel(quote.created_at)}</span>
            {delivery ? <span>Andar {delivery.floor_number}</span> : null}
            <span>Atualizada em {dateLabel(quote.updated_at)}</span>
          </div>
        </div>
        <span className={styles.statusPill} data-status={quote.status}>
          {statusLabel(quote.status)}
        </span>
      </header>

      <div className={styles.quoteBody}>
        <div className={styles.groupList}>
          {quote.groups.length ? (
            quote.groups.map((group) => (
              <section className={styles.groupCard} key={group.group_id}>
                <div className={styles.groupHeader}>
                  <strong>
                    {group.supplier_code} ·{" "}
                    {group.fulfillment_mode === "pickup"
                      ? "Retirada"
                      : "Entrega"}
                  </strong>
                  <span
                    className={styles.statusPill}
                    data-status={group.status}
                  >
                    {statusLabel(group.status)}
                  </span>
                </div>
                {group.items.length ? (
                  <ul className={styles.itemList}>
                    {group.items.map((item) => (
                      <li key={`${item.product_id}-${item.variant_id}`}>
                        <span>{item.product_name}</span>
                        <strong>× {item.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.supportCopy}>
                    Nenhum item retornado neste grupo.
                  </p>
                )}

                {group.fulfillment_mode === "delivery" &&
                ["awaiting_quote", "quoted"].includes(group.status) ? (
                  <>
                    <LogisticsActionForm
                      action={setLogisticsGroupFreight}
                      className={styles.freightForm}
                      successMessage="Frete base atualizado; o estado da cotação será recarregado do banco."
                    >
                      <input
                        type="hidden"
                        name="quoteId"
                        value={quote.quote_id}
                      />
                      <input
                        type="hidden"
                        name="supplierCode"
                        value={group.supplier_code}
                      />
                      <label className={styles.field}>
                        <span>Frete base negociado (R$)</span>
                        <input
                          aria-label={`Frete base do grupo ${group.supplier_code}`}
                          autoComplete="off"
                          inputMode="decimal"
                          name="baseFreight"
                          defaultValue={
                            group.base_freight_cents === null
                              ? ""
                              : formatBRLInputFromCents(
                                  group.base_freight_cents,
                                )
                          }
                          placeholder="Informe o valor negociado"
                          required
                        />
                      </label>
                      <button className={styles.button} type="submit">
                        Salvar frete
                      </button>
                    </LogisticsActionForm>
                    <div className={styles.calculatedCharge}>
                      <span>Adicional por andar · cálculo do servidor</span>
                      <strong>
                        {formatBRLFromCents(quote.floor_charge_cents)}
                      </strong>
                    </div>
                  </>
                ) : group.base_freight_cents !== null ? (
                  <div className={styles.calculatedCharge}>
                    <span>Frete base registrado</span>
                    <strong>
                      {formatBRLFromCents(group.base_freight_cents)}
                    </strong>
                  </div>
                ) : null}
              </section>
            ))
          ) : (
            <p className={styles.supportCopy}>
              A solicitação não contém grupos logísticos.
            </p>
          )}
        </div>

        <aside
          className={styles.history}
          aria-label={`Histórico da solicitação ${quote.quote_id.slice(0, 8)}`}
        >
          <h4>Histórico disponível</h4>
          <p className={styles.supportCopy}>
            A RPC atual retorna status, criação e última atualização, mas não
            inclui os eventos da solicitação. Nenhum histórico foi reconstruído
            ou inferido na interface.
          </p>
          {quote.quote_expires_at ? (
            <p className={styles.supportCopy}>
              Expira em {dateLabel(quote.quote_expires_at)}.
            </p>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

export default async function LogisticsRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedStatus = typeof query.status === "string" ? query.status : "";
  const status =
    allowedStatuses.has(requestedStatus) && requestedStatus
      ? requestedStatus
      : null;
  const result = await getAdminLogisticsQuotes(status);

  return (
    <LogisticsPage
      title="Solicitações de frete"
      description="Revise os itens por grupo e informe apenas o frete base negociado. O adicional por andar vem do banco; vendedor não aceita nem recusa em nome do cliente."
    >
      <div className={styles.policyNotice} role="note">
        A tela não oferece ação administrativa para aceitar ou recusar: essas
        decisões pertencem ao cliente. Endereço completo, CEP, complemento e
        dados pessoais não são mostrados.
      </div>
      <LogisticsPanel title="Fila de atendimento">
        <form className={styles.filterForm} method="get">
          <label className={styles.field}>
            <span>Filtrar por status</span>
            <select name="status" defaultValue={status ?? ""}>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.button} type="submit">
            Aplicar filtro
          </button>
        </form>
        {result.status === "unavailable" ? (
          <div className={styles.inlineNotice}>
            <LogisticsReadNotice
              issue={result.reason}
              rpc="admin_list_logistics_quotes"
            />
          </div>
        ) : result.data.length ? (
          <div className={styles.quoteList}>
            {result.data.map((quote) => (
              <QuoteCard key={quote.quote_id} quote={quote} />
            ))}
          </div>
        ) : (
          <LogisticsEmpty title="Nenhuma solicitação nesta fila">
            A consulta administrativa foi concluída sem solicitações para o
            filtro escolhido.
          </LogisticsEmpty>
        )}
      </LogisticsPanel>
    </LogisticsPage>
  );
}
