"use client";

import { CircleAlert } from "lucide-react";
import styles from "./analytics-ui.module.css";

export function AnalyticsRouteError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.routeError} role="alert">
      <CircleAlert size={22} aria-hidden="true" />
      <p className={styles.eyebrow}>NÃO FOI POSSÍVEL CARREGAR</p>
      <h1>Os dados não chegaram desta vez.</h1>
      <p>
        O painel não exibirá números parciais ou estimados. Tente atualizar o
        snapshot.
      </p>
      <button type="button" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
