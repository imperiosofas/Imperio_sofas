import Link from "next/link";
import {
  ArrowRight,
  Heart,
  KeyRound,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import styles from "./account.module.css";

const links = [
  {
    href: "/conta/perfil",
    label: "Dados pessoais",
    icon: UserRound,
    key: "profile",
  },
  {
    href: "/conta/seguranca",
    label: "E-mail e senha",
    icon: KeyRound,
    key: "security",
  },
  {
    href: "/conta/favoritos",
    label: "Favoritos",
    icon: Heart,
    key: "favorites",
  },
  { href: "/carrinho", label: "Meu carrinho", icon: ShoppingBag, key: "cart" },
  {
    href: "/conta/entregas",
    label: "Minhas entregas",
    icon: Truck,
    key: "deliveries",
  },
];

export function AccountShell({
  email,
  displayName,
  isAdmin,
  cartCount,
  active,
  showAccountMenu = false,
  children,
}: {
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  cartCount: number | null;
  active: string;
  showAccountMenu?: boolean;
  children: React.ReactNode;
}) {
  const firstName = displayName?.split(" ")[0];
  const initials =
    displayName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IS";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.heading}>
          <div className={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <div className={styles.headingCopy}>
            <span className={styles.overline}>MINHA CONTA</span>
            <h1>
              {firstName ? `Olá, ${firstName}` : "Sua conta, do seu jeito."}
            </h1>
            <p>{email}</p>
          </div>
          <SignOutButton className={styles.signOut} />
        </header>

        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Navegação da conta">
            <nav>
              {links.map(({ href, label, icon: Icon, key }) => (
                <Link
                  key={key}
                  className={
                    active === key ? styles.activeLink : styles.navLink
                  }
                  href={href}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                  {key === "cart" && cartCount !== null && cartCount > 0 ? (
                    <span className={styles.count}>{cartCount}</span>
                  ) : null}
                  <ArrowRight className={styles.navArrow} size={15} />
                </Link>
              ))}
              {isAdmin ? (
                <Link className={styles.navLink} href="/admin">
                  <LayoutDashboard size={18} strokeWidth={1.8} />
                  <span>Painel administrativo</span>
                  <ArrowRight className={styles.navArrow} size={15} />
                </Link>
              ) : null}
            </nav>
            <div className={styles.sidebarFoot}>
              <Package size={17} />
              <span>Seus pedidos aparecerão aqui após uma compra.</span>
            </div>
          </aside>

          <section className={styles.content}>
            {showAccountMenu ? (
              <div className={styles.mobileMenu}>
                <span className={styles.overline}>GERENCIE SUA CONTA</span>
                {links.map(({ href, label, icon: Icon, key }) => (
                  <Link key={key} className={styles.menuRow} href={href}>
                    <span className={styles.menuIcon}>
                      <Icon size={19} />
                    </span>
                    <span>
                      {label}
                      {key === "cart" && cartCount !== null && cartCount > 0 ? (
                        <small>
                          {cartCount} {cartCount === 1 ? "item" : "itens"}
                        </small>
                      ) : null}
                    </span>
                    <ArrowRight size={17} />
                  </Link>
                ))}
                {isAdmin ? (
                  <Link className={styles.menuRow} href="/admin">
                    <span className={styles.menuIcon}>
                      <LayoutDashboard size={19} />
                    </span>
                    <span>Painel administrativo</span>
                    <ArrowRight size={17} />
                  </Link>
                ) : null}
                <Link className={styles.shopLink} href="/loja">
                  Continuar explorando a loja <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className={styles.mobileBack}>
                <Link href="/conta">← Minha conta</Link>
              </div>
            )}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
