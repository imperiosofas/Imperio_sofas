"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  MapPinned,
  PackageSearch,
  Settings2,
  Truck,
  Warehouse,
} from "lucide-react";
import styles from "./logistics.module.css";

const links = [
  { href: "/admin/entregas", label: "Visão geral", icon: Truck, exact: true },
  {
    href: "/admin/entregas/solicitacoes",
    label: "Solicitações",
    icon: ClipboardList,
  },
  {
    href: "/admin/entregas/areas",
    label: "Áreas atendidas",
    icon: MapPinned,
  },
  {
    href: "/admin/entregas/fornecedores",
    label: "Fornecedores",
    icon: Building2,
  },
  {
    href: "/admin/entregas/retiradas",
    label: "Locais de retirada",
    icon: Warehouse,
  },
  {
    href: "/admin/entregas/produtos",
    label: "Produtos",
    icon: PackageSearch,
  },
  {
    href: "/admin/entregas/configuracoes",
    label: "Configurações",
    icon: Settings2,
  },
] as const;

export function LogisticsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.subnav} aria-label="Seções de entregas">
      {links.map((link) => {
        const { href, icon: Icon, label } = link;
        const active =
          href === "/admin/entregas"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            className={styles.subnavLink}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
