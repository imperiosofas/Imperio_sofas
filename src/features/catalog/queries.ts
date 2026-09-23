import { getCatalogRepository } from "./repository";
import type {
  CatalogCategory,
  CatalogProduct,
  PublishedCatalogProduct,
} from "./types";

const isPubliclySellable = (
  product: CatalogProduct,
): product is PublishedCatalogProduct =>
  product.status === "active" &&
  product.priceCents !== null &&
  product.sellableUnits > 0;

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  return getCatalogRepository().listCategories();
}
export async function getPublishedProducts(
  categorySlug?: string,
): Promise<PublishedCatalogProduct[]> {
  const products = await getCatalogRepository().listProducts();
  return products
    .filter(isPubliclySellable)
    .filter(
      (product) => !categorySlug || product.categorySlug === categorySlug,
    );
}
export async function getPublishedProductBySlug(
  slug: string,
): Promise<PublishedCatalogProduct | null> {
  const product = await getCatalogRepository().getProductBySlug(slug);
  return product && isPubliclySellable(product) ? product : null;
}
