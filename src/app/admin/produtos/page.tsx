import { CatalogManagementCenter } from "../../../features/admin/CatalogManagementCenter";
import {
  listAdminCategories,
  listAdminProducts,
} from "../../../features/admin/catalog-data";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const [products, categories] = await Promise.all([
    listAdminProducts(supabase),
    listAdminCategories(supabase),
  ]);
  const imagePaths = products.map(
    (product) =>
      [...product.product_media].sort((a, b) => a.position - b.position)[0]
        ?.storage_path,
  );
  const paths = [
    ...new Set(imagePaths.filter((path): path is string => !!path)),
  ];
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from("catalog-images")
      .createSignedUrls(paths, 15 * 60);
    data?.forEach((item, index) => {
      if (item.signedUrl) signedByPath.set(paths[index], item.signedUrl);
    });
  }
  const withThumbnails = products.map((product, index) => ({
    ...product,
    thumbnail: imagePaths[index]
      ? (signedByPath.get(imagePaths[index]!) ?? null)
      : null,
  }));
  const stringParam = (
    value: string | string[] | undefined,
    fallback: string,
  ) => (typeof value === "string" ? value : fallback);
  const requestedPage = Number(stringParam(query.page, "1"));
  const initialPage = Number.isInteger(requestedPage)
    ? Math.max(1, Math.min(requestedPage, 1000))
    : 1;
  const categoryError = stringParam(query.categoryError, "");
  const flashMessage =
    stringParam(query.categorySaved, "") === "1"
      ? "Categoria atualizada."
      : categoryError === "duplicate"
        ? "Já existe uma categoria com esse nome ou endereço."
        : categoryError
          ? "Não foi possível atualizar a categoria."
          : "";

  return (
    <CatalogManagementCenter
      products={withThumbnails}
      categories={categories}
      initialQuery={stringParam(query.q, "")}
      initialCategory={stringParam(query.category, "all")}
      initialStatus={stringParam(query.status, "all")}
      initialStock={stringParam(query.stock, "all")}
      initialPending={stringParam(query.pending, "all")}
      initialSort={stringParam(query.sort, "recent")}
      initialPageSize={Number(stringParam(query.size, "25")) || 25}
      initialPage={initialPage}
      flashMessage={flashMessage}
    />
  );
}
