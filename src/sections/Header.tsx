"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Brand } from "../components/Brand";
import { cn } from "../lib/utils";

const navigationItems = [
  { label: "Início", href: "/", isActive: (path: string) => path === "/" },
  {
    label: "Loja",
    href: "/loja",
    isActive: (path: string) =>
      path.startsWith("/loja") || path.startsWith("/produto/"),
  },
  {
    label: "Conta",
    href: "/conta",
    isActive: (path: string) =>
      path.startsWith("/conta") || path.startsWith("/auth/"),
  },
] as const;

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAccountRoute =
    pathname.startsWith("/conta") || pathname.startsWith("/auth/");
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = window.scrollY > 28;
      if (next === scrolledRef.current) return;
      scrolledRef.current = next;
      setScrolled(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className={cn(
        "site-header inset-x-0 top-0 z-50 border-b transition-colors duration-200",
        isHome ? "fixed" : "sticky",
        isAccountRoute && "site-header--account",
        !isHome || scrolled
          ? "border-white/8 bg-ink shadow-lg shadow-black/10"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="shell flex h-[76px] items-center justify-between gap-3 lg:h-[88px]">
        <Brand />

        <nav
          className="site-header__desktop-nav items-center gap-8"
          aria-label="Navegação principal"
        >
          {navigationItems.map(({ label, href, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold",
                  active ? "text-gold" : "text-ivory/75 hover:text-gold",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

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
      </div>
    </header>
  );
}
