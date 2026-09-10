import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, ArrowRight, MessageCircle, Star } from 'lucide-react'
import { useRef } from 'react'
import { useEnhancedMotion } from '../lib/useEnhancedMotion'
import { WhatsAppLink } from '../components/WhatsAppLink'
import hero768 from '../assets/hero-sofa-768.webp'
import hero1536 from '../assets/hero-sofa-1536.webp'

export function Hero() {
  const enhanced = useEnhancedMotion()
  const reduceMotion = useReducedMotion()
  return (
    <section id="inicio" className="relative min-h-[760px] overflow-hidden pt-[76px] sm:min-h-[820px] lg:min-h-[780px] lg:pt-[88px]">
      {enhanced ? <ParallaxImage /> : <div className="absolute inset-0"><HeroImage /></div>}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,.98)_0%,rgba(7,7,7,.88)_36%,rgba(7,7,7,.35)_67%,rgba(7,7,7,.16)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(7,7,7,.55)_0%,rgba(7,7,7,.45)_32%,rgba(7,7,7,.96)_82%,#070707_100%)]" />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="shell relative z-10 flex min-h-[684px] items-end py-8 sm:min-h-[744px] sm:py-12 lg:min-h-[692px] lg:items-center">
        <motion.div initial={reduceMotion || !enhanced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-[680px]">
          <img src="/imperio-sofas-logo-384.webp" srcSet="/imperio-sofas-logo-128.webp 128w, /imperio-sofas-logo-384.webp 384w" sizes="(min-width: 1024px) 144px, 112px" width="384" height="384" alt="Império Sofás — brasão oficial com leão dourado" className="mb-4 size-28 [clip-path:circle(46%)] lg:size-36" fetchPriority="high" />
          <p className="eyebrow">Direto de Taubaté para o seu lar</p>
          <h1 className="mt-4 text-balance font-display text-[2.8rem] font-semibold leading-[.96] tracking-[-.05em] text-white sm:text-6xl lg:text-7xl">
            Seu conforto merece <span className="text-gold">preço de fábrica.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-ivory/76 sm:text-lg">Conte como é a sua sala. A gente ajuda você a escolher um sofá para se sentir em casa.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <WhatsAppLink message="Olá! Vim pelo site e quero ajuda para escolher meu sofá. Posso enviar uma foto e as medidas da minha sala?" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 font-bold text-ink shadow-gold hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
              <MessageCircle size={20} aria-hidden="true" /> Encontrar meu sofá <ArrowRight size={17} aria-hidden="true" />
            </WhatsAppLink>
            <a href="#catalogo" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/24 bg-black/25 px-6 py-4 font-semibold text-white hover:border-gold/50">Ver catálogo <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ivory/75"><span className="inline-flex items-center gap-1.5"><Star size={14} fill="currentColor" className="text-gold" aria-hidden="true" /> 4,8 no Google · 140 avaliações</span><span>Entrega no Vale do Paraíba</span></div>
        </motion.div>
      </div>
    </section>
  )
}

function HeroImage() {
  return <img src={hero1536} srcSet={`${hero768} 768w, ${hero1536} 1536w`} sizes="100vw" width="1536" height="1024" alt="Sofá modular caramelo em showroom de estilo industrial" className="h-full w-full object-cover object-[61%_center] sm:object-center" fetchPriority="high" />
}

function ParallaxImage() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', '8%'])
  return <div ref={ref} className="absolute inset-0"><motion.div style={{ y: imageY }} className="absolute inset-0"><HeroImage /></motion.div></div>
}
