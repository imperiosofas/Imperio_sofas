import type { Metadata } from "next";
import Link from "next/link";
import { CatalogEmptyState } from "../../../features/catalog/CatalogEmptyState";
import { CatalogProductGrid } from "../../../features/catalog/CatalogProductGrid";
import {
  getCatalogCategories,
  getPublishedProducts,
} from "../../../features/catalog/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja",
  description: "Conheça as coleções da Império Sofás.",
  alternates: { canonical: "/loja" },
};

export default async function StorePage() {
  const [categories, products] = await Promise.all([
    getCatalogCategories(),
    getPublishedProducts(),
  ]);
  return (
    <main className="min-h-screen bg-ink text-ivory">
      <section className="section-pad relative overflow-hidden">
        <div className="grain pointer-events-none absolute inset-0 opacity-30" />
        <div className="shell relative">
          <p className="eyebrow">Império Sofás</p>
          <h1 className="mt-4 max-w-3xl font-display text-6xl font-semibold leading-[.92] tracking-[-.04em] sm:text-8xl">
            Conforto para chamar de seu.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Explore nossas coleções e encontre o modelo que combina com a sua
            casa. O catálogo comercial será publicado conforme cada informação
            for validada.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" aria-label="Categorias">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/loja/${category.slug}`}
                className="rounded-full border border-gold/30 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10"
              >
                {category.name}
              </Link>
            ))}
          </div>
          <div className="mt-12">
            {products.length > 0 ? (
              <CatalogProductGrid products={products} />
            ) : (
              <CatalogEmptyState />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
