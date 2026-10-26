"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  ImageMinus,
  LayoutDashboard,
  Menu,
  MousePointerClick,
  Package2,
  ShieldCheck,
  Star,
  Truck,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import styles from "./admin-shell.module.css";

type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

type AdminNavGroup = {
  label: string;
  items: readonly AdminNavItem[];
};

function isRouteOrDescendant(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const adminNavGroups: readonly AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        label: "Painel",
        href: "/admin",
        icon: LayoutDashboard,
        isActive: (pathname) => pathname === "/admin",
      },
    ],
  },
  {
    label: "Análises",
    items: [
      {
        label: "Visão geral",
        href: "/admin/analytics",
        icon: BarChart3,
        isActive: (pathname) => pathname === "/admin/analytics",
      },
      {
        label: "Produtos",
        href: "/admin/analytics/produtos",
        icon: Package2,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/analytics/produtos"),
      },
      {
        label: "Estoque",
        href: "/admin/analytics/estoque",
        icon: Warehouse,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/analytics/estoque"),
      },
      {
        label: "Comportamento",
        href: "/admin/analytics/comportamento",
        icon: MousePointerClick,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/analytics/comportamento"),
      },
      {
        label: "Relatórios",
        href: "/admin/relatorios",
        icon: FileSpreadsheet,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/relatorios"),
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        label: "Produtos",
        href: "/admin/produtos",
        icon: Package2,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/produtos") &&
          !isRouteOrDescendant(pathname, "/admin/produtos/limpeza-storage"),
      },
      {
        label: "Avaliações",
        href: "/admin/avaliacoes",
        icon: Star,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/avaliacoes"),
      },
    ],
  },
  {
    label: "Entregas",
    items: [
      {
        label: "Operação logística",
        href: "/admin/entregas",
        icon: Truck,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/entregas"),
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Limpeza de imagens",
        href: "/admin/produtos/limpeza-storage",
        icon: ImageMinus,
        isActive: (pathname) =>
          isRouteOrDescendant(pathname, "/admin/produtos/limpeza-storage"),
      },
    ],
  },
];

function getRouteContext(pathname: string) {
  if (pathname === "/admin") return { group: "Visão geral", title: "Painel" };
  if (pathname === "/admin/analytics")
    return { group: "Análises", title: "Visão geral" };
  if (isRouteOrDescendant(pathname, "/admin/analytics/produtos"))
    return { group: "Análises", title: "Produtos" };
  if (isRouteOrDescendant(pathname, "/admin/analytics/estoque"))
    return { group: "Análises", title: "Estoque" };
  if (isRouteOrDescendant(pathname, "/admin/analytics/comportamento"))
    return { group: "Análises", title: "Comportamento" };
  if (isRouteOrDescendant(pathname, "/admin/relatorios"))
    return { group: "Análises", title: "Relatórios" };
  if (isRouteOrDescendant(pathname, "/admin/produtos/limpeza-storage"))
    return { group: "Sistema", title: "Limpeza de imagens" };
  if (pathname === "/admin/produtos/novo")
    return { group: "Gestão", title: "Novo produto" };
  if (isRouteOrDescendant(pathname, "/admin/produtos"))
    return { group: "Gestão", title: "Editar produto" };
  if (isRouteOrDescendant(pathname, "/admin/avaliacoes"))
    return { group: "Gestão", title: "Avaliações" };
  if (isRouteOrDescendant(pathname, "/admin/entregas"))
    return { group: "Entregas", title: "Entregas" };
  return { group: "Gestão", title: "Produtos" };
}

function NavigationSections({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={styles.navigation} aria-label="Navegação administrativa">
      {adminNavGroups.map((group) => (
        <section className={styles.navGroup} key={group.label}>
          <h2 className={styles.groupLabel}>{group.label}</h2>
          <ul className={styles.navList}>
            {group.items.map(({ href, icon: Icon, isActive, label }) => {
              const active = isActive(pathname);
              return (
                <li key={href}>
                  <Link
                    className={styles.navLink}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon
                      className={styles.navIcon}
                      size={17}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const previousPathname = useRef(pathname);
  const routeContext = getRouteContext(pathname);

  const closeDrawer = useCallback((restoreFocus: boolean) => {
    setIsDrawerOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      setIsDrawerOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      drawerRef.current
        ?.querySelector<HTMLElement>("[data-drawer-close]")
        ?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isDrawerOpen]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer(true);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <aside className={styles.sidebar} aria-label="Área administrativa">
        <Link className={styles.brand} href="/admin/produtos">
          <Image
            className={styles.brandLogo}
            src="/imperio-sofas-logo-128.webp"
            alt=""
            width={44}
            height={44}
            priority
          />
          <span className={styles.brandCopy}>
            <strong>Império Sofás</strong>
            <small>Painel administrativo</small>
          </span>
        </Link>

        <NavigationSections pathname={pathname} />

        <div className={styles.sidebarFoot}>
          <ShieldCheck size={15} strokeWidth={1.7} aria-hidden="true" />
          <span>Área restrita à administração</span>
        </div>
      </aside>

      <header className={styles.topbar}>
        <div className={styles.desktopTrail}>
          <span className={styles.topbarEyebrow}>Administração</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span className={styles.currentGroup}>{routeContext.group}</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span className={styles.currentRoute} aria-current="page">
            {routeContext.title}
          </span>
        </div>

        <div className={styles.mobileIdentity}>
          <Link className={styles.mobileBrand} href="/admin/produtos">
            <Image
              className={styles.mobileBrandLogo}
              src="/imperio-sofas-logo-128.webp"
              alt=""
              width={38}
              height={38}
            />
            <span>
              <strong>Império Sofás</strong>
              <small>Administração</small>
            </span>
          </Link>
        </div>

        <button
          aria-controls="admin-mobile-drawer"
          aria-expanded={isDrawerOpen}
          aria-label={
            isDrawerOpen
              ? "Menu administrativo aberto"
              : "Abrir menu administrativo"
          }
          className={styles.menuButton}
          onClick={() => setIsDrawerOpen(true)}
          ref={menuButtonRef}
          type="button"
        >
          <Menu size={21} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className={styles.mobileTrail} aria-live="polite">
          <span>{routeContext.group}</span>
          <ChevronRight size={13} aria-hidden="true" />
          <strong>{routeContext.title}</strong>
        </div>

        <Link className={styles.storeLink} href="/">
          <span>Ver loja</span>
          <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </header>

      <div className={styles.drawerLayer} hidden={!isDrawerOpen}>
        <button
          aria-label="Fechar menu administrativo"
          aria-hidden="true"
          className={styles.drawerBackdrop}
          onClick={() => closeDrawer(true)}
          tabIndex={-1}
          type="button"
        />
        <aside
          aria-label="Menu administrativo"
          aria-modal="true"
          className={styles.drawer}
          id="admin-mobile-drawer"
          onKeyDown={handleDrawerKeyDown}
          ref={drawerRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className={styles.drawerHeader}>
            <Link
              className={styles.brand}
              href="/admin/produtos"
              onClick={() => closeDrawer(false)}
            >
              <Image
                className={styles.brandLogo}
                src="/imperio-sofas-logo-128.webp"
                alt=""
                width={42}
                height={42}
              />
              <span className={styles.brandCopy}>
                <strong id="admin-drawer-title">Império Sofás</strong>
                <small>Painel administrativo</small>
              </span>
            </Link>
            <button
              aria-label="Fechar menu administrativo"
              className={styles.closeButton}
              data-drawer-close
              onClick={() => closeDrawer(true)}
              type="button"
            >
              <X size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>

          <NavigationSections
            pathname={pathname}
            onNavigate={() => closeDrawer(false)}
          />

          <Link
            className={styles.drawerStoreLink}
            href="/"
            onClick={() => closeDrawer(false)}
          >
            <span>Voltar à loja</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </>
  );
}
