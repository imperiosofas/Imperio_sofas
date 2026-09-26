"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { WhatsAppLink } from "../components/WhatsAppLink";

export function FloatingContact() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const story = document.getElementById("historia");
    if (!story) return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(story);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <WhatsAppLink
      message="Olá! Vim pelo site da Império Sofás e quero conhecer os modelos disponíveis."
      aria-label="Falar com a Império Sofás pelo WhatsApp"
      className="fixed bottom-7 right-7 z-50 hidden size-12 place-items-center rounded-full border border-gold/65 bg-ink text-gold shadow-[0_10px_28px_rgba(0,0,0,.3)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold xl:grid"
    >
      <MessageCircle aria-hidden="true" size={23} strokeWidth={2} />
    </WhatsAppLink>
  );
}
