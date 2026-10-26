"use client";

import { AnalyticsRouteError } from "../../../features/admin/analytics-ui/analytics-route-error";

export default function ReportsErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AnalyticsRouteError reset={reset} />;
}
