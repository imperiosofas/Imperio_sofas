import type { ReactNode } from "react";
import { AdminShell } from "../../features/admin/AdminShell";
import { requireCatalogAdmin } from "../../lib/supabase/admin-access";

export const dynamic = "force-dynamic";

export default async function CatalogAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCatalogAdmin("/admin");
  return <AdminShell>{children}</AdminShell>;
}
