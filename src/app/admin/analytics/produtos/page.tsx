import { getAdminAnalyticsSnapshot } from "../../../../features/admin/analytics-data";
import {
  AnalyticsFrame,
  ProductAnalytics,
} from "../../../../features/admin/analytics-ui/analytics-ui";
import { categoryIdFromSearch } from "../../../../features/admin/analytics-ui/search";

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categoryId = categoryIdFromSearch(await searchParams);
  const snapshot = await getAdminAnalyticsSnapshot({ categoryId });

  return (
    <AnalyticsFrame
      active="products"
      title="Produtos"
      description="Disponibilidade atual por produto. Popularidade, visualizações e interesse ainda não são medidos por este snapshot."
      route="/admin/analytics/produtos"
      snapshot={snapshot}
      categoryId={categoryId}
    >
      <ProductAnalytics snapshot={snapshot} />
    </AnalyticsFrame>
  );
}
