"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Star } from "lucide-react";
import type { MyReview, ProductReview, ReviewSummary } from "./data";
import { removeReview, saveReview } from "./actions";
import styles from "./reviews.module.css";

const RATING_LABELS = ["Ruim", "Regular", "Bom", "Muito bom", "Excelente"];
const PAGE_SIZE = 5;
const COMMENT_LIMIT = 2000;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span
      className={styles.starRow}
      role="img"
      aria-label={`Nota ${value.toFixed(1).replace(".", ",")} de 5`}
    >
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          size={size}
          aria-hidden="true"
          fill={position <= filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function ReviewsSection({
  productId,
  signedIn,
  returnTo,
  reviews,
  summary,
  own,
}: {
  productId: string;
  signedIn: boolean;
  returnTo: string;
  reviews: ProductReview[];
  summary?: ReviewSummary;
  own: MyReview | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(own?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(own?.comment ?? "");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const count = summary?.review_count ?? 0;
  const average = summary?.average_rating ?? 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    total: reviews.filter((item) => item.rating === stars).length,
  }));
  const listed = Math.max(reviews.length, 1);
  const ownIsListed = !!own && reviews.some((item) => item.id === own.id);
  const shownRating = hover || rating;

  function submit() {
    startTransition(async () => {
      const result = await saveReview(productId, rating, comment);
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeReview(productId);
      setNotice({ ok: result.ok, text: result.message });
      setConfirmingRemoval(false);
      if (result.ok) {
        setRating(0);
        setComment("");
        router.refresh();
      }
    });
  }

  function edit() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    commentRef.current?.focus({ preventScroll: true });
  }

  return (
    <section
      id="avaliacoes"
      className={styles.reviews}
      aria-labelledby="review-title"
    >
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Opiniões de clientes</p>
          <h2 id="review-title">Avaliações</h2>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.summary}>
          {count > 0 ? (
            <>
              <div className={styles.average}>
                <strong>{average.toFixed(1).replace(".", ",")}</strong>
                <div>
                  <Stars value={average} size={20} />
                  <span>
                    {count} {count === 1 ? "avaliação" : "avaliações"}
                  </span>
                </div>
              </div>
              <ul className={styles.distribution} aria-label="Notas recebidas">
                {distribution.map(({ stars, total }) => (
                  <li key={stars}>
                    <span>{stars}</span>
                    <Star size={13} fill="currentColor" aria-hidden="true" />
                    <span className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${(total / listed) * 100}%` }} />
                    </span>
                    <span className={styles.barCount}>
                      {total}
                      <span className="sr-only">
                        {" "}
                        {total === 1 ? "avaliação" : "avaliações"} com {stars}{" "}
                        {stars === 1 ? "estrela" : "estrelas"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.empty}>
              Este produto ainda não tem avaliações. Quem comprar ou conhecer o
              modelo pode ser o primeiro a contar como foi.
            </p>
          )}
        </div>

        <div className={styles.formArea}>
          {signedIn ? (
            <form
              ref={formRef}
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <h3>{own ? "Sua avaliação" : "Avalie este produto"}</h3>
              <fieldset>
                <legend>Sua nota</legend>
                <div className={styles.rate} onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label
                      key={value}
                      onMouseEnter={() => setHover(value)}
                      className={value <= shownRating ? styles.on : undefined}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        required
                      />
                      <Star
                        size={28}
                        aria-hidden="true"
                        fill={value <= shownRating ? "currentColor" : "none"}
                      />
                      <span className="sr-only">
                        {value} {value === 1 ? "estrela" : "estrelas"}:{" "}
                        {RATING_LABELS[value - 1]}
                      </span>
                    </label>
                  ))}
                  <span className={styles.rateLabel} aria-hidden="true">
                    {shownRating ? RATING_LABELS[shownRating - 1] : ""}
                  </span>
                </div>
              </fieldset>
              <label className={styles.commentLabel}>
                Comentário (opcional)
                <textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={COMMENT_LIMIT}
                  rows={4}
                  placeholder="Conte como é o conforto, o acabamento e a entrega."
                />
                <span className={styles.counter}>
                  {comment.length}/{COMMENT_LIMIT}
                </span>
              </label>
              <div className={styles.actions}>
                <button type="submit" disabled={pending || rating === 0}>
                  {pending
                    ? "Salvando..."
                    : own
                      ? "Atualizar avaliação"
                      : "Publicar avaliação"}
                </button>
                {own &&
                  (confirmingRemoval ? (
                    <span className={styles.confirm}>
                      Remover sua avaliação?
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={pending}
                        onClick={remove}
                      >
                        Sim, remover
                      </button>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => setConfirmingRemoval(false)}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => setConfirmingRemoval(true)}
                    >
                      Remover minha avaliação
                    </button>
                  ))}
              </div>
              <p
                role="status"
                className={notice?.ok ? styles.ok : styles.error}
                aria-live="polite"
              >
                {notice?.text ?? ""}
              </p>
            </form>
          ) : (
            <div className={styles.login}>
              <h3>Já conhece este modelo?</h3>
              <p>Entre na sua conta para deixar a sua nota e um comentário.</p>
              <Link href={`/conta?next=${encodeURIComponent(returnTo)}`}>
                Entrar para avaliar <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {own && own.status === "hidden" && !ownIsListed && (
        <p className={styles.hiddenNote}>
          Sua avaliação foi ocultada pela moderação e não aparece na loja. Você
          pode editá-la ou removê-la acima.
        </p>
      )}

      {reviews.length > 0 && (
        <>
          <ul className={styles.list}>
            {reviews.slice(0, visible).map((item) => (
              <li key={item.id}>
                <div className={styles.meta}>
                  <Stars value={item.rating} />
                  <strong>{item.display_name}</strong>
                  {own?.id === item.id && (
                    <span className={styles.badge}>Sua avaliação</span>
                  )}
                  <time dateTime={item.created_at}>
                    {formatDate(item.created_at)}
                  </time>
                </div>
                {item.comment && <p>{item.comment}</p>}
                {own?.id === item.id && (
                  <button type="button" className={styles.link} onClick={edit}>
                    Editar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {reviews.length > visible && (
            <button
              type="button"
              className={styles.more}
              onClick={() => setVisible((current) => current + PAGE_SIZE)}
            >
              Mostrar mais avaliações ({reviews.length - visible})
            </button>
          )}
        </>
      )}
    </section>
  );
}
