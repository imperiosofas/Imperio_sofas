import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogEmptyState } from "../../../../features/catalog/CatalogEmptyState";
import { CatalogProductGrid } from "../../../../features/catalog/CatalogProductGrid";
import {
  getCatalogCategories,
  getPublishedProducts,
} from "../../../../features/catalog/queries";

export const dynamic = "force-dynamic";

type CategoryPageProps = { params: Promise<{ categoria: string }> };
export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
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
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoria } = await params;
  const category = (await getCatalogCategories()).find(
    (item) => item.slug === categoria,
  );
  if (!category) notFound();
  const products = await getPublishedProducts(category.slug);
  return (
    <main className="min-h-screen bg-ink text-ivory">
      <section className="section-pad">
        <div className="shell">
          <p className="eyebrow">Coleção</p>
          <h1 className="mt-4 font-display text-6xl font-semibold leading-[.92] sm:text-8xl">
            {category.name}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {category.description}
          </p>
          <div className="mt-12">
            {products.length > 0 ? (
              <CatalogProductGrid products={products} />
            ) : (
              <CatalogEmptyState categoryName={category.name} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
