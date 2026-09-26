"use client";

import { SofaStory } from "./sections/SofaStory";
import { Differentials } from "./sections/Differentials";
import { Catalog } from "./sections/Catalog";
import { Reviews } from "./sections/Reviews";
import { Location } from "./sections/Location";
import { FinalCta } from "./sections/FinalCta";
import { Footer } from "./sections/Footer";
import { FloatingContact } from "./sections/FloatingContact";

function App() {
  return (
    <div className="min-h-screen overflow-x-clip bg-ink text-ivory selection:bg-gold selection:text-ink">
      <main>
        <SofaStory>
          <Catalog integrated />
        </SofaStory>
        <Differentials />
        <Reviews />
        <Location />
        <FinalCta />
      </main>
      <Footer />
      <FloatingContact />
    </div>
  );
}

export default App;
