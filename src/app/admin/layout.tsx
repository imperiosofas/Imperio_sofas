import type { ReactNode } from "react";
import { headers } from "next/headers";
import { AdminShell } from "../../features/admin/AdminShell";
import { requireCatalogAdmin } from "../../lib/supabase/admin-access";

export const dynamic = "force-dynamic";

export default async function CatalogAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const path = (await headers()).get("x-pathname") ?? "";
  // Keep the admin sub-page as the post-login destination (only /admin paths).
  await requireCatalogAdmin(
    /^\/admin(\/[\w\-/]*)?$/.test(path) ? path : "/admin",
  );
  return <AdminShell>{children}</AdminShell>;
}
