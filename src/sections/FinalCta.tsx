import { ArrowRight, MessageCircle } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { WhatsAppLink } from '../components/WhatsAppLink'
import { StorePhoto } from '../components/StorePhoto'

export function FinalCta() {
  return (
    <section id="contato" className="relative overflow-hidden border-t border-gold/12 bg-[#d5a73a] py-16 text-ink sm:py-20 lg:py-24">
      <div className="absolute -right-14 -top-28 select-none font-display text-[24rem] font-bold leading-none text-black/[.045]" aria-hidden="true">I</div>
      <div className="shell relative grid items-center gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
        <figure className="order-2 mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-black/10 bg-ivory lg:order-1 lg:max-w-none">
          <StorePhoto photo="contact" sizes="(min-width: 1280px) 460px, (min-width: 1024px) 36vw, (min-width: 420px) 384px, 92vw" className="h-auto w-full" />
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4"><span className="font-display text-2xl font-semibold">Vamos conversar?</span><span className="text-xs text-black/60">Wagner · Dono da loja</span></figcaption>
        </figure>
        <Reveal className="order-1 min-w-0 lg:order-2">
          <p className="text-sm font-extrabold uppercase tracking-[.18em]">Seu próximo sofá começa aqui</p>
          <h2 className="mt-5 text-balance font-display text-5xl font-semibold leading-[.96] tracking-[-.05em] sm:text-6xl lg:text-7xl">Seu sofá começa com uma boa conversa.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-black/65">Pode mandar uma foto da sala, as medidas ou até um áudio contando o que você procura. Vamos conversar sobre o sofá que combina com a sua casa.</p>
          <WhatsAppLink message="Olá, Wagner! Quero um orçamento para meu sofá. Posso contar um pouco sobre minha sala?" className="group mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#181818] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:w-auto sm:px-7 sm:text-base">
            <MessageCircle size={20} aria-hidden="true" /> Conversar com o Wagner <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </WhatsAppLink>
        </Reveal>
      </div>
    </section>
  )
}
