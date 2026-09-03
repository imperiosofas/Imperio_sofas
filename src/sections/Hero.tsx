import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, ArrowRight, MessageCircle, Star } from 'lucide-react'
import { useRef } from 'react'
import { WhatsAppLink } from '../components/WhatsAppLink'
import hero768 from '../assets/hero-sofa-768.webp'
import hero1536 from '../assets/hero-sofa-1536.webp'

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '12%'])

  return (
    <section id="inicio" ref={ref} className="relative min-h-[760px] overflow-hidden pt-[76px] sm:min-h-[820px] lg:min-h-[780px] lg:pt-[88px]">
      <motion.div style={{ y: imageY }} className="absolute inset-0">
        <img src={hero1536} srcSet={`${hero768} 768w, ${hero1536} 1536w`} sizes="100vw" width="1536" height="1024" alt="Sofá modular caramelo em showroom de estilo industrial" className="h-full w-full object-cover object-[61%_center] sm:object-center" fetchPriority="high" />
      </motion.div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,.98)_0%,rgba(7,7,7,.88)_36%,rgba(7,7,7,.35)_67%,rgba(7,7,7,.16)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(7,7,7,.35)_0%,rgba(7,7,7,.30)_32%,rgba(7,7,7,.96)_82%,#070707_100%)]" />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="shell relative z-10 flex min-h-[684px] items-end pb-12 sm:min-h-[744px] sm:pb-16 lg:min-h-[692px] lg:items-center lg:pb-0">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="max-w-[680px]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-black/35 px-3.5 py-2 text-xs font-bold uppercase tracking-[.12em] text-gold backdrop-blur-md sm:text-sm">
            <Star size={14} fill="currentColor" aria-hidden="true" /> 4,8 no Google • 140 avaliações
          </div>
          <p className="eyebrow">Direto de Taubaté para o seu lar</p>
          <h1 className="mt-5 text-balance font-display text-[3.15rem] font-semibold leading-[.94] tracking-[-.05em] text-white sm:text-6xl lg:text-7xl xl:text-[5.35rem]">
            Seu conforto merece <span className="text-gold">preço de fábrica.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-ivory/76 sm:text-lg sm:leading-8">
            Sofás que unem presença, conforto e acabamento para transformar a sala no melhor lugar da casa.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <WhatsAppLink message="Olá! Vim pelo site e quero encontrar o sofá ideal para minha sala." className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 font-bold text-ink shadow-gold transition hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
              <MessageCircle size={20} aria-hidden="true" /> Encontrar meu sofá <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </WhatsAppLink>
            <a href="#catalogo" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/24 bg-black/25 px-6 py-4 font-semibold text-white backdrop-blur-sm transition hover:border-gold/50 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">Ver catálogo <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ivory/58">
            <span>Entrega no Vale do Paraíba</span><span aria-hidden="true" className="hidden text-gold sm:inline">◆</span><span>Modelos personalizados</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
