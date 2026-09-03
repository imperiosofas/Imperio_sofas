import { Reveal } from './Reveal'

export function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.04] tracking-[-.035em] text-ivory sm:text-5xl lg:text-6xl">{title}</h2>
      {copy && <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">{copy}</p>}
    </Reveal>
  )
}
