"use client";
import { useEffect, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "./actions";
import styles from "./commerce.module.css";

export function FavoriteButton({
  productId,
  initial,
  returnTo,
}: {
  productId: string;
  initial: boolean;
  returnTo: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className={styles.favoriteWrap}>
      <button
        type="button"
        className={`${styles.favorite} ${saved ? styles.favoriteOn : ""}`}
        aria-label={saved ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-pressed={saved}
        disabled={pending}
        onClick={() => {
          const next = !saved;
          // Optimistic: the heart reacts at once and rolls back on failure.
          setSaved(next);
          startTransition(async () => {
            const result = await toggleFavorite(productId, saved);
            if (result.requiresLogin) {
              setSaved(saved);
              router.push(`/conta?next=${encodeURIComponent(returnTo)}`);
              return;
            }
            if (result.ok) {
              setMessage(
                next ? "Salvo nos favoritos" : "Removido dos favoritos",
              );
            } else {
              setSaved(saved);
              setMessage(result.message);
            }
          });
        }}
      >
        <Heart
          size={21}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>
      {message && (
        <span className={styles.favoriteToast} role="status">
          {message}
        </span>
      )}
    </div>
  );
}
