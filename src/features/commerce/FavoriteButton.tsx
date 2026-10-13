"use client";
import { useState, useTransition } from "react";
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
  return (
    <div className={styles.favoriteWrap}>
      <button
        type="button"
        className={styles.favorite}
        aria-label={saved ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-pressed={saved}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleFavorite(productId, saved);
            if (result.requiresLogin) {
              router.push(`/conta?next=${encodeURIComponent(returnTo)}`);
              return;
            }
            if (result.ok) setSaved(!saved);
            else setMessage(result.message);
          })
        }
      >
        <Heart
          size={21}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>
      <span className="sr-only" role="status">
        {message}
      </span>
    </div>
  );
}
