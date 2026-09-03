import { motion, useReducedMotion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion()
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '-50px 0px' })

  return (
    <motion.div ref={ref} className={cn(className)} initial={reduceMotion ? false : { opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduceMotion ? 0 : 0.65, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
