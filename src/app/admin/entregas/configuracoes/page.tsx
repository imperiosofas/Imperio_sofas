import { updateLogisticsSettings } from "../../../../features/admin/logistics/actions";
import { LogisticsActionForm } from "../../../../features/admin/logistics/LogisticsActionForm";
import {
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../../features/admin/logistics/LogisticsComponents";
import { getAdminLogisticsOverview } from "../../../../features/admin/logistics/data";
import {
  formatBRLFromCents,
  formatBRLInputFromCents,
} from "../../../../features/admin/logistics/values.mjs";
import styles from "../../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

export default async function LogisticsSettingsPage() {
  const overview = await getAdminLogisticsOverview();

  return (
    <LogisticsPage
      title="Configurações"
      description="Ajuste parâmetros usados nas próximas solicitações. Validade e contato são opcionais; a interface não preenche prazos ou telefone comercial por conta própria."
    >
      {overview.status === "unavailable" ? (
        <LogisticsReadNotice
          issue={overview.reason}
          rpc="admin_logistics_overview"
        />
      ) : (
        <LogisticsPanel
          title="Taxa por andar e contato"
          description="O valor é uma taxa adicional por andar após o limite incluído. O servidor aplica e valida o cálculo na solicitação."
        >
          <div className={styles.settingsSummary}>
            <div className={styles.settingsValue}>
              <span>Adicional atual</span>
              <strong>
                {formatBRLFromCents(overview.data.settings.floor_charge_cents)}{" "}
                / andar
              </strong>
            </div>
            <div className={styles.settingsValue}>
              <span>Primeiro andar cobrado</span>
              <strong>
                {overview.data.settings.included_through_floor + 1}º
              </strong>
            </div>
            <div className={styles.settingsValue}>
              <span>Validade atual</span>
              <strong>
                {overview.data.settings.quote_expiration_minutes === null
                  ? "Sem validade"
                  : `${overview.data.settings.quote_expiration_minutes} min`}
              </strong>
            </div>
            <div className={styles.settingsValue}>
              <span>WhatsApp atual</span>
              <strong>
                {overview.data.settings.whatsapp_phone_e164 ??
                  "Não configurado"}
              </strong>
            </div>
          </div>

          <LogisticsActionForm
            action={updateLogisticsSettings}
            className={styles.settingsForm}
            successMessage="Configurações logísticas atualizadas."
          >
            <div className={styles.settingsGrid}>
              <label className={styles.field}>
                <span>Adicional por andar (R$)</span>
                <input
                  autoComplete="off"
                  inputMode="decimal"
                  name="floorCharge"
                  defaultValue={formatBRLInputFromCents(
                    overview.data.settings.floor_charge_cents,
                  )}
                  required
                />
                <small className={styles.fieldHint}>
                  Valor inteiro em centavos no banco; digite, por exemplo,
                  10,00.
                </small>
              </label>
              <label className={styles.field}>
                <span>Andares incluídos sem adicional</span>
                <input
                  name="includedThroughFloor"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  defaultValue={overview.data.settings.included_through_floor}
                  required
                />
                <small className={styles.fieldHint}>
                  O padrão confirmado é até o 4º andar; a cobrança começa no 5º.
                </small>
              </label>
              <label className={styles.field}>
                <span>Validade da cotação (minutos)</span>
                <input
                  name="quoteExpirationMinutes"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={
                    overview.data.settings.quote_expiration_minutes ?? ""
                  }
                  placeholder="Sem expiração automática"
                />
                <small className={styles.fieldHint}>
                  Deixe em branco para manter NULL, sem prazo inventado.
                </small>
              </label>
              <label className={styles.field}>
                <span>WhatsApp comercial (E.164)</span>
                <input
                  autoComplete="tel"
                  name="whatsappPhoneE164"
                  type="tel"
                  defaultValue={
                    overview.data.settings.whatsapp_phone_e164 ?? ""
                  }
                  placeholder="+5511999999999"
                />
                <small className={styles.fieldHint}>
                  Deixe em branco para salvar NULL; informe somente contato
                  confirmado.
                </small>
              </label>
            </div>
            <div className={styles.formActions}>
              <button className={styles.button} type="submit">
                Salvar configurações
              </button>
              <p>Validade e WhatsApp vazios são enviados como NULL.</p>
            </div>
          </LogisticsActionForm>
          {overview.data.settings.multi_delivery_policy_status === "pending" ? (
            <div
              className={`${styles.policyNotice} ${styles.spacedNotice}`}
              role="note"
            >
              A regra para cobrança por andar em múltiplas entregas do mesmo
              carrinho continua pendente. Esta tela não ativa nem cobra pedidos.
            </div>
          ) : null}
          <div
            className={`${styles.policyNotice} ${styles.spacedNotice}`}
            role="note"
          >
            Calendário de feriados não configurado. Os prazos permanecem em dias
            úteis informados pelos fornecedores; não calculamos datas nem
            presumimos feriados locais.
          </div>
        </LogisticsPanel>
      )}
    </LogisticsPage>
  );
}
