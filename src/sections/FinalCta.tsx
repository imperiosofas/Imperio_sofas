import { ArrowRight, MessageCircle } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { WhatsAppLink } from '../components/WhatsAppLink'

export function FinalCta() {
  return (
    <section id="contato" className="relative overflow-hidden border-t border-gold/12 bg-[#d5a73a] py-20 text-ink sm:py-24 lg:py-28">
      <div className="absolute -right-14 -top-28 select-none font-display text-[24rem] font-bold leading-none text-black/[.045]" aria-hidden="true">I</div>
      <div className="shell relative">
        <Reveal className="max-w-4xl">
          <p className="text-sm font-extrabold uppercase tracking-[.18em]">Seu próximo sofá começa aqui</p>
          <h2 className="mt-5 text-balance font-display text-5xl font-semibold leading-[.96] tracking-[-.05em] sm:text-6xl lg:text-7xl">Compre seu sofá com preço de fábrica.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-black/65">Pode mandar uma foto da sala, as medidas ou até um áudio contando o que você procura. Vamos conversar sobre o sofá que combina com a sua casa.</p>
          <WhatsAppLink message="Olá! Quero um orçamento para meu sofá. Posso contar um pouco sobre minha sala?" className="group mt-9 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 font-bold text-white shadow-[0_16px_42px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:bg-[#181818] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
            <MessageCircle size={20} aria-hidden="true" /> Pedir orçamento <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </WhatsAppLink>
        </Reveal>
      </div>
    </section>
  )
}
