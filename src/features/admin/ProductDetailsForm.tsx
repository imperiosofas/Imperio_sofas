"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { saveProduct } from "./actions";
import styles from "./admin.module.css";

const ProductSubmissionContext = createContext<string | null>(null);

export function useProductSubmission() {
  return useContext(ProductSubmissionContext);
}

export function ProductDetailsForm({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingIntent) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    const formData = new FormData(event.currentTarget, submitter);
    setMessage("");
    setPendingIntent(submitter.value);
    try {
      const result = await saveProduct(formData);
      setMessage(result.message);
      requestAnimationFrame(() => alertRef.current?.focus());
    } catch {
      setMessage("Não foi possível concluir a operação. Tente novamente.");
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setPendingIntent(null);
    }
  }

  return (
    <ProductSubmissionContext.Provider value={pendingIntent}>
      <form
        id="dados-produto"
        onSubmit={handleSubmit}
        className={styles.editorForm}
      >
        {message && (
          <p className={styles.alert} role="alert" tabIndex={-1} ref={alertRef}>
            {message}
          </p>
        )}
        {children}
      </form>
    </ProductSubmissionContext.Provider>
  );
}
