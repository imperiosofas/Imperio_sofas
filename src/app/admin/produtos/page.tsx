import { CatalogManagementCenter } from "../../../features/admin/CatalogManagementCenter";
import {
  listAdminCategories,
  listAdminProductsPage,
} from "../../../features/admin/catalog-data";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const supabase = await requireCatalogAdmin("/admin/produtos");
  const stringParam = (
    value: string | string[] | undefined,
    fallback: string,
  ) => (typeof value === "string" ? value : fallback);
  const categoryValue = stringParam(query.category, "all");
  const categoryId = z.string().uuid().safeParse(categoryValue).success
    ? categoryValue
    : null;
  const statusValue = stringParam(query.status, "all");
  const stockValue = stringParam(query.stock, "all");
  const pendingValue = stringParam(query.pending, "all");
  const sortValue = stringParam(query.sort, "recent");
  const requestedSize = Number(stringParam(query.size, "25"));
  const pageSize = [25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const requestedPage = Number(stringParam(query.page, "1"));
  const page = Number.isInteger(requestedPage)
    ? Math.max(1, Math.min(requestedPage, 1000))
    : 1;
  const [productPage, categories] = await Promise.all([
    listAdminProductsPage(supabase, {
      query: stringParam(query.q, "").trim().slice(0, 180),
      categoryId,
      status: statusValue,
      stock: stockValue,
      pending: pendingValue,
      sort: sortValue,
      page,
      pageSize,
    }),
    listAdminCategories(supabase),
  ]);
  const products = productPage.products;
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
      total={productPage.total}
      summary={productPage.summary}
      categories={categories}
      initialQuery={stringParam(query.q, "")}
      initialCategory={categoryId ?? "all"}
      initialStatus={statusValue}
      initialStock={stockValue}
      initialPending={pendingValue}
      initialSort={sortValue}
      initialPageSize={pageSize}
      initialPage={productPage.page}
      flashMessage={flashMessage}
    />
  );
}
