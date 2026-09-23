import Link from "next/link";

export function CatalogEmptyState({
  draftCount,
  categoryName,
}: {
  draftCount: number;
  categoryName?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-gold/20 bg-card/80 p-8 text-center shadow-2xl shadow-black/20 sm:p-12">
      <p className="eyebrow">
        {categoryName ? `Coleção ${categoryName}` : "Catálogo em preparação"}
      </p>
      <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-ivory sm:text-5xl">
        Estamos escolhendo cada detalhe.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
        Os modelos estão passando por revisão de medidas, tecidos, preços e
        disponibilidade. Assim que tudo estiver confirmado, eles aparecem aqui
        para você comprar com segurança.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-gold px-6 py-3 font-semibold text-ink transition hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Conhecer a loja
        </Link>
        <a
          href="https://wa.me/5512992180333?text=Ol%C3%A1!%20Quero%20saber%20quais%20modelos%20est%C3%A3o%20dispon%C3%ADveis."
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-gold/50 px-6 py-3 font-semibold text-gold transition hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Falar com a loja
        </a>
      </div>
      <p className="mt-8 text-xs uppercase tracking-[.16em] text-muted/70">
        {draftCount} modelos em revisão · nenhuma venda é iniciada por esta
        página
      </p>
    </div>
  );
}
