import { Layers3, Palette, Scissors, ShieldCheck, Waves } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'

// Itens baseados no briefing da marca. Ajuste o texto aqui após a validação comercial final.
const items = [
  { icon: Layers3, title: 'Tecido de primeira', copy: 'Opções bonitas, agradáveis ao toque e pensadas para o uso de todos os dias.' },
  { icon: ShieldCheck, title: 'Espuma que não afina', copy: 'Estrutura de conforto feita para manter o sofá encorpado por muito mais tempo.' },
  { icon: Scissors, title: 'Costura dupla', copy: 'Reforço nos detalhes para um acabamento mais resistente e bem construído.' },
  { icon: Waves, title: 'Molas ensacadas', copy: 'Apoio individual e conforto equilibrado para sentar, relaxar e aproveitar.' },
  { icon: Palette, title: 'Do seu jeito', copy: 'Escolha cores, tecidos e configurações para combinar com a sua casa.' },
] as const

export function Differentials() {
  return (
    <section id="diferenciais" className="section-pad relative border-y border-white/7 bg-ink-soft">
      <div className="absolute right-[-8rem] top-8 select-none font-display text-[20rem] leading-none text-white/[.018]" aria-hidden="true">I</div>
      <div className="shell relative">
        <SectionHeading eyebrow="Construído para durar" title="Conforto que você sente. Qualidade que você reconhece." copy="Do tecido à estrutura, cada escolha importa para o sofá acompanhar a vida real da sua casa." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5">
          {items.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.07} className={index === 4 ? 'sm:col-span-2 lg:col-span-1' : ''}>
              <article className="group h-full rounded-[1.35rem] border border-white/8 bg-white/[.025] p-5 transition duration-300 hover:-translate-y-1 hover:border-gold/28 hover:bg-gold/[.035] sm:p-6">
                <span className="grid size-11 place-items-center rounded-full border border-gold/25 bg-gold/8 text-gold transition group-hover:bg-gold group-hover:text-ink"><item.icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3 className="mt-7 font-display text-2xl font-semibold text-ivory">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.copy}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
