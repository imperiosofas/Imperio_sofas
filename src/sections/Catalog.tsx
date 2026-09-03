import { EffectCoverflow, Navigation, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import { products } from '../data/products'
import { SectionHeading } from '../components/SectionHeading'
import { WhatsAppLink } from '../components/WhatsAppLink'

export function Catalog() {
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
        <Swiper modules={[EffectCoverflow, Pagination, Navigation]} effect="coverflow" centeredSlides grabCursor loop slidesPerView={1.12} spaceBetween={16} coverflowEffect={{ rotate: 0, stretch: 0, depth: 120, modifier: 1.35, slideShadows: false }} pagination={{ clickable: true }} navigation={{ prevEl: '.catalog-prev', nextEl: '.catalog-next' }} breakpoints={{ 640: { slidesPerView: 1.55, spaceBetween: 22 }, 900: { slidesPerView: 2.15, spaceBetween: 28 }, 1280: { slidesPerView: 2.75, spaceBetween: 34 } }} className="catalog-swiper !overflow-visible !pb-14">
          {products.map((product) => (
            <SwiperSlide key={product.name} className="!h-auto">
              <motion.article whileHover={{ y: -6 }} transition={{ duration: 0.25 }} className="h-full overflow-hidden rounded-[1.5rem] border border-white/9 bg-card shadow-2xl shadow-black/30">
                <div className="relative aspect-[4/3] overflow-hidden bg-black">
                  <img src={product.image} srcSet={product.srcSet} sizes="(max-width: 640px) 90vw, (max-width: 1100px) 55vw, 38vw" width="1280" height="853" loading="lazy" alt={`${product.name} em ${product.tone.toLowerCase()}`} className="h-full w-full object-cover transition duration-700 hover:scale-[1.035]" />
                  <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-semibold text-ivory backdrop-blur-md">Imagem ilustrativa</span>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-sm font-semibold uppercase tracking-[.12em] text-gold">{product.tone}</p><h3 className="mt-2 font-display text-3xl font-semibold text-ivory">{product.name}</h3></div>
                    <span className="mt-1 text-right text-xs leading-5 text-muted">{product.detail}</span>
                  </div>
                  <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/8 pt-5">
                    <p className="font-semibold text-ivory">{product.price}</p>
                    <WhatsAppLink message={`Olá! Quero saber mais sobre o ${product.name}.`} aria-label={`Consultar ${product.name} no WhatsApp`} className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:scale-105 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"><MessageCircle size={19} aria-hidden="true" /></WhatsAppLink>
                  </div>
                </div>
              </motion.article>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <p className="shell mt-2 text-center text-xs leading-5 text-muted/80">Modelos, imagens e valores ilustrativos. Consulte opções e preços atualizados pelo WhatsApp.</p>
    </section>
  )
}
