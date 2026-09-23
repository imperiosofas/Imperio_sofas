"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, MessageCircle } from "lucide-react";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { useEnhancedMotion } from "../lib/useEnhancedMotion";
import heroImage from "../assets/hero-sofa-1536.webp";

export function Hero() {
  const enhanced = useEnhancedMotion();
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="hero relative isolate flex min-h-svh items-end overflow-hidden bg-ink pt-24 pb-10 sm:pb-16 lg:items-center lg:pt-28 lg:pb-20"
    >
      <div aria-hidden="true" className="hero__visual absolute inset-0">
        <Image
          src={heroImage}
          alt="Sofá em um ambiente de showroom contemporâneo"
          fill
          priority
          sizes="100vw"
          className="hero__image object-cover object-[57%_center] lg:object-center"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,.34)_0%,rgba(7,7,7,.22)_22%,rgba(7,7,7,.46)_48%,#070707_100%)] lg:bg-[linear-gradient(90deg,rgba(7,7,7,.94)_0%,rgba(7,7,7,.76)_36%,rgba(7,7,7,.24)_69%,rgba(7,7,7,.08)_100%)]"
      />
      <div className="shell relative z-10 flex w-full items-end justify-between gap-10 lg:items-end">
        <motion.div
          initial={reduceMotion || !enhanced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[44rem]"
        >
          <p className="mb-5 flex items-center gap-3 text-[.68rem] font-bold uppercase tracking-[.22em] text-gold sm:text-xs">
            <span className="h-px w-8 bg-gold" />
            Império Sofás · Taubaté, SP
          </p>
          <h1
            id="hero-title"
            className="max-w-[44rem] text-balance font-display text-[clamp(3.4rem,12vw,5.4rem)] font-medium leading-[.9] tracking-[-.045em] text-ivory lg:text-[clamp(5.4rem,7vw,7.3rem)]"
          >
            A vida fica
            <br />
            <span className="italic text-gold">mais em casa.</span>
          </h1>
          <div className="mt-7 max-w-xl lg:mt-9">
            <p className="max-w-md text-pretty text-sm leading-6 text-ivory/85 sm:text-base sm:leading-7">
              Sofás para os dias comuns, as visitas sem hora e tudo o que
              acontece entre um momento e outro.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#historia"
                className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-gold px-7 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                Conheça os sofás
                <ArrowDown
                  size={17}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-y-1"
                />
              </a>
              <WhatsAppLink
                message="Olá! Vim pelo site da Império Sofás e quero ajuda para encontrar o sofá ideal para a minha casa."
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-black/20 px-5 py-3 text-sm font-semibold text-ivory transition-colors hover:border-gold/70 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                <MessageCircle size={17} aria-hidden="true" />
                Converse com a gente
              </WhatsAppLink>
            </div>
          </div>
        </motion.div>

        <a
          href="#historia"
          className="group hidden shrink-0 pb-1 text-right text-xs uppercase tracking-[.18em] text-ivory/70 transition-colors hover:text-gold lg:flex lg:items-center lg:gap-4"
        >
          <span>Role para descobrir</span>
          <span className="grid size-11 place-items-center rounded-full border border-white/30 transition group-hover:border-gold group-hover:bg-gold group-hover:text-ink">
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </a>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/65 to-transparent"
      />
    </section>
  );
}
