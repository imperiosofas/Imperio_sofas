import App from "../App";
import {
  landingProductSelection,
  resolveLandingCatalogResults,
} from "../data/products";
import { getPublishedProductBySlug } from "../features/catalog/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const lookupResults = await Promise.allSettled(
    landingProductSelection.map(({ slug }) => getPublishedProductBySlug(slug)),
  );
  const { products: landingProducts, failedLookups } =
    resolveLandingCatalogResults(lookupResults);

  if (failedLookups > 0) {
    console.error("Some landing featured catalog lookups failed.", {
      failedLookups,
    });
  }

  return (
    <App
      landingProducts={landingProducts}
      catalogUnavailable={failedLookups > 0}
    />
  );
}
