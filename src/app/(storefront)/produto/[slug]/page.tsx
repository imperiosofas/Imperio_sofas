import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "../../../../features/catalog/queries";

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
      <header className="border-b border-white/10 bg-ink-soft/80">
        <div className="shell flex min-h-20 items-center justify-between gap-4">
          <Link href="/loja" className="text-sm font-semibold text-gold">
            ← Voltar para a loja
          </Link>
          <Image
            src="/imperio-sofas-logo-384.webp"
            alt="Império Sofás"
            width={64}
            height={64}
            className="size-14 [clip-path:circle(46%)]"
            priority
          />
        </div>
      </header>
      <section className="section-pad">
        <div className="shell">
          <p className="eyebrow">Produto</p>
          <h1 className="mt-4 font-display text-6xl font-semibold">
            {product.name}
          </h1>
          <p className="mt-6 max-w-xl text-muted">{product.description}</p>
          <p className="mt-8 text-sm text-muted">
            Preço e disponibilidade serão exibidos após a validação comercial
            deste produto.
          </p>
        </div>
      </section>
    </main>
  );
}
