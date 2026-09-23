import { Layers3, Palette, Scissors, ShieldCheck, Waves } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

// Itens baseados no briefing da marca. Ajuste o texto aqui após a validação comercial final.
const items = [
  {
    icon: Layers3,
    title: "Tecido de primeira",
    copy: "Opções bonitas, agradáveis ao toque e pensadas para o uso de todos os dias.",
  },
  {
    icon: ShieldCheck,
    title: "Espuma que não afina",
    copy: "Estrutura de conforto feita para manter o sofá encorpado por muito mais tempo.",
  },
  {
    icon: Scissors,
    title: "Costura dupla",
    copy: "Reforço nos detalhes para um acabamento mais resistente e bem construído.",
  },
  {
    icon: Waves,
    title: "Molas ensacadas",
    copy: "Apoio individual e conforto equilibrado para sentar, relaxar e aproveitar.",
  },
  {
    icon: Palette,
    title: "Do seu jeito",
    copy: "Escolha cores, tecidos e configurações para combinar com a sua casa.",
  },
] as const;

export function Differentials() {
  return (
    <section
      id="diferenciais"
      className="section-pad relative overflow-x-clip border-y border-white/7 bg-ink-soft"
    >
      <div
        className="pointer-events-none absolute -right-16 top-0 select-none font-display text-[22rem] leading-none text-white/[.025]"
        aria-hidden="true"
      >
        I
      </div>
      <div className="shell relative grid gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            eyebrow="Construído para durar"
            title="Conforto que você sente. Qualidade que você reconhece."
            copy="Do tecido à estrutura, cada escolha importa para o sofá acompanhar a vida real da sua casa."
          />
          <div
            className="mt-10 hidden h-px w-28 bg-gold/70 lg:block"
            aria-hidden="true"
          />
        </div>
        <div className="border-t border-white/20">
          {items.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-white/15 py-7 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-6 sm:py-9 lg:py-11">
                <span
                  className="pt-1 font-display text-2xl tabular-nums text-gold/80 sm:text-3xl"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-[2rem] font-medium leading-none tracking-[-.025em] text-ivory sm:text-4xl xl:text-5xl">
                      {item.title}
                    </h3>
                    <item.icon
                      className="mt-1 size-6 shrink-0 text-gold sm:size-7"
                      strokeWidth={1.4}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-4 max-w-md text-sm leading-6 text-muted sm:text-base sm:leading-7">
                    {item.copy}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
