import { ExternalLink, Quote, Star } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { STORE } from "../config";

// Avaliações reais exibidas no Google Maps em 03/09/2026. Revise periodicamente.
const reviews = [
  {
    name: "Luiz P.",
    text: "Atendimento maravilhoso, pessoas super prestativas. Nota 10, vale a pena. Sofá top!",
  },
  {
    name: "Marcelo M.",
    text: "Agradeço à Império Sofás. Continuem com este foco de atendimento e exclusividade.",
  },
  {
    name: "Camila L.",
    text: "Excelente atendimento, equipe super atenciosa. Fiquei muito feliz com meu sofá: ótima qualidade e preço ótimo.",
  },
] as const;

export function Reviews() {
  return (
    <section className="section-pad border-y border-black/10 bg-[#eee9df] text-[#191712]">
      <div className="shell">
        <div className="grid gap-8 border-b border-black/15 pb-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16 lg:pb-14">
          <Reveal>
            <p className="eyebrow !text-[#846324]">Quem compra, recomenda</p>
            <h2 className="mt-4 max-w-3xl font-display text-5xl font-medium leading-[.94] tracking-[-.035em] sm:text-6xl lg:text-7xl">
              Confiança construída em cada sala.
            </h2>
          </Reveal>
          <Reveal className="flex items-end gap-4 lg:justify-end">
            <span className="font-display text-7xl font-medium leading-none tabular-nums sm:text-8xl">
              4,8
            </span>
            <div className="pb-1">
              <div
                className="flex gap-1 text-[#93702d]"
                role="img"
                aria-label="4,8 de 5 estrelas"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={17}
                    fill="currentColor"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-black/60">
                140 avaliações no Google
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-16">
          <Reveal>
            <blockquote className="border-l-2 border-[#93702d] pl-6 sm:pl-9">
              <Quote
                className="mb-5 size-8 text-[#93702d]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="max-w-2xl font-display text-3xl font-medium leading-[1.12] tracking-[-.015em] sm:text-4xl xl:text-5xl">
                “{reviews[0].text}”
              </p>
              <footer className="mt-7 text-sm font-semibold text-[#5c4b30]">
                <cite className="not-italic">{reviews[0].name}</cite>
              </footer>
            </blockquote>
          </Reveal>

          <div className="border-t border-black/15">
            {reviews.slice(1).map((review, index) => (
              <Reveal key={review.name} delay={index * 0.08}>
                <blockquote className="border-b border-black/15 py-7 sm:py-8">
                  <p className="text-base leading-7 text-[#302d27] sm:text-lg sm:leading-8">
                    “{review.text}”
                  </p>
                  <footer className="mt-5 text-sm font-semibold text-[#5c4b30]">
                    <cite className="not-italic">{review.name}</cite>
                  </footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="mt-10 lg:mt-12 lg:text-right">
          <a
            href={STORE.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#71551f] underline decoration-[#93702d]/40 underline-offset-4 transition hover:text-[#191712] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#71551f]"
          >
            Ver avaliações no Google{" "}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
