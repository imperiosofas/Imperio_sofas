import { getAdminAnalyticsSnapshot } from "../../../../features/admin/analytics-data";
import {
  AnalyticsFrame,
  BehaviorAnalytics,
} from "../../../../features/admin/analytics-ui/analytics-ui";
import { categoryIdFromSearch } from "../../../../features/admin/analytics-ui/search";

export default async function BehaviorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const categoryId = categoryIdFromSearch(await searchParams);
  const snapshot = await getAdminAnalyticsSnapshot({ categoryId });

  return (
    <AnalyticsFrame
      active="behavior"
      title="Comportamento"
      description="Eventos de interesse só serão exibidos quando a coleta legítima, o consentimento e as proteções de privacidade estiverem definidos."
      route="/admin/analytics/comportamento"
      snapshot={snapshot}
      categoryId={categoryId}
    >
      <BehaviorAnalytics />
    </AnalyticsFrame>
  );
}
