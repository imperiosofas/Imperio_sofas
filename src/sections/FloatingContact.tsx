"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { useEnhancedMotion } from "../lib/useEnhancedMotion";
import styles from "./floating-contact.module.css";

export function FloatingContact() {
  const enhanced = useEnhancedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 260, damping: 24, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 260, damping: 24, mass: 0.35 });

  const resetPosition = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      className="landing-contact fixed z-50"
      style={{ x, y }}
      onPointerMove={(event) => {
        if (!enhanced || event.pointerType !== "mouse") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        rawX.set(
          Math.max(
            -5,
            Math.min(
              5,
              (event.clientX - bounds.left - bounds.width / 2) * 0.16,
            ),
          ),
        );
        rawY.set(
          Math.max(
            -5,
            Math.min(
              5,
              (event.clientY - bounds.top - bounds.height / 2) * 0.16,
            ),
          ),
        );
      }}
      onPointerLeave={resetPosition}
    >
      <motion.div whileTap={{ scale: 0.94 }}>
        <WhatsAppLink
          message="Olá! Vim pelo site da Império Sofás e quero conhecer os modelos disponíveis."
          aria-label="Falar com a Império Sofás pelo WhatsApp"
          className={`${styles.contactLink} grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_40px_rgba(37,211,102,.35)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold`}
        >
          <MessageCircle aria-hidden="true" size={27} strokeWidth={2.2} />
        </WhatsAppLink>
      </motion.div>
    </motion.div>
  );
}
