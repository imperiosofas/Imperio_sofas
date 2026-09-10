import { cn } from '../lib/utils'

export function Brand({ className }: { className?: string }) {
  return (
    <a href="#inicio" className={cn('group inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold', className)} aria-label="Império Sofás — voltar ao início">
      <img src="/imperio-sofas-logo-128.webp" alt="Logo oficial da Império Sofás" width="128" height="128" className="size-14 shrink-0 [clip-path:circle(46%)]" />
      <span className="leading-none">
        <span className="block font-display text-[1.08rem] font-semibold tracking-[.02em] text-ivory">Império Sofás</span>
        <span className="mt-1 block text-[.66rem] font-semibold uppercase tracking-[.2em] text-gold">Vale do Paraíba</span>
      </span>
    </a>
  )
}
