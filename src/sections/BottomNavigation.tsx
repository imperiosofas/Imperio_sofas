"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";
import { House, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useRef } from "react";
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
    label: "Conta",
    href: "/conta",
    Icon: UserRound,
    isActive: (path: string) =>
      path.startsWith("/conta") || path.startsWith("/auth/"),
  },
] as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

// The concavity is the actual top edge, leaving the page visible through it.
function platePath(
  width: number,
  center: number,
  lift: number,
  selected: boolean,
) {
  const depth = 28 + lift;
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

type DockMotion = {
  position: MotionValue<number>;
  destination: MotionValue<number>;
  departure: MotionValue<number[]>;
};

function DockTab({
  index,
  active,
  travel,
  onNavigate,
}: {
  index: number;
  active: boolean;
  travel: DockMotion;
  onNavigate: () => void;
}) {
  const { label, href, Icon } = destinations[index];
  const proximity = useTransform(() => {
    const target = travel.destination.get();
    const current = travel.position.get();
    const departing = travel.departure.get()[index];
    // Passing over Loja on the way from Início to Conta must not select Loja.
    if (target < 0 || (target !== index && departing < 0.01)) return 0;
    return smooth(clamp(1 - Math.abs(current - index) / 0.72));
  });
  const iconOpacity = useTransform(proximity, (value) => 1 - value);
  const iconY = useTransform(proximity, (value) => -8 * value);
  const labelY = useTransform(proximity, (value) => 4 * (1 - value));

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={styles.dockLink}
      onNavigate={onNavigate}
    >
      <motion.span
        className={styles.dockIcon}
        style={{ opacity: iconOpacity, y: iconY }}
        aria-hidden="true"
      >
        <Icon size={21} strokeWidth={1.8} />
      </motion.span>
      <motion.span
        className={styles.dockLabel}
        style={{ opacity: proximity, y: labelY }}
        aria-hidden="true"
      >
        {label}
      </motion.span>
    </Link>
  );
}

function CarriedIcon({
  index,
  weights,
}: {
  index: number;
  weights: MotionValue<number[]>;
}) {
  const { Icon } = destinations[index];
  const opacity = useTransform(weights, (values) => values[index]);
  return (
    <motion.span className={styles.carriedIcon} style={{ opacity }}>
      <Icon size={22} strokeWidth={2} />
    </motion.span>
  );
}

export function BottomNavigation() {
  const pathname = usePathname();
  const activeIndex = destinations.findIndex(({ isActive }) =>
    isActive(pathname),
  );
  const reducedMotion = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);
  const movement = useRef<ReturnType<typeof animate> | null>(null);
  // Slot coordinates survive a resize without restarting the spring.
  const position = useMotionValue(Math.max(0, activeIndex));
  const destination = useMotionValue(activeIndex);
  const start = useMotionValue(Math.max(0, activeIndex));
  const departure = useMotionValue(
    destinations.map((_, index) => Number(index === activeIndex)),
  );
  const width = useMotionValue(0);
  const plateOpacity = useTransform(width, (value) => Number(value > 0));
  const beadX = useTransform(
    () => ((position.get() + 0.5) * width.get()) / destinations.length,
  );
  const velocity = useVelocity(position);
  const liftTarget = useTransform(velocity, (speed) =>
    reducedMotion ? 0 : -Math.min(4, Math.abs(speed) * 1.5),
  );
  const lift = useSpring(liftTarget, { stiffness: 420, damping: 35 });
  const beadY = useTransform(lift, (value) => (reducedMotion ? 0 : value));
  const weights = useTransform(() => {
    const target = destination.get();
    const current = position.get();
    const origin = start.get();
    const distance = target - origin;
    const progress =
      Math.abs(distance) < 0.001
        ? 1
        : smooth(clamp((current - origin) / distance));
    return departure
      .get()
      .map(
        (weight, index) =>
          weight * (1 - progress) + Number(index === target) * progress,
      );
  });
  const notchedPath = useTransform(() =>
    platePath(width.get(), beadX.get(), beadY.get(), destination.get() >= 0),
  );
  const beadOpacity = useTransform(() => {
    const measuredWidth = width.get();
    const target = destination.get();
    return Number(measuredWidth > 0 && target >= 0);
  });

  const moveTo = useCallback(
    (index: number) => {
      if (destination.get() === index && !reducedMotion) return;
      // Capture the current blend before redirecting an interrupted journey.
      const currentWeights = weights.get();
      movement.current?.stop();
      departure.set(currentWeights);
      start.set(position.get());
      destination.set(index);
      if (index < 0) return;
      if (reducedMotion) {
        position.jump(index);
        lift.jump(0);
        return;
      }
      movement.current = animate(position, index, {
        type: "spring",
        stiffness: 190,
        damping: 27,
        mass: 1,
        restDelta: 0.001,
        restSpeed: 0.01,
      });
    },
    [departure, destination, lift, position, reducedMotion, start, weights],
  );

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => width.set(nav.getBoundingClientRect().width);
    // Defer the first measurement until Motion's subscriptions are attached.
    // A synchronous layout-effect write can be missed during hydration.
    let frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [width]);

  // Pathname is authoritative on redirects and back/forward. A normal Link
  // navigation starts below, before its route has committed or loaded.
  useLayoutEffect(() => {
    moveTo(activeIndex);
  }, [pathname, activeIndex, moveTo]);
  useLayoutEffect(() => () => movement.current?.stop(), []);

  return (
    <div className={styles.dockRoot}>
      <nav
        ref={navRef}
        className={styles.dockBar}
        aria-label="Navegação principal"
      >
        <motion.svg
          className={styles.dockPlate}
          style={{ opacity: plateOpacity }}
          aria-hidden="true"
          focusable="false"
        >
          <motion.path d={notchedPath} className={styles.dockSurface} />
        </motion.svg>
        <motion.span
          className={styles.goldBead}
          style={{ x: beadX, y: beadY, opacity: beadOpacity }}
          aria-hidden="true"
        >
          {destinations.map(({ href }, index) => (
            <CarriedIcon key={href} index={index} weights={weights} />
          ))}
        </motion.span>
        {destinations.map(({ href }, index) => (
          <DockTab
            key={href}
            index={index}
            active={index === activeIndex}
            travel={{ position, destination, departure }}
            onNavigate={() => moveTo(index)}
          />
        ))}
      </nav>
    </div>
  );
}
