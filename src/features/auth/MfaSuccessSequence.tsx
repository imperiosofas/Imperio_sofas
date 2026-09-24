"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export function MfaSuccessSequence({
  code,
  onComplete,
}: {
  code: string;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const completed = useRef(false);

  return (
    <motion.div
      className="auth-mfa-success"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <div className="auth-otp-success-stage" aria-hidden="true">
        <span className="auth-otp-success-ring auth-otp-success-ring--outer" />
        <span className="auth-otp-success-ring auth-otp-success-ring--inner" />
        {Array.from(code, (digit, index) => {
          const angle = (index / code.length) * Math.PI * 2 - Math.PI / 2;
          const startX = (index - (code.length - 1) / 2) * 27;
          const orbitX = Math.cos(angle) * 39;
          const orbitY = Math.sin(angle) * 39;

          return (
            <motion.span
              key={`${index}-${digit}`}
              className="auth-otp-success-digit"
              initial={{ x: startX, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              animate={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      x: [startX, orbitX, 0],
                      y: [0, orbitY, 0],
                      rotate: [0, (index % 2 ? -1 : 1) * 24, 0],
                      scale: [1, 0.82, 0.22],
                      opacity: [1, 1, 0],
                    }
              }
              transition={{
                duration: reduceMotion ? 0.12 : 0.62,
                delay: reduceMotion ? 0 : index * 0.018,
                ease: [0.22, 0.72, 0.22, 1],
              }}
            >
              {digit}
            </motion.span>
          );
        })}
        <motion.span
          className="auth-otp-success-mark"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0.12 : 0.24,
            delay: reduceMotion ? 0 : 0.48,
            ease: [0.22, 0.72, 0.22, 1],
          }}
          onAnimationComplete={() => {
            if (completed.current) return;
            completed.current = true;
            onComplete();
          }}
        >
          <ShieldCheck size={27} strokeWidth={1.7} />
        </motion.span>
      </div>
      <p className="auth-otp-success-title">Acesso confirmado</p>
      <p className="auth-helper">Só um instante, estamos abrindo sua conta.</p>
    </motion.div>
  );
}
