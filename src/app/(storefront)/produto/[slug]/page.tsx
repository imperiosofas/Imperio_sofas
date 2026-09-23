import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "../../../../features/catalog/queries";
import { formatBrlFromCents } from "../../../../lib/money";

export const dynamic = "force-dynamic";

type ProductPageProps = { params: Promise<{ slug: string }> };
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  return product
    ? {
        title: product.name,
        description: product.description,
        alternates: { canonical: `/produto/${product.slug}` },
      }
    : { title: "Produto não encontrado" };
}
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();
  return (
    <main className="min-h-screen bg-ink text-ivory">
      <section className="section-pad">
        <div className="shell grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-card">
            {product.media[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.media[0].src}
                alt={product.media[0].alt}
                className="aspect-[11/10] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[11/10] place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(215,170,66,.14),transparent_46%)] font-display text-4xl text-gold/80">
                Império Sofás
              </div>
            )}
          </div>
          <div className="py-4">
            <p className="eyebrow">Produto</p>
            <h1 className="mt-4 font-display text-6xl font-semibold leading-[.94] sm:text-7xl">
              {product.name}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted">
              {product.description}
            </p>
            <p className="mt-8 text-sm uppercase tracking-[.14em] text-muted">
              A partir de
            </p>
            <p className="mt-1 font-display text-4xl font-semibold text-gold">
              {formatBrlFromCents(product.priceCents)}
            </p>
            <p className="mt-4 text-sm text-muted">
              Consulte a loja para confirmar a disponibilidade atual.
            </p>
            <Link
              href="/loja"
              className="mt-6 inline-flex min-h-11 items-center rounded-full border border-gold/40 px-5 text-sm font-semibold text-gold transition hover:bg-gold hover:text-ink"
            >
              Voltar para a loja
            </Link>
            <div className="mt-8 rounded-2xl border border-gold/20 bg-card/70 p-5 text-sm leading-6 text-muted">
              Estamos finalizando a experiência de compra online. Por enquanto,
              as informações desta página são para consulta; a compra pelo site
              ainda não está disponível.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
