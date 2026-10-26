import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Heart, Star } from "lucide-react";
import { z } from "zod";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";

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
    <div className="rounded-xl border border-white/15 bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-5xl leading-none text-ivory">
        {value}
      </p>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </div>
  );
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

  let reviewsQuery = client
    .from("product_reviews")
    .select(
      "id,product_id,rating,comment,display_name,status,created_at,products(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter !== "all") reviewsQuery = reviewsQuery.eq("status", filter);

  const [reviewsResult, summaryResult] = await Promise.all([
    reviewsQuery,
    client.rpc("admin_get_engagement_summary"),
  ]);
  if (reviewsResult.error)
    throw new Error("Não foi possível carregar as avaliações.");
  const data = reviewsResult.data;
  const parsed = summarySchema.safeParse(summaryResult.data);
  const summary = parsed.success ? parsed.data : null;
  const topMax = Math.max(
    1,
    ...(summary?.top_favorited ?? []).map((i) => i.favorites),
  );

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gold">
          Conteúdo da loja
        </p>
        <h1 className="mt-2 font-display text-5xl text-ivory">
          Avaliações e curtidas
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Veja o que os clientes estão achando e quais modelos mais despertam
          interesse. Avaliações ocultas não aparecem na loja.
        </p>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ivory">
              <Heart size={20} aria-hidden="true" className="text-gold" />
              Modelos mais curtidos
            </h2>
            {summary.top_favorited.length ? (
              <ol className="mt-4 grid gap-3">
                {summary.top_favorited.map((item, index) => (
                  <li
                    key={item.product_id}
                    className="rounded-xl border border-white/15 bg-card p-4 text-ivory"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {index + 1}. {item.name}
                      </span>
                      <span className="text-sm text-muted">
                        {item.favorites}{" "}
                        {item.favorites === 1 ? "curtida" : "curtidas"}
                        {item.average_rating
                          ? ` · nota ${ratingText(item.average_rating)} (${item.review_count})`
                          : " · sem avaliações"}
                      </span>
                    </div>
                    <div
                      className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{
                          width: `${(item.favorites / topMax) * 100}%`,
                        }}
                      />
                    </div>
                    {item.status === "active" && (
                      <Link
                        href={`/produto/${item.slug}`}
                        className="mt-3 inline-block text-sm text-gold underline"
                      >
                        Ver na loja
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Ainda não há favoritos. Quando os clientes salvarem modelos, o
                ranking aparece aqui.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-white/15 bg-card p-5 text-sm text-muted">
          O resumo de curtidas não está disponível agora. As avaliações abaixo
          continuam funcionando.
        </p>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ivory">
            <Star size={20} aria-hidden="true" className="text-gold" />
            Avaliações
          </h2>
          <nav aria-label="Filtrar avaliações" className="flex gap-2">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={
                  item.value === "all"
                    ? "/admin/avaliacoes"
                    : `/admin/avaliacoes?status=${item.value}`
                }
                aria-current={filter === item.value ? "page" : undefined}
                className={
                  filter === item.value
                    ? "min-h-11 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink"
                    : "min-h-11 rounded-full border border-white/20 px-5 py-2.5 text-sm text-ivory"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-4 grid gap-4">
          {data?.length ? (
            data.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-white/15 bg-card p-5 text-ivory"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>{row.products?.[0]?.name ?? "Produto"}</strong>
                  <span
                    className={
                      row.status === "published"
                        ? "text-xs font-semibold text-gold"
                        : "text-xs font-semibold text-muted"
                    }
                  >
                    {row.status === "published" ? "Publicada" : "Oculta"}
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                  <span
                    role="img"
                    aria-label={`Nota ${row.rating} de 5`}
                    className="inline-flex gap-0.5 text-gold"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        size={15}
                        aria-hidden="true"
                        fill={value <= row.rating ? "currentColor" : "none"}
                      />
                    ))}
                  </span>
                  <span>{row.display_name}</span>
                  <span>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                    }).format(new Date(row.created_at))}
                  </span>
                </p>
                {row.comment ? (
                  <p className="mt-4 text-sm leading-6">{row.comment}</p>
                ) : (
                  <p className="mt-4 text-sm text-muted">Sem comentário.</p>
                )}
                <form action={moderate} className="mt-5">
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={row.status === "published" ? "hidden" : "published"}
                  />
                  <button
                    type="submit"
                    className="min-h-11 rounded-full border border-gold/40 px-5 text-sm font-semibold text-gold"
                  >
                    {row.status === "published" ? "Ocultar" : "Publicar"}
                  </button>
                </form>
              </article>
            ))
          ) : (
            <p className="py-6 text-sm text-muted">
              {filter === "all"
                ? "Ainda não há avaliações."
                : "Nenhuma avaliação neste filtro."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
