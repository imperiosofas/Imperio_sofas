"use client";

import { House, ShoppingBag, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import styles from "./bottom-navigation.module.css";

const BAR_HEIGHT = 70;
const CORNER = 14;
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
    label: "Carrinho",
    href: "/carrinho",
    Icon: ShoppingBag,
    isActive: (path: string) => path.startsWith("/carrinho"),
  },
  {
    label: "Conta",
    href: "/conta",
    Icon: UserRound,
    isActive: (path: string) =>
      path.startsWith("/conta") || path.startsWith("/auth/"),
  },
] as const;

type CartSummaryRequest = {
  generation: number;
  promise: Promise<void>;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

// The bar's top edge melts into a concave cradle around the active tab: the
// curve leaves the edge and meets the cradle tangentially, so nothing creases.
function platePath(width: number, center: number, selected: boolean) {
  const depth = 28;
  const top = selected
    ? `H ${center - 34}
       C ${center - 26} 0 ${center - 27} ${depth} ${center} ${depth}
       C ${center + 27} ${depth} ${center + 26} 0 ${center + 34} 0
       H ${width - CORNER}`
    : `H ${width - CORNER}`;
  return `M ${CORNER} 0 ${top}
    Q ${width} 0 ${width} ${CORNER} V ${BAR_HEIGHT - CORNER}
    Q ${width} ${BAR_HEIGHT} ${width - CORNER} ${BAR_HEIGHT}
    H ${CORNER} Q 0 ${BAR_HEIGHT} 0 ${BAR_HEIGHT - CORNER}
    V ${CORNER} Q 0 0 ${CORNER} 0 Z`;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(reducedMotionQuery);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

// Slot-space spring (0..3). Plain React state on purpose: geometry derived from
// motion values captured a stale width once and left the whole dock invisible.
function useDockPosition(target: number) {
  const reduced = usePrefersReducedMotion();
  const [position, setPosition] = useState(target);
  const motion = useRef({ x: target, v: 0 });
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const state = motion.current;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const acceleration = 190 * (target - state.x) - 27 * state.v;
      state.v += acceleration * dt;
      state.x += state.v * dt;
      if (Math.abs(target - state.x) < 0.002 && Math.abs(state.v) < 0.02) {
        state.x = target;
        state.v = 0;
        setPosition(target);
        return;
      }
      setPosition(state.x);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, reduced]);

  return reduced ? target : position;
}
export function BottomNavigation() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [navWidth, setNavWidth] = useState(0);
  const cartRequest = useRef<CartSummaryRequest | null>(null);
  const authGeneration = useRef(0);
  const requestVersion = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const client = createSupabaseBrowserClient();
    if (!client)
      return () => {
        mounted.current = false;
      };

    const refresh = (force = false) => {
      const generation = authGeneration.current;
      const pending = cartRequest.current;
      if (!force && pending?.generation === generation) return pending.promise;

      const version = ++requestVersion.current;
      const request = (async () => {
        try {
          const response = await fetch("/api/cart/summary", {
            cache: "no-store",
            credentials: "same-origin",
          });
          const summary = (await response.json()) as {
            authenticated?: boolean;
            count?: number | null;
          };
          if (
            mounted.current &&
            generation === authGeneration.current &&
            version === requestVersion.current
          ) {
            setCartCount(
              response.ok &&
                summary.authenticated &&
                typeof summary.count === "number"
                ? summary.count
                : 0,
            );
          }
        } catch {
          if (
            mounted.current &&
            generation === authGeneration.current &&
            version === requestVersion.current
          ) {
            setCartCount(0);
          }
        }
      })().finally(() => {
        if (cartRequest.current?.promise === request)
          cartRequest.current = null;
      });
      cartRequest.current = { generation, promise: request };
      return request;
    };

    const onCartChanged = () => void refresh(true);
    void refresh();
    window.addEventListener("cart:changed", onCartChanged);
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        authGeneration.current += 1;
        requestVersion.current += 1;
        cartRequest.current = null;
        if (mounted.current) setCartCount(0);
      } else if (event === "SIGNED_IN") {
        authGeneration.current += 1;
        cartRequest.current = null;
        setTimeout(() => void refresh(true), 0);
      }
    });
    return () => {
      mounted.current = false;
      window.removeEventListener("cart:changed", onCartChanged);
      listener.subscription.unsubscribe();
    };
  }, []);

  const routeIndex = destinations.findIndex(({ isActive }) =>
    isActive(pathname),
  );
  // A tap selects the tab immediately; it stops applying once the route
  // changes, so the pathname stays authoritative (redirects, back/forward).
  const [tap, setTap] = useState<{ index: number; from: string } | null>(null);
  const activeIndex = tap && tap.from === pathname ? tap.index : routeIndex;
  // Remember where the bead came from so its icon can cross-fade on the way.
  const [track, setTrack] = useState({
    active: Math.max(0, activeIndex),
    from: Math.max(0, activeIndex),
  });
  if (activeIndex >= 0 && activeIndex !== track.active)
    setTrack({ active: activeIndex, from: track.active });
  const fromIndex = track.from;
  const position = useDockPosition(Math.max(0, activeIndex));
  const navRef = useRef<HTMLElement>(null);

  const measure = useCallback(() => {
    const width = navRef.current?.getBoundingClientRect().width ?? 0;
    setNavWidth((current) =>
      Math.abs(current - width) < 0.5 ? current : width,
    );
  }, []);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measure]);

  if (pathname.startsWith("/admin")) return null;

  const slot = navWidth / destinations.length;
  const ready = navWidth > 0;
  const selected = activeIndex >= 0;
  const beadX = (position + 0.5) * slot;
  const toIndex = Math.max(0, activeIndex);
  const travel = toIndex - fromIndex;
  const progress =
    travel === 0 ? 1 : smooth(clamp((position - fromIndex) / travel));

  return (
    <div className={styles.dockRoot}>
      <nav
        ref={navRef}
        className={styles.dockBar}
        aria-label="Navegação principal"
      >
        <svg
          className={styles.dockPlate}
          style={{ opacity: ready ? 1 : 0 }}
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={platePath(navWidth, beadX, selected)}
            className={styles.dockSurface}
          />
        </svg>
        <span
          className={styles.goldBead}
          style={{
            opacity: ready && selected ? 1 : 0,
            transform: `translateX(${beadX}px)`,
          }}
          aria-hidden="true"
        >
          {destinations.map(({ href, Icon }, index) => {
            const opacity =
              index === toIndex
                ? progress
                : index === fromIndex
                  ? 1 - progress
                  : 0;
            return (
              <span
                key={href}
                className={styles.carriedIcon}
                style={{ opacity }}
              >
                <Icon size={22} strokeWidth={2} />
              </span>
            );
          })}
        </span>
        {destinations.map(({ label, href, Icon }, index) => {
          const active = index === activeIndex;
          // Icons step aside while the bead sits over them; only the
          // destination tab shows a label.
          const cover = ready
            ? smooth(clamp(1 - Math.abs(position - index) / 0.72))
            : 0;
          const iconOpacity = selected ? 1 - cover : 1;
          const labelOpacity = active ? progress : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-label={
                label === "Carrinho" && cartCount > 0
                  ? `Carrinho, ${cartCount} itens`
                  : label
              }
              aria-current={index === routeIndex ? "page" : undefined}
              className={styles.dockLink}
              onNavigate={() => setTap({ index, from: pathname })}
            >
              <span
                className={styles.dockIcon}
                style={{ opacity: iconOpacity }}
                aria-hidden="true"
              >
                <Icon size={21} strokeWidth={1.8} />
              </span>
              {label === "Carrinho" && cartCount > 0 && (
                <span className={styles.cartBadge} aria-hidden="true">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
              <span
                className={styles.dockLabel}
                style={{ opacity: labelOpacity }}
                aria-hidden="true"
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
