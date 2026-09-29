"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import styles from "./mfa-success.module.css";

const MOTION_DURATION = 2.25;
const REDUCED_MOTION_DURATION = 0.7;
const DIGIT_TIMES = [0, 0.12, 0.35, 0.56, 0.75, 1];

export function MfaSuccessSequence({
  code,
  onComplete,
}: {
  code: string;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        if (completed.current) return;
        completed.current = true;
        onCompleteRef.current();
      },
      (reduceMotion ? REDUCED_MOTION_DURATION : MOTION_DURATION) * 1000,
    );

    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return (
    <div className={styles.sequence} role="status" aria-live="polite">
      <div className={styles.stage} aria-hidden="true">
        {!reduceMotion && (
          <>
            <motion.span
              className={styles.orbit}
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{
                opacity: [0, 0, 0.68, 0.68, 0],
                scale: [0.78, 0.78, 1, 1, 0.7],
              }}
              transition={{ duration: 1.85, times: [0, 0.22, 0.4, 0.74, 1] }}
            />
            {Array.from({ length: 6 }, (_, index) => {
              const digit = code[index] ?? "";
              const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
              const rowX = (index - 2.5) * 43;
              const orbitX = Math.cos(angle) * 65;
              const orbitY = Math.sin(angle) * 56;
              const nextX = Math.cos(angle + Math.PI / 3) * 65;
              const nextY = Math.sin(angle + Math.PI / 3) * 56;

              return (
                <motion.span
                  key={index}
                  className={styles.cell}
                  initial={{ x: rowX, y: 0, rotate: 0, scale: 1, opacity: 1 }}
                  animate={{
                    x: [rowX, rowX, orbitX, nextX, nextX * 0.54, 0],
                    y: [0, 0, orbitY, nextY, nextY * 0.54, 0],
                    rotate: [0, 0, index % 2 ? -10 : 10, 55, 85, 90],
                    scale: [1, 1, 0.92, 0.92, 0.7, 0.16],
                    opacity: [1, 1, 1, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.82,
                    delay: index * 0.015,
                    times: DIGIT_TIMES,
                    ease: "easeInOut",
                  }}
                >
                  {digit}
                </motion.span>
              );
            })}
          </>
        )}
        <motion.span
          className={styles.confirmation}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.72 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: reduceMotion ? 0 : 1.67,
            duration: reduceMotion ? 0 : 0.3,
            ease: [0.2, 0.75, 0.25, 1],
          }}
        >
          <Check size={30} strokeWidth={1.8} />
        </motion.span>
      </div>
      <motion.p
        className={styles.title}
        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: reduceMotion ? 0 : 1.7,
          duration: reduceMotion ? 0 : 0.3,
        }}
      >
        Acesso confirmado
      </motion.p>
      <motion.p
        className={styles.helper}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          delay: reduceMotion ? 0 : 1.8,
          duration: reduceMotion ? 0 : 0.25,
        }}
      >
        Só um instante, estamos abrindo sua conta.
      </motion.p>
    </div>
  );
}
