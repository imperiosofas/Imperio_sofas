import { z } from "zod";

const count = z.coerce.number();

export const salesReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  totals: z.object({
    orders: count,
    revenue_cents: count,
    items_cents: count,
    freight_cents: count,
    floor_charge_cents: count,
    average_ticket_cents: count,
    units: count,
  }),
  by_day: z.array(
    z.object({ day: z.string(), orders: count, revenue_cents: count }),
  ),
  by_supplier: z.array(
    z.object({
      supplier_code: z.string(),
      supplier_name: z.string(),
      orders: count,
      units: count,
      items_cents: count,
      freight_cents: count,
    }),
  ),
  by_product: z.array(
    z.object({
      product_id: z.string(),
      product_name: z.string(),
      units: count,
      revenue_cents: count,
    }),
  ),
  by_mode: z.array(
    z.object({
      mode: z.enum(["delivery", "pickup"]),
      groups: count,
      items_cents: count,
    }),
  ),
});

export type SalesReport = z.infer<typeof salesReportSchema>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function validDay(value: string | undefined): value is string {
  if (!value || !DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDay(parsed) === value;
}

/** Defaults to the last 30 days (São Paulo calendar); invalid input falls back. */
export function resolveRange(from?: string, to?: string) {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const end = validDay(to) ? to : todayIso;
  const fallbackStart = new Date(`${end}T00:00:00Z`);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 29);
  let start = validDay(from) ? from : isoDay(fallbackStart);
  if (start > end) start = end;
  const span =
    (new Date(`${end}T00:00:00Z`).getTime() -
      new Date(`${start}T00:00:00Z`).getTime()) /
    86_400_000;
  if (span > MAX_DAYS) {
    const clamped = new Date(`${end}T00:00:00Z`);
    clamped.setUTCDate(clamped.getUTCDate() - MAX_DAYS);
    start = isoDay(clamped);
  }
  return { from: start, to: end };
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function fetchSalesReport(
  client: RpcClient,
  range: { from: string; to: string },
): Promise<SalesReport> {
  const { data, error } = await client.rpc("admin_get_sales_report", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error("Não foi possível carregar o relatório.");
  return salesReportSchema.parse(data);
}
