import {
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../features/admin/logistics/LogisticsComponents";
import { getAdminLogisticsOverview } from "../../../features/admin/logistics/data";
import {
  statusLabel,
  formatBRLFromCents,
} from "../../../features/admin/logistics/values.mjs";
import styles from "../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

const summaryMetrics = [
  ["supplier_count", "Fornecedores"],
  ["active_supplier_count", "Fornecedores ativos"],
  ["product_count", "Produtos no catálogo"],
  ["unassigned_product_count", "Produtos sem fornecedor"],
  ["enabled_area_count", "Municípios atendidos"],
  ["open_quote_count", "Solicitações em aberto"],
] as const;

export default async function LogisticsOverviewPage() {
  const result = await getAdminLogisticsOverview();

  return (
    <LogisticsPage
      title="Visão geral"
      description="Acompanhe as solicitações, a cobertura e a identificação logística do catálogo. Os indicadores abaixo são lidos da RPC administrativa; a tela não completa valores ausentes com números estimados."
    >
      {result.status === "unavailable" ? (
        <LogisticsReadNotice
          issue={result.reason}
          rpc="admin_logistics_overview"
        />
      ) : (
        <>
          <section
            className={styles.metricGrid}
            aria-label="Indicadores de logística"
          >
            {summaryMetrics.map(([key, label]) => (
              <article className={styles.metric} key={key}>
                <span className={styles.metricLabel}>{label}</span>
                <strong>{result.data[key]}</strong>
              </article>
            ))}
          </section>

          <LogisticsPanel
            title="Solicitações por status"
            description="Cada total é apresentado somente quando retornado por admin_logistics_overview()."
          >
            {Object.keys(result.data.quote_counts).length ? (
              <div className={styles.statusList}>
                {Object.entries(result.data.quote_counts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([status, count]) => (
                    <div className={styles.statusRow} key={status}>
                      <span>{statusLabel(status)}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className={styles.supportCopy}>
                A RPC não retornou a distribuição de status.
              </p>
            )}
          </LogisticsPanel>

          <LogisticsPanel
            title="Parâmetros atuais"
            description="A taxa por andar é aplicada uma vez por endereço e calculada no servidor."
          >
            <div className={styles.settingsSummary}>
              <div className={styles.settingsValue}>
                <span>Adicional por andar</span>
                <strong>
                  {formatBRLFromCents(result.data.settings.floor_charge_cents)}
                </strong>
              </div>
              <div className={styles.settingsValue}>
                <span>Começa no andar</span>
                <strong>
                  {result.data.settings.included_through_floor + 1}º
                </strong>
              </div>
              <div className={styles.settingsValue}>
                <span>Validade da cotação</span>
                <strong>
                  {result.data.settings.quote_expiration_minutes === null
                    ? "Não configurada"
                    : `${result.data.settings.quote_expiration_minutes} min`}
                </strong>
              </div>
              <div className={styles.settingsValue}>
                <span>WhatsApp comercial</span>
                <strong>
                  {result.data.settings.whatsapp_phone_e164 ??
                    "Não configurado"}
                </strong>
              </div>
            </div>
            {result.data.settings.multi_delivery_policy_status === "pending" ? (
              <div
                className={`${styles.policyNotice} ${styles.spacedNotice}`}
                role="note"
              >
                A cobrança por andar ainda está definida por
                solicitação/endereço. Política de múltiplas entregas no mesmo
                carrinho continua pendente.
              </div>
            ) : null}
          </LogisticsPanel>
        </>
      )}
    </LogisticsPage>
  );
}
