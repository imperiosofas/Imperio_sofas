import type { Metadata } from "next";
import Link from "next/link";
import { formatBrlFromCents } from "../../../../lib/money";
import { requireCatalogAdmin } from "../../../../lib/supabase/admin-access";
import {
  fetchSalesReport,
  resolveRange,
} from "../../../../features/admin/sales-report/sales-report";
import styles from "./sales.module.css";

export const metadata: Metadata = {
  title: "Vendas | Administração",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogAdmin("/admin/relatorios/vendas");
  const params = await searchParams;
  const range = resolveRange(one(params.from), one(params.to));
  const report = await fetchSalesReport(client, range);
  const { totals } = report;
  const maxDay = Math.max(1, ...report.by_day.map((d) => d.revenue_cents));
  const query = `from=${range.from}&to=${range.to}`;

  return (
    <section className={styles.page}>
      <div>
        <Link className={styles.back} href="/admin/relatorios">
          ← Relatórios
        </Link>
        <p className={styles.eyebrow}>Relatórios</p>
        <h1>Vendas</h1>
        <p className={styles.lead}>
          Só entram pedidos pagos, pela data do pagamento. Pedidos cancelados,
          expirados, em análise ou reembolsados não contam como receita.
        </p>
      </div>

      <form className={styles.range} method="get">
        <label>
          De
          <input type="date" name="from" defaultValue={range.from} required />
        </label>
        <label>
          Até
          <input type="date" name="to" defaultValue={range.to} required />
        </label>
        <button type="submit">Aplicar</button>
        <a href={`/api/admin/reports/sales.xlsx?${query}`}>Baixar Excel</a>
      </form>

      {totals.orders === 0 ? (
        <p className={styles.empty}>
          Nenhum pedido pago neste período. Quando houver vendas, os números
          aparecem aqui. Nada é estimado.
        </p>
      ) : (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <p className={styles.label}>Receita</p>
              <p className={styles.value}>
                {formatBrlFromCents(totals.revenue_cents)}
              </p>
            </div>
            <div className={styles.tile}>
              <p className={styles.label}>Pedidos pagos</p>
              <p className={styles.value}>{totals.orders}</p>
            </div>
            <div className={styles.tile}>
              <p className={styles.label}>Ticket médio</p>
              <p className={styles.value}>
                {formatBrlFromCents(totals.average_ticket_cents)}
              </p>
            </div>
            <div className={styles.tile}>
              <p className={styles.label}>Unidades vendidas</p>
              <p className={styles.value}>{totals.units}</p>
            </div>
          </div>
          <p className={styles.note}>
            Produtos {formatBrlFromCents(totals.items_cents)} + frete{" "}
            {formatBrlFromCents(totals.freight_cents)} + adicional por andar{" "}
            {formatBrlFromCents(totals.floor_charge_cents)}.
          </p>

          <section className={styles.panel}>
            <h2>Por dia</h2>
            <ul className={styles.bars}>
              {report.by_day.map((day) => (
                <li key={day.day}>
                  <span>
                    {dayFormat.format(new Date(`${day.day}T00:00:00Z`))}
                  </span>
                  <span
                    className={styles.bar}
                    style={{
                      width: `${Math.max(4, (day.revenue_cents / maxDay) * 100)}%`,
                    }}
                    aria-hidden="true"
                  />
                  <strong>{formatBrlFromCents(day.revenue_cents)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Por fornecedor</h2>
            <ul className={styles.rows}>
              {report.by_supplier.map((supplier) => (
                <li key={supplier.supplier_code}>
                  <span>
                    {supplier.supplier_name}
                    <small>
                      {supplier.orders} pedidos · {supplier.units} unidades ·
                      frete {formatBrlFromCents(supplier.freight_cents)}
                    </small>
                  </span>
                  <strong>{formatBrlFromCents(supplier.items_cents)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Produtos mais vendidos</h2>
            <ul className={styles.rows}>
              {report.by_product.map((product) => (
                <li key={product.product_id}>
                  <span>
                    {product.product_name}
                    <small>{product.units} unidades</small>
                  </span>
                  <strong>{formatBrlFromCents(product.revenue_cents)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Entrega e retirada</h2>
            <ul className={styles.rows}>
              {report.by_mode.map((mode) => (
                <li key={mode.mode}>
                  <span>
                    {mode.mode === "pickup" ? "Retirada" : "Entrega"}
                    <small>{mode.groups} entregas ou retiradas</small>
                  </span>
                  <strong>{formatBrlFromCents(mode.items_cents)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}
