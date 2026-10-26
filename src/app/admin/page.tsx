import type { Metadata } from "next";
import { OverviewDashboard } from "../../features/admin/overview/OverviewDashboard";
import { getOverviewData } from "../../features/admin/overview/overview-data";

export const metadata: Metadata = {
  title: "Visão geral | Administração",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const data = await getOverviewData();
  return <OverviewDashboard {...data} />;
}
