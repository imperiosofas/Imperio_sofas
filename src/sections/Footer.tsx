import { Camera, MapPin } from 'lucide-react'
import { Brand } from '../components/Brand'
import { STORE } from '../config'

export function Footer() {
  return (
    <footer className="border-t border-white/7 bg-[#050505] py-10 sm:py-12">
      <div className="shell grid gap-8 sm:grid-cols-2 sm:items-end">
        <div><Brand /><p className="mt-5 max-w-sm text-sm leading-6 text-muted">Conforto, acabamento e atendimento próximo para transformar a sua sala.</p></div>
        <div className="flex flex-col gap-3 text-sm text-muted sm:items-end">
          <a href={STORE.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><Camera size={17} aria-hidden="true" /> @imperiosofasvale</a>
          <a href={STORE.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 text-left transition hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:text-right"><MapPin size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> {STORE.address}</a>
        </div>
      </div>
      <div className="shell mt-9 border-t border-white/7 pt-6 text-xs text-muted/65">© {new Date().getFullYear()} Império Sofás. Todos os direitos reservados.</div>
    </footer>
  )
}
