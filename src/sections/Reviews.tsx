import { ExternalLink, Quote, Star } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { STORE } from '../config'

// Avaliações reais exibidas no Google Maps em 03/09/2026. Revise periodicamente.
const reviews = [
  { name: 'Luiz P.', text: 'Atendimento maravilhoso, pessoas super prestativas. Nota 10, vale a pena. Sofá top!' },
  { name: 'Marcelo M.', text: 'Agradeço à Império Sofás. Continuem com este foco de atendimento e exclusividade.' },
  { name: 'Camila L.', text: 'Excelente atendimento, equipe super atenciosa. Fiquei muito feliz com meu sofá: ótima qualidade e preço ótimo.' },
] as const

export function Reviews() {
  return (
    <section className="section-pad relative border-y border-white/7 bg-ink-soft">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
          <div>
            <SectionHeading eyebrow="Quem compra, recomenda" title="Confiança construída em cada sala." />
            <Reveal className="mt-8 flex items-center gap-5">
              <div className="font-display text-6xl font-semibold text-ivory">4,8</div>
              <div><div className="flex gap-1 text-gold" aria-label="4,8 de 5 estrelas">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={17} fill="currentColor" aria-hidden="true" />)}</div><p className="mt-2 text-sm text-muted">140 avaliações no Google</p></div>
            </Reveal>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {reviews.map((review, index) => (
              <Reveal key={review.name} delay={index * 0.08}>
                <blockquote className="flex h-full flex-col rounded-[1.35rem] border border-white/8 bg-white/[.025] p-5 sm:p-6">
                  <Quote size={25} className="text-gold" aria-hidden="true" />
                  <p className="mt-5 flex-1 text-base leading-7 text-ivory/82">“{review.text}”</p>
                  <footer className="mt-7 flex items-center justify-between border-t border-white/8 pt-4"><cite className="not-italic font-semibold text-ivory">{review.name}</cite><span className="flex text-gold" aria-label="5 estrelas">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" aria-hidden="true" />)}</span></footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal className="mt-8 text-right"><a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-gold underline decoration-gold/30 underline-offset-4 transition hover:text-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">Ver avaliações no Google <ExternalLink size={15} aria-hidden="true" /></a></Reveal>
      </div>
    </section>
  )
}
