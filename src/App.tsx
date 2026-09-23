'use client'

import { useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useEnhancedMotion } from './lib/useEnhancedMotion'
import { MessageCircle } from 'lucide-react'
import { WhatsAppLink } from './components/WhatsAppLink'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { SofaStory } from './sections/SofaStory'
import { Differentials } from './sections/Differentials'
import { Catalog } from './sections/Catalog'
import { Reviews } from './sections/Reviews'
import { Location } from './sections/Location'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'

function App() {
  const [showFloatingContact, setShowFloatingContact] = useState(false)
  const enhancedMotion = useEnhancedMotion()

  useEffect(() => {
    const hero = document.getElementById('inicio')
    const story = document.getElementById('historia')
    if (!hero || !story || !('IntersectionObserver' in window)) return

    let heroIsVisible = true
    let storyIsVisible = true

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) heroIsVisible = entry.isIntersecting
          if (entry.target === story) storyIsVisible = entry.isIntersecting
        }
        setShowFloatingContact(!heroIsVisible && !storyIsVisible)
      },
      { threshold: 0.05 },
    )
    observer.observe(hero)
    observer.observe(story)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!enhancedMotion) return
    let cancelled = false
    let destroy: (() => void) | undefined
    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      const lenis = new Lenis({ autoRaf: true, smoothWheel: true, lerp: 0.08, anchors: { offset: -88 } })
      destroy = () => lenis.destroy()
    })
    return () => { cancelled = true; destroy?.() }
  }, [enhancedMotion])

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen overflow-x-clip bg-ink text-ivory selection:bg-gold selection:text-ink">
      <Header />
      <main>
        <Hero />
        <SofaStory />
        <Differentials />
        <Catalog />
        <Reviews />
        <Location />
        <FinalCta />
      </main>
      <Footer />
      {showFloatingContact ? (
        <WhatsAppLink
          message="Olá! Vim pelo site da Império Sofás e quero conhecer os modelos disponíveis."
          aria-label="Falar com a Império Sofás pelo WhatsApp"
          className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_40px_rgba(37,211,102,.35)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold md:bottom-7 md:right-7"
        >
          <MessageCircle aria-hidden="true" size={27} strokeWidth={2.2} />
        </WhatsAppLink>
      ) : null}
    </div>
    </MotionConfig>
  )
}

export default App
