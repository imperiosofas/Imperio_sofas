import { ProductEditor } from "../../../../features/admin/ProductEditor";
import { listAdminCategories } from "../../../../features/admin/catalog-data";
import { requireCatalogAdmin } from "../../../../lib/supabase/admin-access";

export default async function NewProductPage() {
  const supabase = await requireCatalogAdmin("/admin/produtos/novo");
  const categories = await listAdminCategories(supabase);
  return <ProductEditor product={null} categories={categories} />;
}
