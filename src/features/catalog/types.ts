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
  widthMm: number;
  status: CatalogStatus;
  priceCents: number | null;
  sellableUnits: number;
  media: { src: string; alt: string }[];
};

export interface CatalogRepository {
  listCategories(): Promise<CatalogCategory[]>;
  listProducts(): Promise<CatalogProduct[]>;
  getProductBySlug(slug: string): Promise<CatalogProduct | null>;
}
