import type { ReactNode } from "react";
import { LogisticsNav } from "../../../features/admin/logistics/LogisticsNav";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import styles from "../../../features/admin/logistics/logistics.module.css";

export const dynamic = "force-dynamic";

export default async function LogisticsAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCatalogAdmin("/admin/entregas");
  return (
    <div className={styles.workspace}>
      <div className={styles.workspaceIntro}>
        <span>Operação</span>
        <strong>Entregas</strong>
      </div>
      <LogisticsNav />
      {children}
    </div>
  );
}
