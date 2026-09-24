"use client";

import { MotionConfig, motion } from "framer-motion";
import { House, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  {
    label: "Início",
    href: "/",
    Icon: House,
    isActive: (path: string) => path === "/",
  },
  {
    label: "Loja",
    href: "/loja",
    Icon: Store,
    isActive: (path: string) =>
      path.startsWith("/loja") || path.startsWith("/produto/"),
  },
  {
    label: "Conta",
    href: "/conta",
    Icon: UserRound,
    isActive: (path: string) =>
      path.startsWith("/conta") || path.startsWith("/auth/"),
  },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <div className="bottom-navigation">
        <nav
          className="bottom-navigation__bar"
          aria-label="Navegação principal"
        >
          {destinations.map(({ label, href, Icon, isActive }) => {
            const active = isActive(pathname);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="bottom-navigation__item"
              >
                {active && (
                  <motion.span
                    layoutId="bottom-navigation-indicator"
                    className="bottom-navigation__indicator"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                      mass: 0.72,
                    }}
                    aria-hidden="true"
                  />
                )}
                <motion.span
                  className="bottom-navigation__icon"
                  animate={{ y: active ? -4 : 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden="true"
                >
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                </motion.span>
                <motion.span
                  className="bottom-navigation__label"
                  animate={{
                    opacity: active ? 1 : 0.64,
                    y: active ? 0 : 1,
                  }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {label}
                </motion.span>
              </Link>
            );
          })}
        </nav>
      </div>
    </MotionConfig>
  );
}
