import { setLogisticsArea } from "../../../../features/admin/logistics/actions";
import { LogisticsActionForm } from "../../../../features/admin/logistics/LogisticsActionForm";
import {
  LogisticsEmpty,
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../../features/admin/logistics/LogisticsComponents";
import { getAdminLogisticsAreas } from "../../../../features/admin/logistics/data";
import type { LogisticsArea } from "../../../../features/admin/logistics/types";
import styles from "../../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

function AreaCard({ area }: { area: LogisticsArea }) {
  const targetEnabled = !area.is_enabled;
  return (
    <article className={styles.areaCard}>
      <div className={styles.areaInfo}>
        <strong>{area.city_name}</strong>
        <span className={styles.codeText}>
          IBGE {area.ibge_code} · {area.state_code}
        </span>
        <span className={styles.secondaryText}>
          {area.pickup_location_count} local(is) de retirada associado(s)
        </span>
        <span
          className={styles.statusPill}
          data-status={area.is_enabled ? "accepted" : "cancelled"}
        >
          {area.is_enabled ? "Atendida" : "Desativada"}
        </span>
      </div>
      <LogisticsActionForm
        action={setLogisticsArea}
        booleanFields={["enabled"]}
        successMessage={`Cobertura de ${area.city_name} atualizada.`}
      >
        <input type="hidden" name="ibgeCode" value={area.ibge_code} />
        <input type="hidden" name="cityName" value={area.city_name} />
        <input type="hidden" name="enabled" value={String(targetEnabled)} />
        <button className={styles.quietButton} type="submit">
          {area.is_enabled ? "Desativar" : "Habilitar"}
        </button>
      </LogisticsActionForm>
    </article>
  );
}

export default async function LogisticsAreasPage() {
  const result = await getAdminLogisticsAreas();

  return (
    <LogisticsPage
      title="Áreas atendidas"
      description="A cobertura é municipal, restrita a São Paulo e identificada por código IBGE. Somente os municípios confirmados aparecem nesta lista; não há ativação automática por CEP ou região textual."
    >
      <div className={styles.policyNotice} role="note">
        A base inicial contém os 12 municípios confirmados. A ação valida
        código, nome oficial e pertencimento à lista aprovada antes de solicitar
        a mudança ao RPC.
      </div>
      {result.status === "unavailable" ? (
        <LogisticsReadNotice
          issue={result.reason}
          rpc="admin_list_logistics_areas"
        />
      ) : (
        <LogisticsPanel
          title="Municípios de São Paulo"
          description={`${result.data.length} município(s) retornado(s) pela RPC; status exibido conforme o banco.`}
        >
          {result.data.length ? (
            <div className={styles.areaGrid}>
              {result.data
                .filter((area) => area.state_code === "SP")
                .map((area) => (
                  <AreaCard area={area} key={area.ibge_code} />
                ))}
            </div>
          ) : (
            <LogisticsEmpty title="Nenhum município retornado">
              Nenhuma área foi apresentada nem criada pela interface. Verifique
              o seed inicial aprovado no banco.
            </LogisticsEmpty>
          )}
          {result.data.some((area) => area.state_code !== "SP") ? (
            <div
              className={`${styles.policyNotice} ${styles.spacedNotice}`}
              role="alert"
            >
              A RPC retornou registro(s) fora de SP. Foram ocultados da gestão e
              nenhuma mutação será enviada para esses códigos.
            </div>
          ) : null}
        </LogisticsPanel>
      )}
    </LogisticsPage>
  );
}
