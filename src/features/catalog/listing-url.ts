import type { CatalogListingFilters } from "./types";

export const listingSorts = {
  newest: "Mais recentes",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  name_asc: "Nome A–Z",
} as const;

type SearchValues = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const positive = (value: string | undefined) => {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 2_147_483_647
    ? number
    : undefined;
};

export function parseListingFilters(
  values: SearchValues,
  categorySlug?: string,
): CatalogListingFilters {
  const widths = values.largura;
  const sort = one(values.sort);
  const min = positive(one(values.min));
  const max = positive(one(values.max));
  return {
    categorySlug,
    query: one(values.q)?.trim().slice(0, 100) || undefined,
    minPriceCents: min && min <= 21_474_836 ? min * 100 : undefined,
    maxPriceCents: max && max <= 21_474_836 ? max * 100 : undefined,
    widthsMm: [
      ...new Set(
        (Array.isArray(widths) ? widths : widths ? [widths] : [])
          .map((value) => positive(value))
          .filter((value): value is number => value !== undefined),
      ),
    ].slice(0, 20),
    sort:
      sort && Object.hasOwn(listingSorts, sort)
        ? (sort as CatalogListingFilters["sort"])
        : "newest",
    page: Math.min(100000, positive(one(values.page)) ?? 1),
  };
}

export function listingHref(
  path: string,
  filters: CatalogListingFilters,
  changes: Partial<CatalogListingFilters> = {},
) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.minPriceCents) params.set("min", String(next.minPriceCents / 100));
  if (next.maxPriceCents) params.set("max", String(next.maxPriceCents / 100));
  next.widthsMm.forEach((width) => params.append("largura", String(width)));
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
