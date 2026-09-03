import { Clock3, MapPin, Navigation } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { STORE } from '../config'

export function Location() {
  return (
    <section id="localizacao" className="section-pad bg-ink">
      <div className="shell">
        <SectionHeading eyebrow="Visite a loja" title="Veja de perto. Sente. Experimente." copy="Estamos em Taubaté, com atendimento para todo o Vale do Paraíba." />
        <div className="mt-10 grid overflow-hidden rounded-[1.6rem] border border-white/9 bg-card lg:mt-14 lg:grid-cols-[1.45fr_.75fr]">
          <Reveal className="min-h-[350px] lg:min-h-[540px]">
            <iframe src={STORE.mapEmbedUrl} title="Mapa da Império Sofás em Taubaté" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full min-h-[350px] w-full grayscale-[.45] contrast-[1.05] lg:min-h-[540px]" allowFullScreen />
          </Reveal>
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <Reveal><span className="grid size-12 place-items-center rounded-full bg-gold text-ink"><MapPin aria-hidden="true" /></span><h3 className="mt-6 font-display text-3xl font-semibold text-ivory">Império Sofás</h3><p className="mt-3 leading-7 text-muted">{STORE.address}<br />CEP {STORE.postalCode}</p></Reveal>
              <Reveal delay={0.08} className="mt-8 border-t border-white/8 pt-7"><div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-gold" size={20} aria-hidden="true" /><div><p className="font-semibold text-ivory">Horário de atendimento</p><p className="mt-2 text-sm leading-6 text-muted">Segunda a sexta: 9h às 18h<br />Sábado: 9h às 13h<br />Domingo: fechado</p></div></div></Reveal>
            </div>
            <a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="mt-9 inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-gold/40 px-6 py-4 font-bold text-gold transition hover:bg-gold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><Navigation size={19} aria-hidden="true" /> Como chegar</a>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted/70">Endereço e horários consultados no Google Maps em 03/09/2026. Em feriados, confirme antes da visita.</p>
      </div>
    </section>
  )
}
