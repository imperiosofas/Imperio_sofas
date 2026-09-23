import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, MessageCircle, X } from "lucide-react";
import { Brand } from "../components/Brand";
import { WhatsAppLink } from "../components/WhatsAppLink";
import { cn } from "../lib/utils";

const links = [
  ["Início", "#inicio"],
  ["Nossa história", "#historia"],
  ["Diferenciais", "#diferenciais"],
  ["Modelos", "#catalogo"],
  ["Visite", "#localizacao"],
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        scrolled || open
          ? "border-white/8 bg-ink shadow-lg shadow-black/10"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="shell flex h-[76px] items-center justify-between gap-4 lg:h-[88px]">
        <Brand />
        <nav
          className="hidden items-center gap-6 xl:flex"
          aria-label="Navegação principal"
        >
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-sm text-sm font-medium text-ivory/75 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              {label}
            </a>
          ))}
        </nav>
        <WhatsAppLink
          message="Olá! Vim pelo site e quero ajuda para escolher um sofá para a minha casa."
          className="hidden items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-gold transition hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold xl:inline-flex"
        >
          <MessageCircle size={17} aria-hidden="true" /> Fale com nossos
          vendedores
        </WhatsAppLink>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid size-11 place-items-center rounded-full border border-white/12 bg-white/5 text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden border-t border-white/8 bg-ink xl:hidden"
            aria-label="Navegação móvel"
          >
            <div className="shell grid gap-1 py-4">
              {links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3.5 text-base font-medium text-ivory/85 hover:bg-white/5 hover:text-gold"
                >
                  {label}
                </a>
              ))}
              <WhatsAppLink
                message="Olá! Vim pelo site e quero ajuda para escolher um sofá para a minha casa."
                className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 font-bold text-ink"
              >
                <MessageCircle size={18} aria-hidden="true" /> Fale com nossos
                vendedores
              </WhatsAppLink>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
