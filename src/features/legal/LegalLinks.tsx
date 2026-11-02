import Link from "next/link";
import styles from "./legal.module.css";

export function LegalLinks() {
  return (
    <p className={styles.inline}>
      <Link href="/termos">Termos de compra</Link>
      <Link href="/trocas-e-devolucoes">Trocas e devoluções</Link>
      <Link href="/privacidade">Privacidade</Link>
    </p>
  );
}
