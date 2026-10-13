import Link from "next/link";
import { getCatalogCategories, getCatalogListing } from "./queries";
import { CatalogProductGrid } from "./CatalogProductGrid";
import { CatalogListingControls } from "./CatalogListingControls";
import { listingHref, parseListingFilters } from "./listing-url";
import styles from "./catalog-listing.module.css";
import { getMyFavorites, getReviewSummaries } from "../commerce/data";

type SearchValues = Record<string, string | string[] | undefined>;

export async function CatalogListingPage({
  categorySlug,
  categoryName,
  searchValues,
}: {
  categorySlug?: string;
  categoryName?: string;
  searchValues: SearchValues;
}) {
  const path = categorySlug ? `/loja/${categorySlug}` : "/loja";
  const filters = parseListingFilters(searchValues, categorySlug);
  const [categories, listing] = await Promise.all([
    getCatalogCategories(),
    getCatalogListing(filters),
  ]);
  const productIds = listing.products.map((product) => product.id);
  const [summaries, favorites] = await Promise.all([
    getReviewSummaries(productIds),
    getMyFavorites(productIds),
  ]);
  const pages = Math.ceil(listing.total / 12);
  const activeCount =
    Number(Boolean(filters.query)) +
    Number(Boolean(filters.minPriceCents)) +
    Number(Boolean(filters.maxPriceCents)) +
    filters.widthsMm.length;
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <div>
            <p className={styles.kicker}>Catálogo</p>
            <h1>{categoryName ?? "Loja"}</h1>
          </div>
        </header>
        <nav className={styles.categories} aria-label="Categorias da loja">
          <Link href="/loja" aria-current={!categorySlug ? "page" : undefined}>
            Todos
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/loja/${category.slug}`}
              aria-current={category.slug === categorySlug ? "page" : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
        <CatalogListingControls
          path={path}
          filters={filters}
          widths={listing.widths}
          total={listing.total}
          activeCount={activeCount}
        />
        <div className={styles.results}>
          {listing.products.length ? (
            <CatalogProductGrid
              products={listing.products}
              summaries={summaries}
              favorites={favorites.ids}
            />
          ) : (
            <div className={styles.empty}>
              <h2>
                {activeCount
                  ? "Nenhum modelo encontrado."
                  : "Nenhum modelo disponível no momento."}
              </h2>
              {activeCount > 0 && <Link href={path}>Limpar filtros</Link>}
            </div>
          )}
        </div>
        {pages > 1 && (
          <nav className={styles.pagination} aria-label="Páginas de produtos">
            {filters.page > 1 && (
              <Link
                href={listingHref(path, filters, { page: filters.page - 1 })}
              >
                Anterior
              </Link>
            )}
            <span>
              Página {filters.page} de {pages}
            </span>
            {filters.page < pages && (
              <Link
                href={listingHref(path, filters, { page: filters.page + 1 })}
              >
                Próxima
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
