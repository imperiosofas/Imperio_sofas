import { Crown } from 'lucide-react'
import { cn } from '../lib/utils'

export function Brand({ className }: { className?: string }) {
  return (
    <a href="#inicio" className={cn('group inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold', className)} aria-label="Império Sofás — voltar ao início">
      {/* TODO: substitua este monograma pelo arquivo oficial do brasão quando estiver disponível. */}
      <span className="relative grid size-10 place-items-center rounded-full border border-gold/60 bg-gold/8 text-gold transition-colors group-hover:bg-gold/14">
        <Crown size={17} aria-hidden="true" className="absolute -top-1.5" />
        <span className="mt-1 font-display text-lg font-bold">I</span>
      </span>
      <span className="leading-none">
        <span className="block font-display text-[1.08rem] font-semibold tracking-[.02em] text-ivory">Império Sofás</span>
        <span className="mt-1 block text-[.66rem] font-semibold uppercase tracking-[.2em] text-gold">Vale do Paraíba</span>
      </span>
    </a>
  )
}
