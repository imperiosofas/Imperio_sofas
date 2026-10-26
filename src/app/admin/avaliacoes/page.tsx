import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Heart, Star } from "lucide-react";
import { z } from "zod";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";
import styles from "./engagement.module.css";

export const dynamic = "force-dynamic";

const summarySchema = z.object({
  reviews: z.object({
    total: z.number(),
    published: z.number(),
    hidden: z.number(),
    last_7_days: z.number(),
    average_rating: z.number(),
  }),
  favorites: z.object({
    total: z.number(),
    customers: z.number(),
    products: z.number(),
    last_7_days: z.number(),
  }),
  top_favorited: z.array(
    z.object({
      product_id: z.string(),
      name: z.string(),
      slug: z.string(),
      status: z.string(),
      favorites: z.number(),
      review_count: z.number(),
      average_rating: z.number().nullable(),
    }),
  ),
});

const reviewRowSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_slug: z.string(),
  product_status: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  status: z.enum(["published", "hidden"]),
  created_at: z.string(),
  display_name: z.string(),
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  customer_phone: z.string().nullable(),
});

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "published", label: "Publicadas" },
  { value: "hidden", label: "Ocultas" },
] as const;

async function moderate(formData: FormData) {
  "use server";
  const client = await requireCatalogAdmin("/admin/avaliacoes");
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !status ||
    !["published", "hidden"].includes(status)
  )
    return;
  const { error } = await client.rpc("moderate_product_review", {
    p_review_id: id,
    p_status: status,
  });
  if (error) throw new Error("Não foi possível moderar a avaliação.");
  revalidatePath("/admin/avaliacoes");
  revalidatePath("/loja");
}

function ratingText(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          size={16}
          aria-hidden="true"
          fill={position <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      <p className={styles.tileNote}>{note}</p>
    </div>
  );
}

function whatsappLink(phone: string, product: string, customer: string) {
  const digits = phone.replace(/\D/g, "");
  const text = `Olá, ${customer}! Aqui é da Império Sofás. Vimos sua avaliação sobre ${product} e queremos agradecer.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function mailLink(email: string, product: string, customer: string) {
  const subject = `Sobre sua avaliação: ${product}`;
  const body = `Olá, ${customer}!\n\nAqui é da Império Sofás. Vimos sua avaliação sobre ${product} e queremos agradecer.\n\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const client = await requireCatalogAdmin("/admin/avaliacoes");
  const { status: requested } = await searchParams;
  const filter = FILTERS.some((item) => item.value === requested)
    ? (requested as (typeof FILTERS)[number]["value"])
    : "all";

  const [reviewsResult, summaryResult] = await Promise.all([
    client.rpc("admin_list_product_reviews", {
      p_status: filter === "all" ? null : filter,
      p_limit: 100,
    }),
    client.rpc("admin_get_engagement_summary"),
  ]);
  if (reviewsResult.error)
    throw new Error("Não foi possível carregar as avaliações.");
  const rows = z.array(reviewRowSchema).parse(reviewsResult.data ?? []);
  const parsed = summarySchema.safeParse(summaryResult.data);
  const summary = parsed.success ? parsed.data : null;
  const topMax = Math.max(
    1,
    ...(summary?.top_favorited ?? []).map((item) => item.favorites),
  );

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Conteúdo da loja</p>
        <h1>Avaliações e curtidas</h1>
        <p className={styles.lead}>
          Veja o que os clientes estão achando e quais modelos mais despertam
          interesse. Avaliações ocultas não aparecem na loja.
        </p>
      </div>

      {summary ? (
        <>
          <div className={styles.tiles}>
            <Tile
              label="Nota média"
              value={
                summary.reviews.published
                  ? ratingText(summary.reviews.average_rating)
                  : "—"
              }
              note={`${summary.reviews.published} ${summary.reviews.published === 1 ? "avaliação publicada" : "avaliações publicadas"}`}
            />
            <Tile
              label="Avaliações"
              value={String(summary.reviews.total)}
              note={`${summary.reviews.last_7_days} nos últimos 7 dias`}
            />
            <Tile
              label="Ocultas"
              value={String(summary.reviews.hidden)}
              note="Não aparecem na loja"
            />
            <Tile
              label="Favoritos"
              value={String(summary.favorites.total)}
              note={`${summary.favorites.customers} ${summary.favorites.customers === 1 ? "cliente" : "clientes"} · ${summary.favorites.last_7_days} nos últimos 7 dias`}
            />
          </div>

          <div className={styles.section}>
            <h2>
              <Heart size={20} aria-hidden="true" />
              Modelos mais curtidos
            </h2>
            {summary.top_favorited.length ? (
              <ol className={styles.ranking}>
                {summary.top_favorited.map((item, index) => (
                  <li key={item.product_id}>
                    <div className={styles.rankTop}>
                      <strong>
                        {index + 1}. {item.name}
                      </strong>
                      <span>
                        {item.favorites}{" "}
                        {item.favorites === 1 ? "curtida" : "curtidas"}
                        {item.average_rating
                          ? ` · nota ${ratingText(item.average_rating)} (${item.review_count})`
                          : " · sem avaliações"}
                      </span>
                    </div>
                    <div className={styles.bar} aria-hidden="true">
                      <div
                        style={{ width: `${(item.favorites / topMax) * 100}%` }}
                      />
                    </div>
                    {item.status === "active" && (
                      <Link
                        href={`/produto/${item.slug}`}
                        className={styles.textLink}
                      >
                        Abrir produto na loja
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>
                Ainda não há favoritos. Quando os clientes salvarem modelos, o
                ranking aparece aqui.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className={styles.notice}>
          O resumo de curtidas não está disponível agora. As avaliações abaixo
          continuam funcionando.
        </p>
      )}

      <div className={styles.section}>
        <div className={styles.filterRow}>
          <h2>
            <Star size={20} aria-hidden="true" />
            Avaliações
          </h2>
          <nav aria-label="Filtrar avaliações" className={styles.filters}>
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={
                  item.value === "all"
                    ? "/admin/avaliacoes"
                    : `/admin/avaliacoes?status=${item.value}`
                }
                aria-current={filter === item.value ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {rows.length ? (
          <ul className={styles.list}>
            {rows.map((row) => {
              const customer = row.customer_name || row.display_name;
              return (
                <li key={row.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={styles.product}>
                      <small>Produto avaliado</small>
                      <strong>{row.product_name}</strong>
                    </div>
                    <span
                      className={`${styles.pill} ${row.status === "published" ? styles.pillOn : styles.pillOff}`}
                    >
                      {row.status === "published" ? "Publicada" : "Oculta"}
                    </span>
                  </div>

                  <div className={styles.who}>
                    <strong>{customer}</strong>
                    {row.customer_name &&
                      row.customer_name !== row.display_name && (
                        <span>Aparece na loja como “{row.display_name}”</span>
                      )}
                    {row.customer_email && (
                      <a href={`mailto:${row.customer_email}`}>
                        {row.customer_email}
                      </a>
                    )}
                    {row.customer_phone && <span>{row.customer_phone}</span>}
                  </div>

                  <div className={styles.meta}>
                    <Stars value={row.rating} />
                    <span>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(row.created_at))}
                    </span>
                  </div>

                  {row.comment ? (
                    <p className={styles.comment}>{row.comment}</p>
                  ) : (
                    <p className={styles.noComment}>Sem comentário.</p>
                  )}

                  <div className={styles.actions}>
                    {row.product_status === "active" && (
                      <Link
                        href={`/produto/${row.product_slug}`}
                        className={styles.primary}
                      >
                        Abrir produto
                      </Link>
                    )}
                    <Link href={`/admin/produtos/${row.product_id}`}>
                      Editar produto
                    </Link>
                    {row.customer_email && (
                      <a
                        href={mailLink(
                          row.customer_email,
                          row.product_name,
                          customer,
                        )}
                      >
                        Responder por e-mail
                      </a>
                    )}
                    {row.customer_phone && (
                      <a
                        href={whatsappLink(
                          row.customer_phone,
                          row.product_name,
                          customer,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Responder no WhatsApp
                      </a>
                    )}
                    <form action={moderate}>
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={
                          row.status === "published" ? "hidden" : "published"
                        }
                      />
                      <button
                        type="submit"
                        className={
                          row.status === "published" ? styles.danger : undefined
                        }
                      >
                        {row.status === "published"
                          ? "Ocultar da loja"
                          : "Publicar na loja"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>
            {filter === "all"
              ? "Ainda não há avaliações."
              : "Nenhuma avaliação neste filtro."}
          </p>
        )}
      </div>
    </section>
  );
}
