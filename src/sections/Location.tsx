import { useState } from 'react'
import { ChevronDown, Clock3, MapPin, Navigation } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { STORE } from '../config'
import { StorePhoto } from '../components/StorePhoto'

export function Location() {
  const [mapOpen, setMapOpen] = useState(false)
  return (
    <section id="localizacao" className="section-pad bg-ink">
      <div className="shell">
        <SectionHeading eyebrow="Visite a loja" title="Veja de perto. Sente. Experimente." copy="Estamos em Taubaté, com atendimento para todo o Vale do Paraíba." />
        <div className="mt-10 grid overflow-hidden rounded-[1.6rem] border border-white/9 bg-card lg:mt-14 lg:grid-cols-[1.25fr_1fr]">
          <figure className="min-w-0 border-b border-white/9 lg:border-b-0 lg:border-r">
            <StorePhoto photo="facade" sizes="(min-width: 1280px) 690px, (min-width: 1024px) 55vw, (min-width: 640px) 94vw, 92vw" className="h-auto w-full" />
            <figcaption className="flex items-center gap-3 px-6 py-5 text-sm text-ivory/80"><MapPin size={18} className="shrink-0 text-gold" aria-hidden="true" /> É aqui que a gente se encontra. Nossa loja em Taubaté.</figcaption>
          </figure>
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <Reveal><span className="grid size-12 place-items-center rounded-full bg-gold text-ink"><MapPin aria-hidden="true" /></span><h3 className="mt-6 font-display text-3xl font-semibold text-ivory">Império Sofás</h3><p className="mt-3 leading-7 text-muted">{STORE.address}<br />CEP {STORE.postalCode}</p></Reveal>
              <Reveal delay={0.08} className="mt-8 border-t border-white/8 pt-7"><div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-gold" size={20} aria-hidden="true" /><div><p className="font-semibold text-ivory">Horário de atendimento</p><p className="mt-2 text-sm leading-6 text-muted">Segunda a sexta: 9h às 18h<br />Sábado: 9h às 13h<br />Domingo: fechado</p></div></div></Reveal>
            </div>
            <div className="mt-8 grid gap-3">
              <a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 font-bold text-ink transition hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><Navigation size={19} aria-hidden="true" /> Como chegar</a>
              <button type="button" aria-expanded={mapOpen} aria-controls="store-map" onClick={() => setMapOpen(open => !open)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-ivory hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">{mapOpen ? 'Fechar mapa' : 'Ver mapa da região'}<ChevronDown size={17} aria-hidden="true" className={mapOpen ? 'rotate-180' : undefined} /></button>
            </div>
          </div>
        </div>
        <div id="store-map" hidden={!mapOpen} className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-card">
          {mapOpen ? <iframe src={STORE.mapEmbedUrl} title="Mapa da Império Sofás em Taubaté" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-80 w-full sm:h-96" allowFullScreen /> : null}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted/70">Endereço e horários consultados no Google Maps em 03/09/2026. Em feriados, confirme antes da visita.</p>
      </div>
    </section>
  )
}
