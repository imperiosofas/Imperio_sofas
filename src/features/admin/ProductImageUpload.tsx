"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { uploadProductImage } from "./actions";
import styles from "./admin.module.css";

export function ProductImageUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("image");
    if (!(file instanceof File) || file.size === 0) {
      setError(true);
      setMessage("Escolha uma imagem antes de enviar.");
      return;
    }
    setPending(true);
    setError(false);
    setMessage("Preparando e enviando imagem…");
    try {
      const result = await uploadProductImage(new FormData(form));
      setError(!result.ok);
      setMessage(result.message);
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setError(true);
      setMessage("O envio foi interrompido. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={styles.uploadForm}>
      <input type="hidden" name="productId" value={productId} />
      <label className={styles.field}>
        <span>Arquivo (JPG, PNG ou WebP · até 10 MB)</span>
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Texto alternativo da imagem</span>
        <input
          name="altText"
          required
          maxLength={300}
          placeholder="Sofá cinza de três lugares visto de frente"
        />
      </label>
      <button
        className={styles.secondaryButton}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        <ImagePlus size={16} /> {pending ? "Enviando imagem…" : "Enviar imagem"}
      </button>
      {message && (
        <p
          className={error ? styles.alert : styles.success}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
