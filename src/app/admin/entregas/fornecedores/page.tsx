import { updateLogisticsSupplier } from "../../../../features/admin/logistics/actions";
import { LogisticsActionForm } from "../../../../features/admin/logistics/LogisticsActionForm";
import {
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../../features/admin/logistics/LogisticsComponents";
import { getAdminLogisticsSuppliers } from "../../../../features/admin/logistics/data";
import type { LogisticsSupplier } from "../../../../features/admin/logistics/types";
import styles from "../../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

function SupplierCard({ supplier }: { supplier: LogisticsSupplier }) {
  return (
    <LogisticsPanel
      title={supplier.display_name}
      description={`${supplier.code} · ${supplier.assigned_product_count} produto(s) associado(s). Prazo contado após confirmação do pagamento.`}
    >
      <LogisticsActionForm
        action={updateLogisticsSupplier}
        booleanFields={[
          "isActive",
          "allowsPickup",
          "allowsDelivery",
          "deliveryQuoteRequired",
        ]}
        className={styles.supplierForm}
        successMessage="Configuração do fornecedor salva."
      >
        <input type="hidden" name="supplierId" value={supplier.supplier_id} />
        <input type="hidden" name="code" value={supplier.code} />
        <label className={`${styles.field} ${styles.spanFull}`}>
          <span>Nome de exibição</span>
          <input
            name="displayName"
            defaultValue={supplier.display_name}
            maxLength={80}
            required
          />
        </label>
        <label className={styles.checkField}>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={supplier.is_active}
          />
          <span>Fornecedor ativo</span>
        </label>
        <label className={styles.checkField}>
          <input
            type="checkbox"
            name="allowsPickup"
            defaultChecked={supplier.allows_pickup}
            disabled={supplier.code === "MUNDIAL"}
          />
          <span>Permite retirada</span>
        </label>
        <label className={styles.checkField}>
          <input
            type="checkbox"
            name="allowsDelivery"
            defaultChecked={supplier.allows_delivery}
          />
          <span>Permite entrega</span>
        </label>
        <label className={styles.checkField}>
          <input
            type="checkbox"
            name="deliveryQuoteRequired"
            defaultChecked={supplier.delivery_quote_required}
          />
          <span>Cotação obrigatória</span>
        </label>
        <label className={styles.field}>
          <span>Prazo mínimo (dias úteis)</span>
          <input
            name="leadMinBusinessDays"
            type="number"
            min="0"
            step="1"
            defaultValue={supplier.lead_min_business_days}
            required
          />
        </label>
        <label className={styles.field}>
          <span>Prazo máximo (dias úteis)</span>
          <input
            name="leadMaxBusinessDays"
            type="number"
            min="0"
            step="1"
            defaultValue={supplier.lead_max_business_days}
            required
          />
        </label>
        <label className={`${styles.field} ${styles.spanFull}`}>
          <span>Observação interna</span>
          <textarea
            name="adminNotes"
            maxLength={2000}
            defaultValue={supplier.admin_notes ?? ""}
            placeholder="Opcional; visível somente à administração"
          />
        </label>
        <div className={`${styles.formActions} ${styles.spanFull}`}>
          <button className={styles.button} type="submit">
            Salvar fornecedor
          </button>
          <p>
            Mundial é somente entrega. Enquanto a entrega estiver ativa, a
            cotação é obrigatória conforme a regra comercial.
          </p>
        </div>
      </LogisticsActionForm>
      {supplier.pickup_locations.length ? (
        <div className={styles.pickupList}>
          <h3>Locais de retirada</h3>
          {supplier.pickup_locations.map((location) => (
            <div className={styles.pickupRow} key={location.pickup_location_id}>
              <strong>{location.display_name}</strong>
              <span>
                {location.street}, {location.street_number} ·{" "}
                {location.neighborhood} · {location.city_name}/
                {location.state_code} · CEP {location.postal_code}
              </span>
              <small>
                {location.is_active ? "Ativo" : "Inativo"} ·{" "}
                {location.location_code}
              </small>
            </div>
          ))}
        </div>
      ) : null}
    </LogisticsPanel>
  );
}

export default async function LogisticsSuppliersPage() {
  const result = await getAdminLogisticsSuppliers();

  return (
    <LogisticsPage
      title="Fornecedores"
      description="Gerencie as modalidades e prazos operacionais já registrados. Produtos só mudam de fornecedor na seção Produtos, por atribuição explícita."
    >
      {result.status === "unavailable" ? (
        <LogisticsReadNotice
          issue={result.reason}
          rpc="admin_list_logistics_suppliers"
        />
      ) : result.data.length ? (
        result.data.map((supplier) => (
          <SupplierCard key={supplier.supplier_id} supplier={supplier} />
        ))
      ) : (
        <LogisticsPanel title="Nenhum fornecedor disponível">
          <p className={styles.supportCopy}>
            A consulta administrativa retornou zero fornecedores. Não foram
            criados registros pela interface.
          </p>
        </LogisticsPanel>
      )}
    </LogisticsPage>
  );
}
