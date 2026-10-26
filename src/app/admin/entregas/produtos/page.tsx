import {
  assignProductSupplier,
  bulkAssignProductSuppliers,
} from "../../../../features/admin/logistics/actions";
import { LogisticsActionForm } from "../../../../features/admin/logistics/LogisticsActionForm";
import {
  LogisticsEmpty,
  LogisticsPage,
  LogisticsPanel,
  LogisticsReadNotice,
} from "../../../../features/admin/logistics/LogisticsComponents";
import {
  getAdminLogisticsProducts,
  getAdminLogisticsSuppliers,
} from "../../../../features/admin/logistics/data";
import type {
  LogisticsProduct,
  LogisticsSupplier,
} from "../../../../features/admin/logistics/types";
import styles from "../../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

function ProductRow({
  product,
  suppliers,
}: {
  product: LogisticsProduct;
  suppliers: LogisticsSupplier[];
}) {
  return (
    <tr>
      <td>
        <label className={styles.productSelection}>
          <input
            aria-label={`Selecionar ${product.name} para classificação em lote`}
            form="logistics-supplier-bulk-form"
            name="productIds"
            type="checkbox"
            value={product.product_id}
          />
          <span className={styles.srOnly}>Selecionar produto</span>
        </label>
      </td>
      <td>
        <span className={styles.primaryText}>{product.name}</span>
        <span className={styles.secondaryText}>
          {product.slug} · {product.category_name}
        </span>
      </td>
      <td>
        <span
          className={styles.statusPill}
          data-status={product.supplier_id ? "accepted" : undefined}
        >
          {product.supplier_name ?? "Fornecedor não definido"}
        </span>
      </td>
      <td>
        <LogisticsActionForm
          action={assignProductSupplier}
          successMessage={`Fornecedor de ${product.name} atualizado.`}
          className={styles.inlineForm}
        >
          <input type="hidden" name="productId" value={product.product_id} />
          <select
            aria-label={`Fornecedor de ${product.name}`}
            name="supplierId"
            defaultValue={product.supplier_id ?? ""}
          >
            <option value="">Fornecedor não definido</option>
            {suppliers.map((supplier) => (
              <option key={supplier.supplier_id} value={supplier.supplier_id}>
                {supplier.display_name}
              </option>
            ))}
          </select>
          <button className={styles.iconButton} type="submit">
            Salvar
          </button>
        </LogisticsActionForm>
      </td>
    </tr>
  );
}

function queryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export default async function LogisticsProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = queryValue(query.q);
  const [products, supplierResult] = await Promise.all([
    getAdminLogisticsProducts(search || null),
    getAdminLogisticsSuppliers(),
  ]);

  return (
    <LogisticsPage
      title="Produtos"
      description="A classificação é sempre explícita. Selecione apenas os produtos confirmados e escolha Vale ou Mundial; nenhuma atribuição é presumida."
    >
      <LogisticsPanel title="Classificação logística do catálogo">
        <form className={styles.filterForm} method="get">
          <label className={styles.field}>
            <span>Buscar produto</span>
            <input
              autoComplete="off"
              defaultValue={search}
              maxLength={120}
              name="q"
              placeholder="Nome do produto"
              type="search"
            />
          </label>
          <button className={styles.button} type="submit">
            Buscar
          </button>
        </form>

        {products.status === "unavailable" ? (
          <div className={styles.inlineNotice}>
            <LogisticsReadNotice
              issue={products.reason}
              rpc="admin_list_logistics_products"
            />
          </div>
        ) : supplierResult.status === "unavailable" ? (
          <div className={styles.inlineNotice}>
            <LogisticsReadNotice
              issue={supplierResult.reason}
              rpc="admin_list_logistics_suppliers"
            />
          </div>
        ) : products.data.length ? (
          <>
            <LogisticsActionForm
              action={bulkAssignProductSuppliers}
              className={styles.bulkSupplierForm}
              id="logistics-supplier-bulk-form"
              successMessage="Fornecedor aplicado aos produtos selecionados."
            >
              <label className={styles.bulkSupplierField}>
                <span>Fornecedor para os itens selecionados</span>
                <select defaultValue="" name="supplierId" required>
                  <option disabled value="">
                    Selecione Vale ou Mundial
                  </option>
                  {supplierResult.data.map((supplier) => (
                    <option
                      key={supplier.supplier_id}
                      value={supplier.supplier_id}
                    >
                      {supplier.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.bulkSupplierConfirm}>
                <input name="confirm" required type="checkbox" />
                <span>
                  Confirmo que os produtos selecionados pertencem a este
                  fornecedor.
                </span>
              </label>
              <button className={styles.button} type="submit">
                Classificar selecionados
              </button>
              <p className={styles.bulkSupplierHint}>
                A ação é registrada produto a produto, é atômica e aceita até
                100 itens por vez.
              </p>
            </LogisticsActionForm>
            <div className={styles.dataTableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className={styles.srOnly}>Selecionar</span>
                    </th>
                    <th scope="col">Produto</th>
                    <th scope="col">Fornecedor atual</th>
                    <th scope="col">Atribuição individual</th>
                  </tr>
                </thead>
                <tbody>
                  {products.data.map((product) => (
                    <ProductRow
                      key={product.product_id}
                      product={product}
                      suppliers={supplierResult.data}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <LogisticsEmpty title="Nenhum produto encontrado">
            {search
              ? "A busca não encontrou produtos e não modifica a classificação existente."
              : "A RPC retornou uma lista vazia. Nenhum produto foi classificado automaticamente."}
          </LogisticsEmpty>
        )}
        <p className={styles.panelFootnote}>
          Produtos sem classificação aparecem como “Fornecedor não definido” e
          não recebem modalidade logística presumida.
        </p>
      </LogisticsPanel>
    </LogisticsPage>
  );
}
