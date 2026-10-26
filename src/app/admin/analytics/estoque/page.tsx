import { getAdminAnalyticsSnapshot } from "../../../../features/admin/analytics-data";
import {
  AnalyticsFrame,
  InventoryAnalytics,
} from "../../../../features/admin/analytics-ui/analytics-ui";
import { categoryIdFromSearch } from "../../../../features/admin/analytics-ui/search";

export default async function InventoryAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categoryId = categoryIdFromSearch(await searchParams);
  const snapshot = await getAdminAnalyticsSnapshot({ categoryId });

  return (
    <AnalyticsFrame
      active="stock"
      title="Estoque"
      description="Saldos internos atuais por categoria, com foco nas variantes que exigem atenção."
      route="/admin/analytics/estoque"
      snapshot={snapshot}
      categoryId={categoryId}
    >
      <InventoryAnalytics snapshot={snapshot} />
    </AnalyticsFrame>
  );
}
