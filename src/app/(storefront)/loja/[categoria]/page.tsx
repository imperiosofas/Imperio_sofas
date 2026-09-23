import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
      <header className="border-b border-white/10 bg-ink-soft/80">
        <div className="shell flex min-h-20 items-center justify-between gap-4">
          <Link href="/" aria-label="Voltar para a página inicial">
            <Image
              src="/imperio-sofas-logo-384.webp"
              alt="Império Sofás"
              width={64}
              height={64}
              className="size-14 [clip-path:circle(46%)]"
              priority
            />
          </Link>
          <Link href="/loja" className="text-sm font-semibold text-gold">
            Todas as coleções
          </Link>
        </div>
      </header>
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
