import { localCatalogRepository } from "./localCatalogRepository";
import type { CatalogCategory, CatalogProduct } from "./types";

const isPubliclySellable = (product: CatalogProduct) =>
  product.status === "active" &&
  product.priceCents !== null &&
  product.sellableUnits > 0;

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  return localCatalogRepository.listCategories();
}
export async function getPublishedProducts(
  categorySlug?: string,
): Promise<CatalogProduct[]> {
  const products = await localCatalogRepository.listProducts();
  return products.filter(
    (product) =>
      isPubliclySellable(product) &&
      (!categorySlug || product.categorySlug === categorySlug),
  );
}
export async function getPublishedProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const product = await localCatalogRepository.getProductBySlug(slug);
  return product && isPubliclySellable(product) ? product : null;
}
export async function getCatalogDraftCount(): Promise<number> {
  const products = await localCatalogRepository.listProducts();
  return products.filter((product) => product.status === "draft").length;
}
