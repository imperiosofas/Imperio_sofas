import Link from "next/link";
import { Package2, Star } from "lucide-react";
import styles from "./admin.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Administração">
        <Link href="/admin/produtos" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            I
          </span>
          <span>
            <strong>IMPÉRIO SOFÁS</strong>
            <small>OPERAÇÃO DA LOJA</small>
          </span>
        </Link>
        <p className={styles.navCaption}>CATÁLOGO</p>
        <Link href="/admin/produtos" className={styles.navLink}>
          <Package2 size={18} strokeWidth={1.8} />
          <span>Produtos</span>
        </Link>
        <Link href="/admin/avaliacoes" className={styles.navLink}>
          <Star size={18} strokeWidth={1.8} />
          <span>Avaliações</span>
        </Link>
        <div className={styles.sidebarFoot}>
          <span className={styles.secureDot} />
          Área administrativa protegida
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span>
            IMPÉRIO SOFÁS <i>/</i> ADMINISTRAÇÃO
          </span>
          <Link href="/" className={styles.storeLink}>
            Ver loja ↗
          </Link>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
