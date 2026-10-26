import { getAdminAnalyticsSnapshot } from "../../../features/admin/analytics-data";
import {
  AnalyticsFrame,
  ReportsOverview,
} from "../../../features/admin/analytics-ui/analytics-ui";
import { categoryIdFromSearch } from "../../../features/admin/analytics-ui/search";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categoryId = categoryIdFromSearch(await searchParams);
  const snapshot = await getAdminAnalyticsSnapshot({ categoryId });

  return (
    <AnalyticsFrame
      active="reports"
      title="Relatórios"
      description="Consultas administrativas do estado atual, com download dos dados em Excel."
      route="/admin/relatorios"
      snapshot={snapshot}
      categoryId={categoryId}
    >
      <ReportsOverview snapshot={snapshot} categoryId={categoryId} />
    </AnalyticsFrame>
  );
}
