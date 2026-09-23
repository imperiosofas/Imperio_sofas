import Link from "next/link";
import type { PublishedCatalogProduct } from "./types";
import { formatBrlFromCents } from "../../lib/money";

export function CatalogProductGrid({
  products,
}: {
  products: PublishedCatalogProduct[];
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const image = product.media[0];
        return (
          <li key={product.id}>
            <Link
              href={`/produto/${product.slug}`}
              className="group block h-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-card transition hover:-translate-y-1 hover:border-gold/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <div className="relative aspect-[11/10] overflow-hidden bg-ink-soft">
                {image ? (
                  // Signed Supabase URLs are short lived, so Next's remote image optimizer is not used.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(215,170,66,.14),transparent_46%)] px-8 text-center">
                    <span className="font-display text-3xl text-gold/80">
                      Império Sofás
                    </span>
                  </div>
                )}
              </div>
              <div className="p-5 sm:p-6">
                <p className="eyebrow">Conforto com identidade</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-ivory">
                  {product.name}
                </h2>
                <p className="mt-5 border-t border-white/10 pt-4 text-sm text-muted">
                  A partir de{" "}
                  <span className="font-semibold text-ivory">
                    {formatBrlFromCents(product.priceCents)}
                  </span>
                </p>
                <span className="mt-4 inline-flex min-h-11 items-center rounded-full border border-gold/40 px-5 text-sm font-semibold text-gold transition group-hover:bg-gold group-hover:text-ink">
                  Ver detalhes
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
