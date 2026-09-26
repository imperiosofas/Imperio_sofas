"use client";

import { useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import heroImage from "../assets/hero-sofa-1536.webp";
import belizeImage from "../assets/products/belize-enhanced-1080.webp";
import berlimImage from "../assets/products/berlim-enhanced-1080.webp";
import dallasImage from "../assets/products/dallas-enhanced-1080.webp";
import styles from "./SofaStory.module.css";

/** One viewport, one clock: copy and media share the same scroll timeline. */
export function SofaStory({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
  });
  // Keep masks, transforms and opacity on the same measured clock. Mixing
  // native ViewTimeline opacity with JS transforms desynchronizes this stage.
  const progress = useTransform(() => scrollYProgress.get());

  const heroScale = useTransform(progress, [0, 0.38], [1, 1.24]);
  const heroParallax = useTransform(progress, [0, 0.38], ["0%", "-8%"]);
  const heroY = useTransform(progress, [0, 0.1, 0.3], [0, -16, -150]);
  const heroOpacity = useTransform(progress, [0, 0.13, 0.28], [1, 1, 0]);
  const heroDisplay = useTransform(progress, (p) =>
    p < 0.3 ? "flex" : "none",
  );

  const productY = useTransform(progress, [0.17, 0.39], ["105%", "0%"]);
  const productScale = useTransform(
    progress,
    [0.17, 0.55, 0.8],
    [1.24, 1.08, 1],
  );
  const productPan = useTransform(progress, [0.25, 0.6], ["4%", "-3%"]);
  const arrange = useTransform(progress, [0.57, 0.87], [0, 1]);
  const fan = useTransform(progress, [0.65, 0.91], [0, 1]);

  const comfortY = useTransform(
    progress,
    [0.25, 0.4, 0.56, 0.72],
    [90, 0, -12, -125],
  );
  const comfortOpacity = useTransform(
    progress,
    [0.25, 0.37, 0.57, 0.69],
    [0, 1, 1, 0],
  );
  const comfortDisplay = useTransform(progress, (p) =>
    p > 0.24 && p < 0.72 ? "flex" : "none",
  );
  const collectionY = useTransform(progress, [0.66, 0.88], [100, 0]);
  const collectionOpacity = useTransform(progress, [0.66, 0.8], [0, 1]);
  const collectionDisplay = useTransform(progress, (p) =>
    p > 0.65 ? "flex" : "none",
  );
  const shade = useTransform(progress, [0.48, 0.83], [1, 0.16]);

  return (
    <div id="historia" className={styles.experience}>
      <div ref={track} id="inicio" className={styles.track} data-story-track>
        <div className={styles.stage} data-story-stage>
          <motion.div
            className={styles.heroMedia}
            style={{ scale: heroScale, y: heroParallax }}
            aria-hidden="true"
          >
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.heroPhoto}
            />
            <div className={styles.heroShade} />
          </motion.div>

          <motion.div
            className={styles.productStage}
            style={
              { y: productY, "--arrange": arrange, "--fan": fan } as MotionStyle
            }
            aria-hidden="true"
            data-story-media
          >
            <div className={`${styles.sideCard} ${styles.cardLeft}`}>
              <Image
                src={berlimImage}
                alt=""
                fill
                sizes="(min-width: 900px) 30vw, 60vw"
              />
              <span>
                Berlim <small>2,50 m</small>
              </span>
            </div>
            <div className={`${styles.sideCard} ${styles.cardRight}`}>
              <Image
                src={dallasImage}
                alt=""
                fill
                sizes="(min-width: 900px) 30vw, 60vw"
              />
              <span>
                Dallas <small>2,90 m</small>
              </span>
            </div>
            <div className={styles.mainMedia}>
              <motion.div
                className={styles.mainPhoto}
                style={{ scale: productScale, y: productPan }}
              >
                <Image src={belizeImage} alt="" fill sizes="100vw" />
              </motion.div>
              <motion.div
                className={styles.productShade}
                style={{ opacity: shade }}
              />
              <span className={styles.mediaName}>
                Belize <small>2,20 m</small>
              </span>
            </div>
          </motion.div>

          <motion.div
            className={`${styles.copy} ${styles.heroCopy}`}
            style={{ y: heroY, opacity: heroOpacity, display: heroDisplay }}
            data-story-copy="hero"
          >
            <p className={styles.eyebrow}>Império Sofás · Taubaté</p>
            <h1>
              A vida fica <em>mais em casa.</em>
            </h1>
            <p className={styles.description}>
              Um lugar para receber, descansar e deixar o dia lá fora.
            </p>
            <Link href="/loja" className={styles.primaryLink}>
              Explorar a loja <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
            <span className={styles.scrollHint} aria-hidden="true">
              <ArrowDown size={15} /> Role para sentir de perto
            </span>
          </motion.div>

          <motion.div
            className={`${styles.copy} ${styles.comfortCopy}`}
            style={{
              y: comfortY,
              opacity: comfortOpacity,
              display: comfortDisplay,
            }}
            data-story-copy="comfort"
          >
            <p className={styles.eyebrow}>01 / De perto</p>
            <h2>
              O conforto está <em>nos detalhes.</em>
            </h2>
            <p className={styles.description}>
              Conheça o Belize. São 2,20 m para imaginar na sua sala — do
              primeiro olhar ao momento de sentar.
            </p>
            <div className={styles.measure}>
              <span /> <p>Belize · 2,20 m</p> <span />
            </div>
          </motion.div>

          <motion.div
            className={`${styles.copy} ${styles.collectionCopy}`}
            style={{
              y: collectionY,
              opacity: collectionOpacity,
              display: collectionDisplay,
            }}
            data-story-copy="collection"
          >
            <p className={styles.eyebrow}>02 / Seu próximo encontro</p>
            <h2>
              Qual combina <em>com a sua casa?</em>
            </h2>
            <p className={styles.description}>
              Belize, Berlim, Dallas. Explore medidas e modelos e encontre o
              seu.
            </p>
            <Link href="/loja/sofas" className={styles.primaryLink}>
              Ver coleção de sofás <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
          </motion.div>

          <div className={styles.progressRail} aria-hidden="true">
            <motion.span style={{ scaleX: progress }} />
          </div>
        </div>
      </div>
      <div className={styles.collectionBridge}>{children}</div>
    </div>
  );
}
