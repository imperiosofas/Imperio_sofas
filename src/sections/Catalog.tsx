import { EffectCoverflow, Navigation, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEnhancedMotion } from '../lib/useEnhancedMotion'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import { products } from '../data/products'
import { SectionHeading } from '../components/SectionHeading'
import { WhatsAppLink } from '../components/WhatsAppLink'

export function Catalog() {
  const enhanced = useEnhancedMotion()
  return (
    <section id="catalogo" className="section-pad overflow-hidden bg-ink">
      <div className="shell">
        <div className="flex items-end justify-between gap-8">
          <SectionHeading eyebrow="Coleção em destaque" title="Um sofá para cada jeito de viver." copy="Explore alguns estilos e chame no WhatsApp para conferir medidas, tecidos e disponibilidade." />
          <div className="hidden gap-3 md:flex">
            <button className="catalog-prev grid size-12 place-items-center rounded-full border border-white/12 text-ivory transition hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold" aria-label="Produto anterior"><ArrowLeft size={20} /></button>
            <button className="catalog-next grid size-12 place-items-center rounded-full border border-white/12 text-ivory transition hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold" aria-label="Próximo produto"><ArrowRight size={20} /></button>
          </div>
        </div>
      </div>
      <div className="mt-10 lg:mt-14">
        <Swiper key={enhanced ? 'desktop' : 'mobile'} modules={enhanced ? [EffectCoverflow, Pagination, Navigation] : [Pagination, Navigation]} effect={enhanced ? 'coverflow' : 'slide'} speed={enhanced ? 350 : 180} centeredSlides grabCursor loop={enhanced} slidesPerView={1.12} spaceBetween={16} coverflowEffect={{ rotate: 0, stretch: 0, depth: 120, modifier: 1.35, slideShadows: false }} pagination={{ clickable: true }} navigation={{ prevEl: '.catalog-prev', nextEl: '.catalog-next' }} breakpoints={{ 640: { slidesPerView: 1.55, spaceBetween: 22 }, 900: { slidesPerView: 2.15, spaceBetween: 28 }, 1280: { slidesPerView: 2.75, spaceBetween: 34 } }} className="catalog-swiper !overflow-visible !pb-14">
          {products.map((product) => (
            <SwiperSlide key={product.name} className="!h-auto">
              <motion.article whileHover={enhanced ? { y: -6 } : undefined} transition={{ duration: 0.25 }} className="h-full overflow-hidden rounded-[1.5rem] border border-white/9 bg-card shadow-2xl shadow-black/30">
                <div className="relative aspect-[11/10] overflow-hidden bg-card">
                  <img src={product.image} srcSet={product.srcSet} sizes="(max-width: 639px) 90vw, (max-width: 899px) 65vw, (max-width: 1279px) 47vw, 37vw" width="1100" height="1000" loading="lazy" decoding="async" alt={product.alt} style={{ objectPosition: product.objectPosition }} className="h-full w-full object-cover" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-semibold uppercase tracking-[.12em] text-gold">{product.size}</p><h3 className="mt-2 font-display text-3xl font-semibold text-ivory">{product.name}</h3></div>
                  </div>
                  <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/8 pt-5">
                    <p className="font-semibold text-ivory">{product.price}</p>
                    <WhatsAppLink message={`Olá! Quero saber mais sobre o ${product.name} de ${product.size}, anunciado por ${product.price}.`} aria-label={`Consultar ${product.name} no WhatsApp`} className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:scale-105 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><MessageCircle size={19} aria-hidden="true" /></WhatsAppLink>
                  </div>
                </div>
              </motion.article>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <p className="shell mt-2 text-center text-xs leading-5 text-muted/80">Consulte disponibilidade, opções de tecido e condições de pagamento pelo WhatsApp.</p>
    </section>
  )
}
