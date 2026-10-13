import { notFound } from "next/navigation";
import { ProductEditor } from "../../../../features/admin/ProductEditor";
import {
  getAdminProduct,
  listAdminCategories,
} from "../../../../features/admin/catalog-data";
import { requireCatalogAdmin } from "../../../../lib/supabase/admin-access";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await requireCatalogAdmin(`/admin/produtos/${id}`);
  const [product, categories] = await Promise.all([
    getAdminProduct(supabase, id),
    listAdminCategories(supabase),
  ]);
  if (!product) notFound();
  const signedMedia = await Promise.all(
    product.product_media.map(async (media) => {
      const { data } = await supabase.storage
        .from("catalog-images")
        .createSignedUrl(media.storage_path, 15 * 60);
      return data?.signedUrl
        ? { id: media.id, url: data.signedUrl, alt: media.alt_text }
        : null;
    }),
  );
  return (
    <ProductEditor
      product={product}
      categories={categories}
      error={typeof query.error === "string" ? query.error : undefined}
      saved={query.saved === "1"}
      imageSaved={query.imageSaved === "1"}
      imageRemoved={query.imageRemoved === "1"}
      signedMedia={signedMedia.filter((media) => media !== null)}
    />
  );
}
