import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveAppUrl } from "../../../../lib/env/app-url.mjs";
import { ProductExperience } from "../../../../features/commerce/ProductExperience";
import { getPublicProductLogistics } from "../../../../features/logistics/storefront-data";
import {
  getMyFavorites,
  getMyReview,
  getProductDetail,
  getProductReviews,
  getReviewSummaries,
} from "../../../../features/commerce/data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  return product
    ? {
        title: product.name,
        description: product.description,
        alternates: { canonical: `/produto/${product.slug}` },
      }
    : { title: "Produto não encontrado" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();
  const [reviews, summaries, favorites, ownReview, logistics] =
    await Promise.all([
      getProductReviews(product.id),
      getReviewSummaries([product.id]),
      getMyFavorites([product.id]),
      getMyReview(product.id),
      getPublicProductLogistics(slug),
    ]);
  const summary = summaries.get(product.id);
  const prices = product.variants.map((variant) => variant.price_cents / 100);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: new URL(`/produto/${product.slug}`, resolveAppUrl()).toString(),
    offers:
      lowest === highest
        ? {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: lowest,
            availability: "https://schema.org/InStock",
          }
        : {
            "@type": "AggregateOffer",
            priceCurrency: "BRL",
            lowPrice: lowest,
            highPrice: highest,
            offerCount: product.variants.length,
            availability: "https://schema.org/InStock",
          },
    ...(summary && summary.review_count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: summary.average_rating,
            reviewCount: summary.review_count,
          },
        }
      : {}),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <ProductExperience
        product={product}
        reviews={reviews}
        summary={summary}
        favorite={favorites.ids.has(product.id)}
        signedIn={!!favorites.userId}
        ownReview={ownReview}
        logistics={logistics}
      />
    </>
  );
}
