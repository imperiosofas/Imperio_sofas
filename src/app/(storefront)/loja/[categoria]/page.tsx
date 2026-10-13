import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogCategories } from "../../../../features/catalog/queries";
import { CatalogListingPage } from "../../../../features/catalog/CatalogListingPage";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria } = await params;
  const category = (await getCatalogCategories()).find(
    (item) => item.slug === categoria,
  );
  return category
    ? {
        title: category.name,
        description: category.description,
        alternates: { canonical: `/loja/${category.slug}` },
      }
    : { title: "Coleção não encontrada" };
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const { categoria } = await params;
  const category = (await getCatalogCategories()).find(
    (item) => item.slug === categoria,
  );
  if (!category) notFound();
  return (
    <CatalogListingPage
      categorySlug={category.slug}
      categoryName={category.name}
      searchValues={await searchParams}
    />
  );
}
