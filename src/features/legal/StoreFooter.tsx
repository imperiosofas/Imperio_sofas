import { COMPANY } from "./content";
import { LegalLinks } from "./LegalLinks";
import styles from "./legal.module.css";

export function StoreFooter() {
  return (
    <footer className={styles.storeFooter}>
      <div className={styles.storeFooterInner}>
        <p className={styles.storeFooterName}>
          {COMPANY.tradeName} · {COMPANY.legalName}
        </p>
        <p>
          CNPJ {COMPANY.cnpj} · {COMPANY.address}
        </p>
        <p>
          {COMPANY.phone} ·{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
        <LegalLinks />
      </div>
    </footer>
  );
}
