import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { retryCatalogStorageCleanup } from "../../../../features/admin/actions";
import styles from "../../../../features/admin/admin.module.css";
import { requireCatalogAdmin } from "../../../../lib/supabase/admin-access";

export const dynamic = "force-dynamic";

type CleanupJob = {
  cleanup_id: string;
  product_id: string;
  product_name: string | null;
  status: "pending" | "processing";
  attempts: number;
  next_attempt_at: string;
  last_error_code: string | null;
  created_at: string;
};

type CleanupPageResult = {
  jobs: CleanupJob[];
  has_more: boolean;
  next_cursor: { created_at: string; id: string } | null;
};

const errorLabels: Record<string, string> = {
  storage_list_failed: "Falha ao verificar o arquivo no Storage",
  storage_remove_failed: "Storage ainda não confirmou a remoção",
  path_ownership_mismatch: "Caminho não validado; requer revisão",
};

export default async function CatalogStorageCleanupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const uuidSchema = z.string().uuid();
  const [query, supabase] = await Promise.all([
    searchParams,
    requireCatalogAdmin("/admin/produtos/limpeza-storage"),
  ]);
  const after = typeof query.after === "string" ? query.after : "";
  const afterId = typeof query.afterId === "string" ? query.afterId : "";
  const cursorDate = after ? new Date(after) : null;
  const cursorValid =
    !after && !afterId
      ? true
      : Boolean(
          after &&
          afterId &&
          cursorDate &&
          Number.isFinite(cursorDate.getTime()) &&
          uuidSchema.safeParse(afterId).success,
        );
  const { data, error } = await supabase.rpc(
    "admin_list_catalog_storage_cleanup",
    {
      p_after_created_at:
        cursorValid && cursorDate ? cursorDate.toISOString() : null,
      p_after_id: cursorValid && afterId ? afterId : null,
    },
  );
  const result = data as CleanupPageResult | null;
  const jobs = Array.isArray(result?.jobs) ? result.jobs : [];
  const hasMore = result?.has_more === true;
  const nextCursor = result?.next_cursor;
  const nextHref =
    hasMore && nextCursor
      ? `?after=${encodeURIComponent(nextCursor.created_at)}&afterId=${encodeURIComponent(nextCursor.id)}`
      : null;
  const notice = typeof query.retry === "string" ? query.retry : "";
  const noticeText =
    notice === "completed"
      ? "A remoção foi confirmada pelo servidor."
      : notice === "pending"
        ? "A tarefa continua pendente; verifique a conexão e tente novamente."
        : notice === "busy"
          ? "A tarefa ainda está em processamento ou no intervalo de segurança. Confira o próximo horário na linha da tarefa."
          : notice === "missing"
            ? "A tarefa não foi encontrada na fila."
            : notice === "unavailable"
              ? "Não foi possível acessar o Storage ou registrar o resultado."
              : notice === "invalid"
                ? "Identificador de tarefa inválido."
                : "";

  return (
    <div>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.kicker}>CATÁLOGO / INTEGRIDADE</p>
          <h1>Limpeza de imagens</h1>
          <p>
            Tarefas pendentes permanecem disponíveis aqui mesmo depois que o
            produto ou a mídia já foram removidos do cadastro.
          </p>
        </div>
      </div>
      {error && (
        <p className={styles.alert} role="alert">
          Não foi possível carregar a fila de limpeza.
        </p>
      )}
      {!cursorValid && (
        <p className={styles.alert} role="alert">
          Cursor de paginação inválido. A primeira página da fila foi exibida.
        </p>
      )}
      {noticeText && (
        <p
          className={notice === "completed" ? styles.success : styles.alert}
          role="status"
        >
          {noticeText}
        </p>
      )}
      {!error && jobs.length === 0 ? (
        <section className={styles.emptyCategory}>
          <h2>Nenhuma limpeza pendente</h2>
          <p>
            Arquivos removidos do cadastro e confirmados no Storage aparecem
            concluídos.
          </p>
        </section>
      ) : (
        <section className={styles.cleanupList} aria-label="Tarefas pendentes">
          {jobs.map((job) => (
            <article className={styles.cleanupRow} key={job.cleanup_id}>
              <div className={styles.cleanupDetails}>
                <strong>{job.product_name ?? "Produto já removido"}</strong>
                <span>
                  {job.status === "processing"
                    ? "Execução expirada"
                    : "Pendente"}
                  {job.last_error_code
                    ? ` · ${errorLabels[job.last_error_code] ?? "Falha anterior"}`
                    : ""}
                </span>
                <small>
                  Tentativas: {job.attempts} · Criada em{" "}
                  {new Date(job.created_at).toLocaleString("pt-BR")}
                </small>
                {new Date(job.next_attempt_at).getTime() > Date.now() && (
                  <small>
                    Próxima tentativa disponível em{" "}
                    {new Date(job.next_attempt_at).toLocaleString("pt-BR")}
                  </small>
                )}
              </div>
              <form action={retryCatalogStorageCleanup}>
                <input type="hidden" name="cleanupId" value={job.cleanup_id} />
                <button
                  className={styles.secondaryButton}
                  type="submit"
                  disabled={
                    new Date(job.next_attempt_at).getTime() > Date.now()
                  }
                >
                  <RotateCcw size={15} />
                  {new Date(job.next_attempt_at).getTime() > Date.now()
                    ? "Aguardando intervalo"
                    : "Tentar novamente"}
                </button>
              </form>
            </article>
          ))}
          {(nextHref || after) && (
            <nav
              className={styles.cleanupPagination}
              aria-label="Paginação da fila"
            >
              {after && (
                <Link
                  className={styles.secondaryButton}
                  href="/admin/produtos/limpeza-storage"
                >
                  Voltar ao início da fila
                </Link>
              )}
              {nextHref && (
                <Link className={styles.primaryButton} href={nextHref}>
                  Ver tarefas mais antigas →
                </Link>
              )}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
