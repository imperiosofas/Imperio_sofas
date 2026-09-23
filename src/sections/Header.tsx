"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { Brand } from "../components/Brand";
import { cn } from "../lib/utils";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isAccountRoute =
    pathname.startsWith("/conta") || pathname.startsWith("/auth/");

  const links = isHome
    ? ([
        ["Nossa história", "/#historia"],
        ["Diferenciais", "/#diferenciais"],
        ["Visite a loja", "/#localizacao"],
        ["Sofás", "/loja/sofas"],
      ] as const)
    : ([
        ["Início", "/#inicio"],
        ["Sofás", "/loja/sofas"],
        ["Todas as coleções", "/loja"],
      ] as const);

  return (
    !isAccountRoute && (
      <header
        className={cn(
          "inset-x-0 top-0 z-50 border-b transition-colors duration-200",
          isHome ? "fixed" : "sticky",
          !isHome || scrolled || open
            ? "border-white/8 bg-ink shadow-lg shadow-black/10"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="shell flex h-[76px] items-center justify-between gap-2 sm:gap-4 lg:h-[88px]">
          <Brand />
          <nav
            className="hidden items-center gap-6 xl:flex"
            aria-label="Navegação principal"
          >
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-sm text-sm font-medium text-ivory/75 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/conta"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-ivory/75 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            >
              <UserRound size={16} aria-hidden="true" /> Minha conta
            </Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/loja"
              className="hidden min-h-11 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-gold transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:inline-flex"
            >
              Explorar a loja
            </Link>
            <Link
              href="/carrinho"
              aria-label="Sacola; compras online em preparação"
              title="Sacola — compras online em preparação"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-ivory transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:w-auto sm:gap-2 sm:px-3"
            >
              <ShoppingBag size={19} aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:text-sm">Sacola</span>
              <span className="hidden text-[.62rem] uppercase tracking-[.12em] text-gold/80 lg:inline">
                Em breve
              </span>
            </Link>
            <Link
              href="/loja"
              className="inline-flex min-h-11 items-center rounded-full bg-gold px-4 text-sm font-bold text-ink transition-colors hover:bg-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:hidden"
            >
              Loja
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold xl:hidden"
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
                <Link
                  href="/loja"
                  onClick={() => setOpen(false)}
                  className="mb-2 flex min-h-12 items-center justify-between rounded-xl bg-gold px-4 font-bold text-ink"
                >
                  Explorar a loja
                  <ShoppingBag size={18} aria-hidden="true" />
                </Link>
                {links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3.5 text-base font-medium text-ivory/85 hover:bg-white/5 hover:text-gold"
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/carrinho"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex min-h-12 items-center gap-3 rounded-lg px-3 py-3.5 font-medium text-ivory/85 hover:bg-white/5 hover:text-gold"
                >
                  <ShoppingBag size={18} aria-hidden="true" /> Sacola
                  <span className="text-xs text-gold/80">Em breve</span>
                </Link>
                <Link
                  href="/conta"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex min-h-12 items-center gap-3 rounded-lg px-3 py-3.5 font-medium text-ivory/85 hover:bg-white/5 hover:text-gold"
                >
                  <UserRound size={18} aria-hidden="true" /> Minha conta
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    )
  );
}
