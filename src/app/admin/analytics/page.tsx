import { getAdminAnalyticsSnapshot } from "../../../features/admin/analytics-data";
import {
  AnalyticsFrame,
  AnalyticsOverview,
} from "../../../features/admin/analytics-ui/analytics-ui";
import { categoryIdFromSearch } from "../../../features/admin/analytics-ui/search";

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categoryId = categoryIdFromSearch(await searchParams);
  const snapshot = await getAdminAnalyticsSnapshot({ categoryId });

  return (
    <AnalyticsFrame
      active="overview"
      title="Visão geral"
      description="Uma leitura objetiva do catálogo e da posição atual do estoque, sem projeções ou comparação de períodos."
      route="/admin/analytics"
      snapshot={snapshot}
      categoryId={categoryId}
    >
      <AnalyticsOverview snapshot={snapshot} />
    </AnalyticsFrame>
  );
}
