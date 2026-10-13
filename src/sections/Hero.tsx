import Image from "next/image";
import { ArrowRight, ArrowUpRight, MessageCircle, Star } from "lucide-react";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { StorePhoto } from "../components/StorePhoto";
import { FULL_CATALOG_URL } from "../lib/links";
import styles from "./landing-motion.module.css";
import hero768 from "../assets/hero-sofa-768.webp";
import hero1536 from "../assets/hero-sofa-1536.webp";

export function Hero() {
  return (
    <section
      id="inicio"
      data-hero-scene
      className="relative overflow-hidden pt-[76px] lg:pt-[88px]"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <div data-hero-image className="absolute inset-0">
          <HeroImage />
        </div>
      </div>
      <div
        data-hero-overlay
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,.98)_0%,rgba(7,7,7,.88)_36%,rgba(7,7,7,.35)_67%,rgba(7,7,7,.16)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(7,7,7,.55)_0%,rgba(7,7,7,.45)_32%,rgba(7,7,7,.96)_82%,#070707_100%)]"
      />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="shell relative z-10 grid items-center gap-9 py-10 sm:py-14 lg:min-h-[692px] lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-16">
        <div data-hero-copy className="min-w-0">
          <Image
            src="/imperio-sofas-logo-384.webp"
            sizes="(min-width: 1024px) 128px, 88px"
            width={384}
            height={384}
            alt="Império Sofás — brasão oficial com leão dourado"
            className="mb-4 size-22 [clip-path:circle(46%)] lg:size-32"
            fetchPriority="high"
          />
          <p className="eyebrow">Direto de Taubaté para o seu lar</p>
          <h1 className="mt-4 text-balance font-display text-[2.8rem] font-semibold leading-[.96] tracking-[-.05em] text-white sm:text-6xl lg:text-7xl">
            <span className="sr-only">
              Seu conforto merece preço de fábrica.
            </span>
            <span aria-hidden="true">
              <span className={styles.heroWordMask}>
                <span data-hero-word>Seu</span>
              </span>{" "}
              <span className={styles.heroWordMask}>
                <span data-hero-word>conforto</span>
              </span>{" "}
              <span className={styles.heroWordMask}>
                <span data-hero-word>merece</span>
              </span>{" "}
              <span className={`${styles.heroWordMask} text-gold`}>
                <span data-hero-word>preço</span>
              </span>{" "}
              <span className={`${styles.heroWordMask} text-gold`}>
                <span data-hero-word>de</span>
              </span>{" "}
              <span className={`${styles.heroWordMask} text-gold`}>
                <span data-hero-word>fábrica.</span>
              </span>
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-ivory/76 sm:text-lg">
            Conte como é a sua sala. A gente ajuda você a escolher um sofá para
            se sentir em casa.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <WhatsAppLink
              message="Olá! Vim pelo site e quero ajuda para escolher meu sofá. Posso enviar uma foto e as medidas da minha sala?"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 font-bold text-ink shadow-gold hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <MessageCircle size={20} aria-hidden="true" /> Encontrar meu sofá{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </WhatsAppLink>
            <a
              href={FULL_CATALOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-gold/55 bg-black/45 px-6 py-4 font-semibold text-gold transition hover:border-gold hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              Ver catálogo completo{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ivory/75">
            <span className="inline-flex items-center gap-1.5">
              <Star
                size={14}
                fill="currentColor"
                className="text-gold"
                aria-hidden="true"
              />{" "}
              4,8 no Google · 140 avaliações
            </span>
            <span>Entrega no Vale do Paraíba</span>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-ivory text-ink lg:mt-12 lg:rounded-[2rem]">
          <StorePhoto
            photo="welcome"
            priority
            sizes="(min-width: 1280px) 540px, (min-width: 1024px) 44vw, (min-width: 640px) 576px, 92vw"
            className="h-auto w-full"
          />
          <figcaption className="border-t border-black/8 px-6 py-5 sm:px-8 sm:py-7">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-[#917022]" />
              <p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-[#78602a]">
                Quem está por trás da Império
              </p>
            </div>
            <p className="mt-3 font-display text-4xl font-semibold leading-none">
              Prazer, Wagner.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-black/65">
              Dono da Império Sofás Vale. Da primeira conversa à visita na loja,
              conforto começa com um atendimento próximo.
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function HeroImage() {
  return (
    <picture className="absolute inset-0">
      <source
        srcSet={`${hero768.src} 768w, ${hero1536.src} 1536w`}
        sizes="100vw"
        type="image/webp"
      />
      <Image
        src={hero1536}
        sizes="100vw"
        width={1536}
        height={1024}
        alt="Sofá modular caramelo em showroom de estilo industrial"
        className="h-full w-full object-cover object-[61%_center] sm:object-center"
        fetchPriority="high"
        unoptimized
      />
    </picture>
  );
}
