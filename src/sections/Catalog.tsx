"use client";

import { EffectCoverflow, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEnhancedMotion } from "../lib/useEnhancedMotion";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { products } from "../data/products";
import { SectionHeading } from "../components/SectionHeading";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { StorePhoto } from "../components/StorePhoto";

export function Catalog({ integrated = false }: { integrated?: boolean }) {
  const enhanced = useEnhancedMotion();
  return (
    <section
      id="catalogo"
      aria-label="Coleção em destaque"
      className={
        integrated
          ? "overflow-hidden bg-ink pb-16 sm:pb-24"
          : "section-pad overflow-hidden bg-ink"
      }
    >
      {!integrated && (
        <>
          <div className="shell">
            <div className="flex items-end justify-between gap-8">
              <SectionHeading
                eyebrow="Coleção em destaque"
                title="Um sofá para cada jeito de viver."
                copy="Explore alguns estilos e chame no WhatsApp para conferir medidas, tecidos e disponibilidade."
              />
              <Link
                href="/loja"
                className="hidden shrink-0 items-center gap-2 rounded-full border border-gold/45 px-5 py-3 text-sm font-semibold text-gold transition hover:bg-gold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold lg:inline-flex"
              >
                Ver todos os produtos{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <div className="hidden gap-3 md:flex">
                <button
                  className="catalog-prev grid size-12 place-items-center rounded-full border border-white/12 text-ivory transition hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                  aria-label="Produto anterior"
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  className="catalog-next grid size-12 place-items-center rounded-full border border-white/12 text-ivory transition hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                  aria-label="Próximo produto"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
          <div className="shell mt-5 lg:hidden">
            <Link
              href="/loja"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold underline decoration-gold/40 underline-offset-4"
            >
              Ver todos os produtos <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
      {integrated && (
        <div className="shell mb-6 flex items-center justify-between gap-4">
          <Link
            href="/loja"
            className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-gold focus-visible:outline-2 focus-visible:outline-gold"
          >
            Ver todos os produtos <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <div className="flex gap-2">
            <button
              className="catalog-prev grid size-12 place-items-center rounded-full border border-white/20 text-ivory focus-visible:outline-2 focus-visible:outline-gold"
              aria-label="Produto anterior"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <button
              className="catalog-next grid size-12 place-items-center rounded-full border border-white/20 text-ivory focus-visible:outline-2 focus-visible:outline-gold"
              aria-label="Próximo produto"
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <div className={integrated ? "pt-2" : "mt-10 lg:mt-14"}>
        <Swiper
          key={enhanced ? "desktop" : "mobile"}
          modules={
            enhanced
              ? [EffectCoverflow, Pagination, Navigation]
              : [Pagination, Navigation]
          }
          effect={enhanced ? "coverflow" : "slide"}
          speed={enhanced ? 350 : 180}
          centeredSlides
          grabCursor
          loop={enhanced}
          slidesPerView={1.12}
          spaceBetween={16}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 120,
            modifier: 1.35,
            slideShadows: false,
          }}
          pagination={{ clickable: true }}
          navigation={{ prevEl: ".catalog-prev", nextEl: ".catalog-next" }}
          breakpoints={{
            640: { slidesPerView: 1.55, spaceBetween: 22 },
            900: { slidesPerView: 2.15, spaceBetween: 28 },
            1280: { slidesPerView: 2.75, spaceBetween: 34 },
          }}
          className="catalog-swiper !overflow-visible !pb-14"
        >
          {products.map((product) => (
            <SwiperSlide key={product.name} className="!h-auto">
              <motion.article
                whileHover={enhanced ? { y: -6 } : undefined}
                transition={{ duration: 0.25 }}
                className="h-full overflow-hidden rounded-[1.5rem] border border-white/9 bg-card shadow-2xl shadow-black/30"
              >
                <div className="relative aspect-[11/10] overflow-hidden bg-card">
                  <img
                    src={product.image}
                    srcSet={product.srcSet}
                    sizes="(max-width: 639px) calc(100vw - 56px), (max-width: 899px) 65vw, (max-width: 1279px) 47vw, 37vw"
                    width="1100"
                    height="1000"
                    loading="lazy"
                    decoding="async"
                    alt={product.alt}
                    style={{ objectPosition: product.objectPosition }}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[.12em] text-gold">
                        {product.size}
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-semibold text-ivory">
                        {product.name}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/8 pt-5">
                    <p className="font-semibold text-ivory">{product.price}</p>
                    <WhatsAppLink
                      message={`Olá! Quero saber mais sobre o ${product.name} de ${product.size}, anunciado por ${product.price}.`}
                      aria-label={`Consultar ${product.name} no WhatsApp`}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:scale-105 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                    >
                      <MessageCircle size={19} aria-hidden="true" />
                    </WhatsAppLink>
                  </div>
                </div>
              </motion.article>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <p className="shell mt-2 text-center text-xs leading-5 text-muted/80">
        Consulte disponibilidade, opções de tecido e condições de pagamento pelo
        WhatsApp.
      </p>
      <div className="shell mt-8 text-center sm:mt-10">
        <h3 className="font-display text-3xl font-semibold leading-tight text-ivory sm:text-4xl">
          O próximo passo pode ser sentir de perto.
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted sm:text-base">
          Veja a loja em Taubaté e imagine cada modelo fazendo parte da sua
          casa.
        </p>
        <a
          href="#localizacao"
          className="mx-auto mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-gold px-6 py-4 text-sm font-bold text-ink transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Conheça a loja{" "}
          <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
        </a>
      </div>
      <div className="shell mt-10 sm:mt-14">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_112px] overflow-hidden rounded-3xl border border-gold/20 bg-card sm:grid-cols-[1fr_260px]">
          <div className="min-w-0 px-5 pt-6 sm:px-8 sm:pt-8">
            <p className="eyebrow">Uma ajuda para escolher</p>
            <h3 className="mt-3 font-display text-[1.65rem] font-semibold leading-tight sm:text-4xl">
              Gostou de algum desses modelos?
            </h3>
          </div>
          <figure className="self-center pr-4 pt-6 sm:row-span-2 sm:self-stretch sm:bg-[#ded9cf] sm:p-0">
            <StorePhoto
              photo="catalog"
              sizes="(min-width: 640px) 260px, 96px"
              className="h-auto w-full rounded-xl sm:rounded-none"
            />
            <figcaption className="hidden px-5 py-3 text-xs font-medium text-black/65 sm:block">
              Wagner · Império Sofás Vale
            </figcaption>
          </figure>
          <div className="col-span-2 px-5 pb-6 sm:col-span-1 sm:px-8 sm:pb-8">
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              Conte para o Wagner o que você procura. Envie o modelo e as
              medidas da sala para conversar sobre as opções.
            </p>
            <WhatsAppLink
              message="Olá, Wagner! Vi os modelos no site e quero ajuda para escolher. Posso enviar as medidas da minha sala?"
              className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-gold/40 px-5 py-3 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <MessageCircle size={18} aria-hidden="true" /> Fale com nossos
              vendedores <ArrowRight size={16} aria-hidden="true" />
            </WhatsAppLink>
          </div>
        </div>
      </div>
    </section>
  );
}
