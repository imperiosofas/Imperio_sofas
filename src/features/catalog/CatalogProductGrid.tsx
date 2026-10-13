import Image from "next/image";
import Link from "next/link";
import type { PublishedCatalogProduct } from "./types";
import { formatBrlFromCents } from "../../lib/money";
import styles from "./catalog-listing.module.css";
import type { ReviewSummary } from "../commerce/data";
import { FavoriteButton } from "../commerce/FavoriteButton";

export function CatalogProductGrid({
  products,
  summaries,
  favorites,
}: {
  products: PublishedCatalogProduct[];
  summaries: Map<string, ReviewSummary>;
  favorites: Set<string>;
}) {
  return (
    <ul className={styles.productGrid}>
      {products.map((product, index) => {
        const image = product.media[0];
        const second = product.media[1];
        const widths =
          product.widthsMm ?? (product.widthMm ? [product.widthMm] : []);
        const summary = summaries.get(product.id);
        return (
          <li key={product.id}>
            <Link className={styles.card} href={`/produto/${product.slug}`}>
              <div className={styles.cardImage}>
                {image ? (
                  <>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      unoptimized
                      sizes="(max-width: 600px) 46vw, (max-width: 1050px) 45vw, (max-width: 1600px) 29vw, 22vw"
                      priority={index < 2}
                      className={styles.primaryImage}
                    />
                    {second && (
                      <Image
                        src={second.src}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 600px) 46vw, (max-width: 1050px) 45vw, (max-width: 1600px) 29vw, 22vw"
                        className={styles.secondaryImage}
                      />
                    )}
                  </>
                ) : (
                  <span className={styles.imageFallback}>Império Sofás</span>
                )}
              </div>
              <div className={styles.cardInfo}>
                <h2>{product.name}</h2>
                <p className={styles.stockStatus}>
                  {product.stockStatus === "low_stock"
                    ? "Estoque baixo"
                    : product.stockStatus === "unavailable"
                      ? "Indisponível"
                      : "Disponível"}
                </p>
                {summary && (
                  <p className={styles.cardRating}>
                    ★ {summary.average_rating.toFixed(1).replace(".", ",")}{" "}
                    <span>({summary.review_count})</span>
                  </p>
                )}
                {widths.length > 0 && (
                  <p className={styles.measure}>
                    {widths.length === 1
                      ? `${(widths[0] / 1000).toFixed(2).replace(".", ",")} m`
                      : `${widths.length} medidas disponíveis`}
                  </p>
                )}
                <p className={styles.price}>
                  {product.maxPriceCents &&
                  product.maxPriceCents !== product.priceCents
                    ? `${formatBrlFromCents(product.priceCents)} – ${formatBrlFromCents(product.maxPriceCents)}`
                    : formatBrlFromCents(product.priceCents)}
                </p>
              </div>
            </Link>
            <FavoriteButton
              productId={product.id}
              initial={favorites.has(product.id)}
              returnTo={`/produto/${product.slug}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
