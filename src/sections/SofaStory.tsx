import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import { products } from "../data/products";
import belizeScene from "../assets/products/belize-enhanced-1080.webp";
import berlimScene from "../assets/products/berlim-enhanced-1080.webp";
import dallasScene from "../assets/products/dallas-enhanced-1080.webp";

const chapters = [
  {
    product: products[0],
    image: belizeScene,
    title: "O lugar de voltar para casa.",
    copy: "Belize, 2,20 m. Veja a proporção do sofá no espaço real da loja e imagine como ele ficaria na sua sala.",
    tone: "belize",
  },
  {
    product: products[1],
    image: berlimScene,
    title: "A conversa pode ficar.",
    copy: "Berlim, 2,50 m. Uma medida diferente muda toda a composição do ambiente. Compare com calma.",
    tone: "berlim",
  },
  {
    product: products[2],
    image: dallasScene,
    title: "Mais sala para viver.",
    copy: "Dallas, 2,90 m. Venha sentar, conferir os detalhes e conversar sobre as opções na loja em Taubaté.",
    tone: "dallas",
  },
] as const;

export function SofaStory() {
  return (
    <section
      id="historia"
      aria-labelledby="story-title"
      className="story bg-[#171410] text-ivory"
    >
      <div className="story-intro shell">
        <div>
          <p className="eyebrow">Uma sala, muitas formas de estar</p>
          <h2 id="story-title" className="story-intro__title font-display">
            Veja o sofá <em>ganhar espaço.</em>
          </h2>
        </div>
        <p className="story-intro__copy">
          Belize, Berlim e Dallas. Três modelos fotografados na loja, cada um
          com uma medida e uma presença diferentes. Role para conhecer de perto.
        </p>
      </div>

      <div className="story-track">
        {chapters.map((chapter, index) => (
          <article
            key={chapter.product.name}
            id={`capitulo-${index + 1}`}
            className={`story-chapter story-chapter--${chapter.tone}`}
            aria-labelledby={`chapter-title-${index + 1}`}
          >
            <div className="story-chapter__scene">
              <figure className="story-chapter__media">
                <Image
                  src={chapter.image}
                  alt={chapter.product.alt}
                  fill
                  sizes="(min-width: 1024px) 54vw, 100vw"
                  className="story-chapter__image"
                  loading="lazy"
                />
                <figcaption className="story-chapter__photo-label">
                  Na loja em Taubaté
                </figcaption>
              </figure>

              <div className="story-chapter__copy">
                <div className="story-chapter__topline">
                  <span>Império Sofás</span>
                  <span className="story-chapter__index">
                    {String(index + 1).padStart(2, "0")} / 03
                  </span>
                </div>

                <div className="story-chapter__main">
                  <p className="story-chapter__product">
                    {chapter.product.name} <span>· {chapter.product.size}</span>
                  </p>
                  <h3
                    id={`chapter-title-${index + 1}`}
                    className="story-chapter__title font-display"
                  >
                    {chapter.title}
                  </h3>
                  <p className="story-chapter__description">{chapter.copy}</p>
                  <Link href="/loja/sofas" className="story-chapter__link">
                    Ver coleção de sofás
                    <ArrowDownRight size={18} aria-hidden="true" />
                  </Link>
                </div>

                <div className="story-chapter__footer" aria-hidden="true">
                  <span>Continue rolando</span>
                  <span className="story-chapter__progress">
                    {chapters.map((item, step) => (
                      <span
                        key={item.product.name}
                        className={step <= index ? "is-current" : ""}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
