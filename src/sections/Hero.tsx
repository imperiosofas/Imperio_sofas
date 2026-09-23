"use client";

import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowRight, MessageCircle } from "lucide-react";
import { useRef } from "react";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { useEnhancedMotion } from "../lib/useEnhancedMotion";
import heroImage from "../assets/hero-sofa-1536.webp";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const enhanced = useEnhancedMotion();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <section
      id="inicio"
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[min(900px,100svh)] items-end overflow-hidden bg-ink pt-24 pb-12 sm:pb-16 lg:min-h-[min(940px,100svh)] lg:items-center lg:pt-28 lg:pb-20"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -inset-y-[8%]"
        style={enhanced && !reduceMotion ? { y: imageY } : undefined}
      >
        <Image
          src={heroImage}
          alt="Sofá em um ambiente de showroom contemporâneo"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[57%_center] lg:object-center"
        />
      </motion.div>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,.34)_0%,rgba(7,7,7,.22)_22%,rgba(7,7,7,.46)_48%,#070707_100%)] lg:bg-[linear-gradient(90deg,rgba(7,7,7,.94)_0%,rgba(7,7,7,.76)_36%,rgba(7,7,7,.24)_69%,rgba(7,7,7,.08)_100%)]"
      />
      <div aria-hidden="true" className="grain absolute inset-0 opacity-25" />

      <div className="shell relative z-10 grid w-full items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.42fr)] lg:items-end lg:gap-16">
        <motion.div
          initial={reduceMotion || !enhanced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl"
        >
          <p className="mb-5 flex items-center gap-3 text-[.68rem] font-bold uppercase tracking-[.22em] text-gold sm:text-xs">
            <span className="h-px w-8 bg-gold" />
            Império Sofás · Taubaté, SP
          </p>
          <h1
            id="hero-title"
            className="max-w-4xl text-balance font-display text-[clamp(3.35rem,12vw,6rem)] font-medium leading-[.88] tracking-[-.045em] text-ivory sm:text-[clamp(5rem,9vw,8.4rem)] lg:text-[clamp(6rem,8.4vw,9.4rem)]"
          >
            A vida fica
            <br />
            <span className="pl-[.55em] italic text-gold">mais em casa.</span>
          </h1>
          <div className="mt-7 grid gap-6 sm:grid-cols-[minmax(0,28rem)_auto] sm:items-end sm:gap-8 lg:mt-9">
            <p className="max-w-md text-pretty text-sm leading-6 text-ivory/80 sm:text-base sm:leading-7">
              Um sofá abre espaço para desacelerar, estar junto e viver a casa
              do seu jeito. A escolha começa com uma boa conversa.
            </p>
            <div className="flex flex-col gap-3 sm:min-w-56">
              <a
                href="#historia"
                className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                Entre na história
                <ArrowDown
                  size={17}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-y-1"
                />
              </a>
              <WhatsAppLink
                message="Olá! Vim pelo site da Império Sofás e quero ajuda para encontrar o sofá ideal para a minha casa."
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-black/20 px-5 py-3 text-sm font-semibold text-ivory backdrop-blur-sm transition hover:border-gold/70 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                <MessageCircle size={17} aria-hidden="true" />
                Converse com a gente
              </WhatsAppLink>
            </div>
          </div>
        </motion.div>

        <a
          href="#historia"
          className="group hidden justify-self-end pb-1 text-right text-xs uppercase tracking-[.18em] text-ivory/65 transition hover:text-gold lg:flex lg:items-center lg:gap-4"
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
