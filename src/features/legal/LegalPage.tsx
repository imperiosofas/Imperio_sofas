import Link from "next/link";
import { legalDocuments, type LegalDocument } from "./content";
import styles from "./legal.module.css";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <main className={styles.page}>
      <article className={styles.shell}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Império Sofás</p>
          <h1>{document.title}</h1>
          <p className={styles.meta}>
            Última atualização: {document.updatedAt}
          </p>
        </header>
        {document.sections.map((section, index) => (
          <section
            key={`${index}-${section.title}`}
            className={section.title ? styles.section : styles.continued}
          >
            {section.title && <h2>{section.title}</h2>}
            {section.paragraphs?.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {section.bullets && (
              <ul>
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <nav className={styles.nav} aria-label="Documentos legais">
          {legalDocuments
            .filter((item) => item.slug !== document.slug)
            .map((item) => (
              <Link key={item.slug} href={`/${item.slug}`}>
                {item.title}
              </Link>
            ))}
          <Link href="/loja">Voltar à loja</Link>
        </nav>
      </article>
    </main>
  );
}
