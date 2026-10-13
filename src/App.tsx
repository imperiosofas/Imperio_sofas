"use client";

import { MotionConfig } from "framer-motion";
import { LandingScrollMotion } from "./components/LandingScrollMotion";
import { Catalog } from "./sections/Catalog";
import { Differentials } from "./sections/Differentials";
import { FinalCta } from "./sections/FinalCta";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { Location } from "./sections/Location";
import { Reviews } from "./sections/Reviews";
import { FloatingContact } from "./sections/FloatingContact";

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-fonts min-h-screen overflow-x-clip bg-ink text-ivory selection:bg-gold selection:text-ink">
        <LandingScrollMotion />
        <main>
          <Hero />
          <Differentials />
          <Catalog />
          <Reviews />
          <Location />
          <FinalCta />
        </main>
        <Footer />
        <FloatingContact />
      </div>
    </MotionConfig>
  );
}

export default App;
