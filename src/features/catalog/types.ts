export type CatalogStatus = "draft" | "active" | "archived";

export type CatalogCategory = {
  slug: string;
  name: string;
  description: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  description: string;
  widthMm: number | null;
  status: CatalogStatus;
  priceCents: number | null;
  sellableUnits: number;
  media: { src: string; alt: string }[];
};

export type PublishedCatalogProduct = CatalogProduct & {
  status: "active";
  priceCents: number;
  sellableUnits: number;
  widthsMm?: number[];
  priceCount?: number;
  maxPriceCents?: number;
};

export type CatalogListingFilters = {
  categorySlug?: string;
  query?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  widthsMm: number[];
  sort: "newest" | "price_asc" | "price_desc" | "name_asc";
  page: number;
};

export type CatalogListing = {
  products: PublishedCatalogProduct[];
  total: number;
  widths: { widthMm: number; count: number }[];
};

export interface CatalogRepository {
  listCategories(): Promise<CatalogCategory[]>;
  listProducts(): Promise<CatalogProduct[]>;
  listListing(filters: CatalogListingFilters): Promise<CatalogListing>;
  getProductBySlug(slug: string): Promise<CatalogProduct | null>;
}
