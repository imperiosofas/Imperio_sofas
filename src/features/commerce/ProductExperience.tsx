"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Star } from "lucide-react";
import type { ProductDetail, ProductReview, ReviewSummary } from "./data";
import { saveReview, removeReview, addCartItem } from "./actions";
import { FavoriteButton } from "./FavoriteButton";
import { formatBrlFromCents } from "../../lib/money";
import type { PublicProductLogistics } from "../logistics/types";
import styles from "./commerce.module.css";

const meters = (mm: number) => `${(mm / 1000).toFixed(2).replace(".", ",")} m`;

export function ProductExperience({
  product,
  reviews,
  summary,
  favorite,
  signedIn,
  ownReviewId,
  logistics,
}: {
  product: ProductDetail;
  reviews: ProductReview[];
  summary?: ReviewSummary;
  favorite: boolean;
  signedIn: boolean;
  ownReviewId: string | null;
  logistics: PublicProductLogistics | null;
}) {
  const [selected, setSelected] = useState(product.variants[0].id);
  const [photo, setPhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const router = useRouter();
  const variant = product.variants.find((item) => item.id === selected)!;
  const images = product.images.filter(
    (item) => item.variantId === null || item.variantId === selected,
  );
  const image = images[Math.min(photo, images.length - 1)];
  const returnTo = `/produto/${product.slug}`;
  return (
    <main className={styles.productPage}>
      <div className={styles.productShell}>
        <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
          <Link href="/loja">
            <ArrowLeft size={16} /> Loja
          </Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>
        <div className={styles.productTop}>
          <section className={styles.gallery} aria-label="Fotos do produto">
            <div className={styles.heroImage}>
              {image ? (
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  unoptimized
                  priority
                  sizes="(max-width: 900px) 100vw, 60vw"
                />
              ) : (
                <span>Império Sofás</span>
              )}
              {images.length > 1 && (
                <div className={styles.galleryArrows}>
                  <button
                    type="button"
                    onClick={() =>
                      setPhoto((photo + images.length - 1) % images.length)
                    }
                    aria-label="Foto anterior"
                  >
                    <ArrowLeft />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoto((photo + 1) % images.length)}
                    aria-label="Próxima foto"
                  >
                    <ArrowRight />
                  </button>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className={styles.thumbnails}>
                {images.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.src}-${index}`}
                    onClick={() => setPhoto(index)}
                    aria-label={`Ver foto ${index + 1}`}
                    aria-current={photo === index ? "true" : undefined}
                  >
                    <Image
                      src={item.src}
                      alt=""
                      fill
                      unoptimized
                      sizes="84px"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section
            className={styles.purchase}
            aria-label="Informações para compra"
          >
            <div className={styles.titleRow}>
              <div>
                <p className={styles.eyebrow}>Império Sofás</p>
                <h1>{product.name}</h1>
              </div>
              <FavoriteButton
                productId={product.id}
                initial={favorite}
                returnTo={returnTo}
              />
            </div>
            {summary && summary.review_count > 0 ? (
              <a className={styles.ratingLink} href="#avaliacoes">
                <Star size={17} fill="currentColor" />{" "}
                {summary.average_rating.toFixed(1).replace(".", ",")}{" "}
                <span>({summary.review_count} avaliações)</span>
              </a>
            ) : (
              <a className={styles.ratingLink} href="#avaliacoes">
                Seja o primeiro a avaliar
              </a>
            )}
            {product.description.trim() && (
              <p className={styles.descriptionLead}>{product.description}</p>
            )}
            <section className={styles.logisticsInfo} aria-label="Logística">
              <p className={styles.logisticsEyebrow}>ENTREGA E RETIRADA</p>
              {!logistics ? (
                <p>
                  Não foi possível consultar as opções logísticas deste produto
                  agora.
                </p>
              ) : !logistics.supplierAssigned ||
                !logistics.supplierCode ||
                !logistics.supplierActive ? (
                <p>
                  As opções de entrega e retirada ainda não estão disponíveis
                  para este produto.
                </p>
              ) : (
                <>
                  <strong>
                    {logistics.supplierName ?? logistics.supplierCode}
                  </strong>
                  <p>
                    {logistics.fulfillmentModes.includes("delivery")
                      ? "Entrega disponível mediante cotação do frete."
                      : "Entrega não disponível para este produto."}
                    {logistics.fulfillmentModes.includes("pickup")
                      ? " Você também pode retirar em um dos locais informados."
                      : ""}
                  </p>
                  {logistics.minBusinessDays !== null &&
                  logistics.maxBusinessDays !== null ? (
                    <p>
                      Prazo estimado:{" "}
                      {logistics.minBusinessDays === logistics.maxBusinessDays
                        ? logistics.minBusinessDays
                        : `${logistics.minBusinessDays} a ${logistics.maxBusinessDays}`}{" "}
                      dias úteis após a confirmação do pagamento.
                    </p>
                  ) : null}
                  {logistics.deliveryQuoteRequired ? (
                    <p>
                      O valor da entrega é confirmado após análise do CEP e do
                      endereço.
                    </p>
                  ) : null}
                  {logistics.pickupLocations.length ? (
                    <ul>
                      {logistics.pickupLocations.map((location) => (
                        <li key={location.id}>
                          {location.displayName}: {location.street},{" "}
                          {location.streetNumber}, {location.neighborhood},{" "}
                          {location.cityName}/{location.stateCode}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <small>
                    O adicional por andar é calculado uma vez por endereço,
                    quando aplicável. A cotação não cria pedido nem pagamento.
                  </small>
                </>
              )}
            </section>
            <div className={styles.rule} />
            {product.variants.length > 1 && (
              <fieldset className={styles.variantSet}>
                <legend>Escolha uma opção</legend>
                <div className={styles.variantOptions}>
                  {product.variants.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={selected === item.id}
                      onClick={() => {
                        setSelected(item.id);
                        setPhoto(0);
                        setQuantity(1);
                        setNotice("");
                      }}
                    >
                      {item.width_mm && <span>{meters(item.width_mm)}</span>}
                      {item.fabric && <small>{item.fabric}</small>}
                      {item.color && <small>{item.color}</small>}
                      <small>
                        {item.stock_status === "unavailable"
                          ? "Indisponível"
                          : item.stock_status === "low_stock"
                            ? "Estoque baixo"
                            : "Disponível"}
                      </small>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <p className={styles.availability}>
              {variant.stock_status === "available" && <Check size={16} />}
              {variant.stock_status === "unavailable"
                ? "Indisponível"
                : variant.stock_status === "low_stock"
                  ? "Estoque baixo"
                  : "Disponível"}
            </p>
            <p className={styles.priceLabel}>
              {product.variants.length > 1 &&
              new Set(product.variants.map((item) => item.price_cents)).size > 1
                ? "Preço da medida selecionada"
                : "Preço"}
            </p>
            <p className={styles.productPrice}>
              {formatBrlFromCents(variant.price_cents)}
            </p>
            <div className={styles.buyRow}>
              <div className={styles.quantity} aria-label="Quantidade">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Diminuir quantidade"
                  disabled={quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <output>{quantity}</output>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(99, quantity + 1))}
                  aria-label="Aumentar quantidade"
                  disabled={quantity >= 99}
                >
                  <Plus size={18} />
                </button>
              </div>
              <button
                type="button"
                className={styles.addButton}
                disabled={pending || variant.stock_status === "unavailable"}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addCartItem(selected, quantity);
                    if (result.requiresLogin) {
                      router.push(
                        `/conta?next=${encodeURIComponent(returnTo)}`,
                      );
                      return;
                    }
                    setNotice(result.message);
                    if (result.ok) {
                      window.dispatchEvent(new Event("cart:changed"));
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Adicionando..." : "Adicionar ao carrinho"}
                <ArrowRight size={18} />
              </button>
            </div>
            <div className={styles.notice} role="status">
              {notice}
              {notice === "Adicionado ao carrinho." && (
                <>
                  {" "}
                  <Link href="/carrinho">Ver carrinho</Link>
                </>
              )}
            </div>
          </section>
        </div>
        <section
          className={styles.productDetails}
          aria-label="Detalhes do produto"
        >
          {product.description.trim() && (
            <details open>
              <summary>Descrição</summary>
              <p>{product.description}</p>
            </details>
          )}
          {(variant.width_mm || variant.depth_mm || variant.height_mm) && (
            <details>
              <summary>Dimensões</summary>
              <dl>
                {variant.width_mm && (
                  <div>
                    <dt>Largura</dt>
                    <dd>{meters(variant.width_mm)}</dd>
                  </div>
                )}
                {variant.depth_mm && (
                  <div>
                    <dt>Profundidade</dt>
                    <dd>{meters(variant.depth_mm)}</dd>
                  </div>
                )}
                {variant.height_mm && (
                  <div>
                    <dt>Altura</dt>
                    <dd>{meters(variant.height_mm)}</dd>
                  </div>
                )}
              </dl>
            </details>
          )}
          {(variant.fabric || variant.color) && (
            <details>
              <summary>Materiais e acabamentos</summary>
              <p>
                {[variant.fabric, variant.color].filter(Boolean).join(" · ")}
              </p>
            </details>
          )}
        </section>
        <section
          id="avaliacoes"
          className={styles.reviews}
          aria-labelledby="review-title"
        >
          <div className={styles.reviewHead}>
            <div>
              <p className={styles.eyebrow}>Opiniões de clientes</p>
              <h2 id="review-title">Avaliações</h2>
            </div>
            {summary && summary.review_count > 0 && (
              <p>
                <Star fill="currentColor" size={22} />{" "}
                {summary.average_rating.toFixed(1).replace(".", ",")}{" "}
                <span>· {summary.review_count} avaliações</span>
              </p>
            )}
          </div>
          {signedIn ? (
            <form
              className={styles.reviewForm}
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await saveReview(product.id, rating, comment);
                  setReviewNotice(result.message);
                  if (result.ok) {
                    setComment("");
                    router.refresh();
                  }
                });
              }}
            >
              <h3>Sua avaliação</h3>
              <fieldset>
                <legend>Nota</legend>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        required
                      />
                      <Star
                        size={25}
                        fill={value <= rating ? "currentColor" : "none"}
                      />
                      <span className="sr-only">
                        {value} {value === 1 ? "estrela" : "estrelas"}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={styles.commentLabel}>
                Comentário (opcional)
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <button type="submit" disabled={pending || rating === 0}>
                Publicar avaliação
              </button>
              <span role="status">{reviewNotice}</span>
            </form>
          ) : (
            <Link
              className={styles.reviewLogin}
              href={`/conta?next=${encodeURIComponent(returnTo)}`}
            >
              Entre para avaliar este produto <ArrowRight size={16} />
            </Link>
          )}
          <div className={styles.reviewList}>
            {ownReviewId &&
              !reviews.some((item) => item.id === ownReviewId) && (
                <article>
                  <p>Sua avaliação está oculta.</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await removeReview(product.id);
                        setReviewNotice(result.message);
                        router.refresh();
                      })
                    }
                  >
                    Remover meus dados da avaliação
                  </button>
                </article>
              )}
            {reviews.length ? (
              reviews.map((item) => (
                <article key={item.id}>
                  <div className={styles.reviewMeta}>
                    <strong>{item.display_name}</strong>
                    <span>
                      {"★".repeat(item.rating)}
                      {"☆".repeat(5 - item.rating)}
                    </span>
                    <time dateTime={item.created_at}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(item.created_at))}
                    </time>
                  </div>
                  {item.comment && <p>{item.comment}</p>}
                  {ownReviewId === item.id && (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeReview(product.id);
                          setReviewNotice(result.message);
                          router.refresh();
                        })
                      }
                    >
                      Remover avaliação
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>Ainda não há avaliações deste produto.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
