"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowDownRight, MoveDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { products } from "../data/products";

const stories = [
  {
    product: products[0],
    title: "O descanso também faz parte dos planos.",
    copy: "Entre um dia e outro, existe aquele momento em que tudo pode esperar um pouco. A sala também é lugar de pausa.",
    note: "Um canto para chamar de seu",
  },
  {
    product: products[1],
    title: "Tem conversa que merece ficar mais um pouco.",
    copy: "A visita chega, o café aparece e ninguém olha a hora. É bom quando a casa convida a ficar.",
    note: "Espaço para estar junto",
  },
  {
    product: products[2],
    title: "A casa acompanha os seus melhores encontros.",
    copy: "Dos dias tranquilos aos momentos com a casa cheia, o ambiente ganha vida quando combina com quem vive nele.",
    note: "Um lugar para compartilhar",
  },
] as const;

export function SofaStory() {
  const [activeStory, setActiveStory] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const chapters = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sofa-chapter]"),
    );
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = current?.target.getAttribute("data-sofa-chapter");
        if (index !== null && index !== undefined)
          setActiveStory(Number(index));
      },
      { rootMargin: "-32% 0px -38% 0px", threshold: [0, 0.2, 0.5] },
    );

    chapters.forEach((chapter) => observer.observe(chapter));
    return () => observer.disconnect();
  }, []);

  const active = stories[activeStory] ?? stories[0];

  return (
    <section
      id="historia"
      aria-labelledby="story-title"
      className="relative overflow-clip bg-[#eee9df] py-20 text-[#191712] sm:py-24 lg:py-32"
    >
      <div className="shell">
        <div className="mb-12 grid gap-5 border-b border-black/12 pb-8 sm:mb-16 sm:pb-10 lg:grid-cols-[1fr_.7fr] lg:items-end lg:gap-12">
          <div>
            <p className="eyebrow !text-[#93702d]">
              Uma história em três momentos
            </p>
            <h2
              id="story-title"
              className="mt-4 max-w-3xl font-display text-5xl font-medium leading-[.94] tracking-[-.035em] sm:text-6xl lg:text-7xl"
            >
              A casa acontece
              <br className="hidden sm:block" />
              <span className="italic text-[#93702d]">
                onde você se sente bem.
              </span>
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-black/65 sm:text-base sm:leading-7 lg:justify-self-end">
            Mais do que preencher a sala, escolher um sofá é imaginar os
            momentos que vão caber ali. Comece pelo que faz sentido para a sua
            casa.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-16">
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="relative aspect-[0.92] overflow-hidden rounded-[1.75rem] bg-[#ded8cc] xl:rounded-[2.25rem]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.figure
                    key={active.product.name}
                    initial={
                      reduceMotion ? false : { opacity: 0, scale: 1.025 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.99 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={active.product.image}
                      alt={active.product.alt}
                      fill
                      sizes="(min-width: 1280px) 52vw, 48vw"
                      className="object-contain p-4 mix-blend-multiply xl:p-8"
                    />
                  </motion.figure>
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-7 xl:p-9">
                  <div>
                    <p className="text-[.65rem] font-bold uppercase tracking-[.19em] text-white/75">
                      Em destaque · {String(activeStory + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-2 font-display text-4xl font-medium leading-none sm:text-5xl">
                      {active.product.name}
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      {active.product.size}
                    </p>
                  </div>
                  <span className="mb-1 grid size-11 shrink-0 place-items-center rounded-full border border-white/55">
                    <ArrowDownRight size={20} aria-hidden="true" />
                  </span>
                </div>
                <span className="absolute left-5 top-5 rounded-full border border-black/10 bg-[#f4efe4]/85 px-3 py-2 text-[.62rem] font-bold uppercase tracking-[.16em] text-[#393329] backdrop-blur-sm xl:left-7 xl:top-7">
                  {active.note}
                </span>
              </div>

              <div
                className="mt-5 flex items-center gap-4"
                aria-label="Capítulos da história"
              >
                <span className="font-display text-2xl font-semibold tabular-nums text-[#93702d]">
                  {String(activeStory + 1).padStart(2, "0")}
                  <span className="px-1 text-black/30">/</span>
                  {String(stories.length).padStart(2, "0")}
                </span>
                <div className="flex h-px flex-1 gap-1.5">
                  {stories.map((story, index) => (
                    <span
                      key={story.product.name}
                      className={`h-px flex-1 transition-colors duration-300 ${index <= activeStory ? "bg-[#93702d]" : "bg-black/15"}`}
                    />
                  ))}
                </div>
                <span className="text-[.65rem] font-bold uppercase tracking-[.15em] text-black/45">
                  {active.note}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-14 sm:gap-20 lg:gap-0">
            {stories.map((story, index) => (
              <article
                key={story.product.name}
                id={`capitulo-${index + 1}`}
                data-sofa-chapter={index}
                className="scroll-mt-28 lg:flex lg:min-h-[76svh] lg:flex-col lg:justify-center"
              >
                <figure className="relative mb-6 aspect-[1.08] overflow-hidden rounded-[1.5rem] bg-[#ded8cc] lg:hidden">
                  <Image
                    src={story.product.image}
                    alt={story.product.alt}
                    fill
                    sizes="(min-width: 640px) 88vw, calc(100vw - 32px)"
                    className="object-contain p-3 mix-blend-multiply sm:p-6"
                    loading="lazy"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-white">
                    <span>
                      <span className="block text-[.62rem] font-bold uppercase tracking-[.17em] text-white/75">
                        {String(index + 1).padStart(2, "0")} · {story.note}
                      </span>
                      <span className="mt-1 block font-display text-3xl font-semibold">
                        {story.product.name}
                      </span>
                    </span>
                    <span className="mb-1 shrink-0 text-sm text-white/80">
                      {story.product.size}
                    </span>
                  </figcaption>
                </figure>

                <div className="max-w-xl lg:py-16">
                  <p className="flex items-center gap-3 text-[.68rem] font-bold uppercase tracking-[.19em] text-[#93702d]">
                    <span className="font-display text-2xl font-semibold tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px w-8 bg-[#93702d]/55" />
                    {story.note}
                  </p>
                  <h3 className="mt-4 max-w-lg font-display text-4xl font-medium leading-[.98] tracking-[-.025em] sm:text-5xl lg:text-6xl">
                    {story.title}
                  </h3>
                  <p className="mt-5 max-w-md text-sm leading-6 text-black/65 sm:text-base sm:leading-7">
                    {story.copy}
                  </p>
                  <p className="mt-7 border-t border-black/12 pt-4 text-sm font-semibold text-[#252119]">
                    {story.product.name}
                    <span className="px-2 text-black/30">/</span>
                    {story.product.size}
                  </p>
                  <a
                    href="#catalogo"
                    className="group mt-6 inline-flex min-h-11 items-center gap-3 rounded-full border border-black/20 px-5 py-2.5 text-sm font-semibold transition hover:border-[#93702d] hover:bg-[#93702d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93702d]"
                  >
                    Conheça os modelos
                    <MoveDownRight
                      size={16}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5"
                    />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>

        <a
          href="#diferenciais"
          className="mx-auto mt-16 flex w-fit items-center gap-3 text-xs font-bold uppercase tracking-[.16em] text-[#6f5828] transition hover:text-black lg:mt-10"
        >
          Continue conhecendo a Império
          <ArrowDown size={15} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
