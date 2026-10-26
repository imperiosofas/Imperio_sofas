"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "./logistics.module.css";

type ActionResult = { ok: true } | { ok: false; message: string };
type LogisticsAction = (input: unknown) => Promise<ActionResult>;

export function LogisticsActionForm({
  action,
  booleanFields = [],
  className,
  id,
  successMessage,
  children,
}: {
  action: LogisticsAction;
  booleanFields?: string[];
  className?: string;
  id?: string;
  successMessage: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    for (const name of booleanFields) {
      const field = form.elements.namedItem(name);
      const value =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? field.checked
          : payload.get(name) === "true";
      payload.set(name, String(value));
    }
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action(payload);
        if (!result.ok) {
          setIsError(true);
          setMessage(result.message);
          return;
        }
        setIsError(false);
        setMessage(successMessage);
        router.refresh();
      } catch {
        setIsError(true);
        setMessage(
          "Não foi possível concluir a ação. Atualize a tela e tente novamente.",
        );
      }
    });
  }

  return (
    <form aria-busy={pending} className={className} id={id} onSubmit={submit}>
      {children}
      {message ? (
        <p
          className={isError ? styles.feedbackError : styles.feedbackSuccess}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <span className={styles.srOnly} aria-live="polite">
        {pending ? "Salvando…" : ""}
      </span>
    </form>
  );
}
