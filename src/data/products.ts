import type {
  CatalogProduct,
  PublishedCatalogProduct,
} from "../features/catalog/types";

/**
 * Editorial selection only. Commercial fields (name, price, dimensions, stock,
 * and image) must always come from a currently published catalog record.
 */
export const landingProductSelection = [
  { slug: "sofas-sofa-belize", objectPosition: "center 65%" },
  { slug: "sofa-berlim", objectPosition: "center 65%" },
  { slug: "sofas-sofa-dallas", objectPosition: "center 65%" },
  { slug: "sofas-sofa-maximo", objectPosition: "center 100%" },
] as const;

export type LandingCatalogProduct = PublishedCatalogProduct & {
  objectPosition: string;
};

function isPublishedAndRenderable(
  product: CatalogProduct,
): product is PublishedCatalogProduct {
  return (
    product.status === "active" &&
    product.priceCents !== null &&
    product.priceCents > 0 &&
    product.stockStatus !== "unavailable" &&
    product.media.some((media) => Boolean(media.src && media.alt))
  );
}

export function selectLandingCatalogProducts(
  catalogProducts: readonly (CatalogProduct | null)[],
): LandingCatalogProduct[] {
  const bySlug = new Map(
    catalogProducts
      .filter(
        (product): product is PublishedCatalogProduct =>
          product !== null && isPublishedAndRenderable(product),
      )
      .map((product) => [product.slug, product]),
  );

  return landingProductSelection.flatMap(({ slug, objectPosition }) => {
    const product = bySlug.get(slug);
    return product ? [{ ...product, objectPosition }] : [];
  });
}

export function resolveLandingCatalogResults(
  results: readonly PromiseSettledResult<CatalogProduct | null>[],
): { products: LandingCatalogProduct[]; failedLookups: number } {
  const fulfilledProducts: CatalogProduct[] = [];
  let failedLookups = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) fulfilledProducts.push(result.value);
    } else {
      failedLookups += 1;
    }
  }

  return {
    products: selectLandingCatalogProducts(fulfilledProducts),
    failedLookups,
  };
}
