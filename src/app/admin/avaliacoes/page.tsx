import { revalidatePath } from "next/cache";
import { requireCatalogAdmin } from "../../../lib/supabase/admin-access";

export const dynamic = "force-dynamic";

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

export default async function AdminReviewsPage() {
  const client = await requireCatalogAdmin("/admin/avaliacoes");
  const { data, error } = await client
    .from("product_reviews")
    .select(
      "id,product_id,rating,comment,display_name,status,created_at,products(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível carregar as avaliações.");
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gold">
          Conteúdo da loja
        </p>
        <h1 className="mt-2 font-display text-5xl text-ivory">Avaliações</h1>
      </div>
      <p className="text-sm text-muted">
        Modere avaliações reais enviadas por clientes. Avaliações ocultas não
        aparecem na loja.
      </p>
      <div className="grid gap-4">
        {data?.length ? (
          data.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-white/15 bg-card p-5 text-ivory"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong>{row.products?.[0]?.name ?? "Produto"}</strong>
                <span className="text-xs uppercase tracking-wide text-gold">
                  {row.status === "published" ? "Publicada" : "Oculta"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {row.display_name} · {row.rating} de 5 ·{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                }).format(new Date(row.created_at))}
              </p>
              {row.comment && (
                <p className="mt-4 text-sm leading-6">{row.comment}</p>
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
          <p className="py-10 text-muted">Ainda não há avaliações.</p>
        )}
      </div>
    </section>
  );
}
