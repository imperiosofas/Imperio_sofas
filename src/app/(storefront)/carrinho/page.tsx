import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

export const metadata: Metadata = {
  title: "Sacola",
  description: "Acompanhe em breve os produtos escolhidos na Império Sofás.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <main className="relative isolate grid min-h-[calc(100svh-76px)] overflow-hidden bg-ink px-4 py-16 text-ivory lg:min-h-[calc(100svh-88px)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,rgba(215,170,66,.13),transparent_45%)]"
      />
      <section className="shell my-auto w-full max-w-3xl rounded-[2rem] border border-white/10 bg-card/80 px-6 py-10 text-center shadow-2xl shadow-black/30 sm:px-12 sm:py-14">
        <span className="mx-auto grid size-16 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
          <ShoppingBag size={27} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <p className="eyebrow mt-7">Sua sacola</p>
        <h1 className="mx-auto mt-3 max-w-xl font-display text-5xl font-semibold leading-[.95] tracking-[-.03em] sm:text-7xl">
          Compras online em preparação.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted sm:text-base">
          Estamos preparando a sacola, as opções de entrega e o checkout. Por
          enquanto, explore a coleção e veja os modelos que forem publicados na
          loja.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/loja/sofas"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            Explorar sofás <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href="/#catalogo"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            Ver destaques da landing
          </Link>
        </div>
      </section>
    </main>
  );
}
