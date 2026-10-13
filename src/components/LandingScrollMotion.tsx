"use client";

import { useEffect } from "react";

export function LandingScrollMotion() {
  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let mediaContext: { revert: () => void } | null = null;
    let disposeRefresh = () => {};

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: no-preference)",
    );

    const loadMotion = async () => {
      if (!motionPreference.matches || loading || mediaContext || cancelled) {
        return;
      }
      loading = true;

      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);

        if (cancelled || !motionPreference.matches) return;

        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.matchMedia();
        mediaContext = context;

        context.add(
          {
            reduced: "(prefers-reduced-motion: reduce)",
            touch: "(pointer: coarse)",
            compact: "(max-width: 767px)",
            mobileOrTablet: "(max-width: 1023px)",
            wideDesktop:
              "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
            roomy: "(min-height: 760px)",
          },
          ({ conditions }) => {
            if (conditions?.reduced) return;

            const hero =
              document.querySelector<HTMLElement>("[data-hero-scene]");
            const heroImage =
              hero?.querySelector<HTMLElement>("[data-hero-image]");
            const heroOverlay = hero?.querySelector<HTMLElement>(
              "[data-hero-overlay]",
            );
            const heroCopy =
              hero?.querySelector<HTMLElement>("[data-hero-copy]");
            const heroWords =
              hero?.querySelectorAll<HTMLElement>("[data-hero-word]");
            const compactMotion = Boolean(
              conditions?.touch || conditions?.compact,
            );

            if (hero && heroImage && heroOverlay && heroCopy) {
              if (heroWords?.length) {
                gsap.from(heroWords, {
                  yPercent: 105,
                  opacity: 0,
                  duration: 0.42,
                  stagger: 0.035,
                  ease: "power3.out",
                  clearProps: "transform,opacity",
                });
              }

              gsap
                .timeline({
                  scrollTrigger: {
                    id: "imperio-hero-story",
                    trigger: hero,
                    start: "top top",
                    end: () =>
                      `+=${Math.round(window.innerHeight * (compactMotion ? 0.72 : 0.82))}`,
                    pin: Boolean(conditions?.wideDesktop && conditions?.roomy),
                    pinSpacing: Boolean(
                      conditions?.wideDesktop && conditions?.roomy,
                    ),
                    scrub: compactMotion ? 0.16 : 0.35,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                  },
                })
                .fromTo(
                  heroImage,
                  {
                    scale: compactMotion ? 1.09 : 1.085,
                    yPercent: compactMotion ? 2 : 0,
                  },
                  { scale: 1, yPercent: 0, duration: 0.72, ease: "none" },
                  0,
                )
                .fromTo(
                  heroOverlay,
                  { opacity: compactMotion ? 0.78 : 0.9 },
                  { opacity: 1, duration: 0.72, ease: "none" },
                  0,
                )
                .to(
                  heroCopy,
                  {
                    yPercent: compactMotion ? -6 : -8,
                    opacity: compactMotion ? 0.78 : 0.56,
                    duration: 0.42,
                    ease: "none",
                  },
                  0.56,
                );
            }

            if (conditions?.mobileOrTablet) {
              const cardGroups = document.querySelectorAll<HTMLElement>(
                "[data-mobile-card-group]",
              );

              cardGroups.forEach((group, groupIndex) => {
                const cards = group.querySelectorAll<HTMLElement>(
                  "[data-mobile-motion-card]",
                );
                if (!cards.length) return;

                if (group.hasAttribute("data-mobile-reveal-each")) {
                  cards.forEach((card, cardIndex) => {
                    gsap.from(card, {
                      y: 26,
                      autoAlpha: 0,
                      duration: 0.52,
                      ease: "power2.out",
                      clearProps: "transform,opacity,visibility",
                      scrollTrigger: {
                        id: `imperio-mobile-card-reveal-${groupIndex + 1}-${cardIndex + 1}`,
                        trigger: card,
                        start: "top 88%",
                        once: true,
                      },
                    });
                  });
                  return;
                }

                gsap.from(cards, {
                  y: 26,
                  autoAlpha: 0,
                  duration: 0.52,
                  stagger: 0.12,
                  ease: "power2.out",
                  clearProps: "transform,opacity,visibility",
                  scrollTrigger: {
                    id: `imperio-mobile-card-reveal-${groupIndex + 1}`,
                    trigger: group,
                    start: "top 82%",
                    once: true,
                  },
                });
              });
            }

            if (conditions?.wideDesktop && conditions?.roomy) {
              const viewport = document.querySelector<HTMLElement>(
                "[data-collection-viewport]",
              );
              const track = viewport?.querySelector<HTMLElement>(
                "[data-collection-track]",
              );
              const cards = track?.querySelectorAll("[data-collection-card]");

              if (viewport && track && cards && cards.length > 1) {
                const travel = () =>
                  Math.max(0, track.scrollWidth - viewport.clientWidth);

                gsap.to(track, {
                  x: () => -travel(),
                  ease: "none",
                  scrollTrigger: {
                    id: "imperio-collection-horizontal",
                    trigger: viewport,
                    start: "top top+=104",
                    end: () => `+=${Math.max(1, Math.round(travel()))}`,
                    pin: viewport,
                    pinSpacing: true,
                    scrub: 0.25,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                  },
                });
              }
            }

            if (conditions?.wideDesktop) {
              let active = true;
              let connected = false;
              let lenis: import("lenis").default | null = null;
              const updateLenis = (time: number) => lenis?.raf(time * 1000);
              const updateScrollTrigger = () => ScrollTrigger.update();

              void import("lenis")
                .then(({ default: Lenis }) => {
                  if (!active) return;
                  lenis = new Lenis({
                    autoRaf: false,
                    smoothWheel: true,
                    lerp: 0.08,
                    anchors: { offset: -88 },
                  });
                  lenis.on("scroll", updateScrollTrigger);
                  gsap.ticker.lagSmoothing(0);
                  gsap.ticker.add(updateLenis);
                  connected = true;
                  ScrollTrigger.refresh();
                })
                .catch(() => {
                  // Native scrolling remains available if Lenis cannot load.
                });

              return () => {
                active = false;
                if (connected && lenis) {
                  lenis.off("scroll", updateScrollTrigger);
                  gsap.ticker.remove(updateLenis);
                  gsap.ticker.lagSmoothing(500, 33);
                  lenis.destroy();
                }
              };
            }

            return undefined;
          },
        );

        const refresh = () => {
          if (!cancelled) ScrollTrigger.refresh();
        };
        void document.fonts.ready.then(refresh);
        window.addEventListener("load", refresh, { once: true });

        disposeRefresh = () => window.removeEventListener("load", refresh);
      } catch {
        // Static layout stays complete and usable if the optional motion chunk fails.
      } finally {
        loading = false;
      }
    };

    const onMotionPreferenceChange = () => {
      if (motionPreference.matches) void loadMotion();
    };

    motionPreference.addEventListener("change", onMotionPreferenceChange);
    void loadMotion();

    return () => {
      cancelled = true;
      motionPreference.removeEventListener("change", onMotionPreferenceChange);
      disposeRefresh();
      mediaContext?.revert();
      mediaContext = null;
    };
  }, []);

  return null;
}
