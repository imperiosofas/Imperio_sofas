import ExcelJS from "exceljs";
import { requireCatalogAdmin } from "../../../../../lib/supabase/admin-access";
import {
  fetchSalesReport,
  resolveRange,
} from "../../../../../features/admin/sales-report/sales-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CURRENCY = "[$R$-pt-BR] #,##0.00";

function text(value: string) {
  return /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value;
}

function fail(status: number, message: string) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function GET(request: Request) {
  let client;
  try {
    client = await requireCatalogAdmin("/admin/relatorios/vendas");
  } catch (error) {
    const digest =
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : "";
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
      return fail(403, "Acesso administrativo necessário.");
    if (digest.startsWith("NEXT_REDIRECT"))
      return fail(401, "Autentique-se para baixar este relatório.");
    return fail(500, "Não foi possível validar o acesso administrativo.");
  }

  const url = new URL(request.url);
  const range = resolveRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );

  let report;
  try {
    report = await fetchSalesReport(client, range);
  } catch {
    return fail(500, "Não foi possível gerar o relatório de vendas.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Império Sofás";

  const summary = workbook.addWorksheet("Resumo");
  summary.columns = [
    { header: "Indicador", width: 32 },
    { header: "Valor", width: 24 },
  ];
  const t = report.totals;
  summary.addRows([
    ["Período", `${range.from} a ${range.to}`],
    ["Pedidos pagos", t.orders],
    ["Receita", t.revenue_cents / 100],
    ["Produtos", t.items_cents / 100],
    ["Frete", t.freight_cents / 100],
    ["Adicional por andar", t.floor_charge_cents / 100],
    ["Ticket médio", t.average_ticket_cents / 100],
    ["Unidades vendidas", t.units],
  ]);
  for (const row of [4, 5, 6, 7, 8])
    summary.getCell(`B${row}`).numFmt = CURRENCY;

  const days = workbook.addWorksheet("Por dia");
  days.columns = [
    { header: "Dia", width: 14 },
    { header: "Pedidos", width: 12 },
    { header: "Receita", width: 18, style: { numFmt: CURRENCY } },
  ];
  for (const d of report.by_day)
    days.addRow([d.day, d.orders, d.revenue_cents / 100]);

  const suppliers = workbook.addWorksheet("Por fornecedor");
  suppliers.columns = [
    { header: "Fornecedor", width: 24 },
    { header: "Pedidos", width: 12 },
    { header: "Unidades", width: 12 },
    { header: "Produtos", width: 18, style: { numFmt: CURRENCY } },
    { header: "Frete", width: 18, style: { numFmt: CURRENCY } },
  ];
  for (const s of report.by_supplier)
    suppliers.addRow([
      text(s.supplier_name),
      s.orders,
      s.units,
      s.items_cents / 100,
      s.freight_cents / 100,
    ]);

  const products = workbook.addWorksheet("Por produto");
  products.columns = [
    { header: "Produto", width: 40 },
    { header: "Unidades", width: 12 },
    { header: "Receita", width: 18, style: { numFmt: CURRENCY } },
  ];
  for (const p of report.by_product)
    products.addRow([text(p.product_name), p.units, p.revenue_cents / 100]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": MIME,
      "Content-Disposition": `attachment; filename="imperio-vendas-${range.from}_${range.to}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
