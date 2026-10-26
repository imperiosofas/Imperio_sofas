"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { FormEvent } from "react";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductPage,
} from "./catalog-data";
import {
  adjustCatalogInventory,
  changeCatalogCategory,
  createCategory,
  deleteCatalogProduct,
  quickEditCatalogProduct,
  renameCategory,
  setCatalogProductStatuses,
  toggleCategory,
} from "./actions";
import { formatBrlFromCents } from "../../lib/money";
import styles from "./admin.module.css";

type ProductRow = AdminProduct & { thumbnail: string | null };
type Status = AdminProduct["status"];
type StockFilter = "all" | "available" | "low" | "out";
type DialogTarget = { ids: string[]; names: string[] };

const statusNames: Record<Status, string> = {
  draft: "Rascunho",
  active: "Publicado",
  archived: "Arquivado",
};

function productStock(product: AdminProduct) {
  return product.product_variants.reduce(
    (sum, variant) =>
      sum +
      Math.max(
        0,
        (variant.inventory?.on_hand ?? 0) - (variant.inventory?.reserved ?? 0),
      ),
    0,
  );
}

function isLowStock(product: AdminProduct) {
  return product.product_variants.some((variant) => {
    const inventory = variant.inventory;
    return (
      inventory &&
      inventory.on_hand - inventory.reserved > 0 &&
      inventory.on_hand - inventory.reserved <= inventory.low_stock_threshold
    );
  });
}

function primarySku(product: AdminProduct) {
  return (
    product.product_variants.find((variant) => variant.sku)?.sku ?? "Sem SKU"
  );
}

function productPrice(product: AdminProduct) {
  const prices = product.product_variants
    .map((variant) => variant.price_cents)
    .filter((value): value is number => value !== null);
  if (!prices.length) return "Preço pendente";
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum
    ? formatBrlFromCents(minimum)
    : `${formatBrlFromCents(minimum)} – ${formatBrlFromCents(maximum)}`;
}

function productVariantLabel(
  variant: AdminProduct["product_variants"][number],
) {
  if (variant.width_mm)
    return `${(variant.width_mm / 1000).toFixed(2).replace(".", ",")} m`;
  if (variant.color) return variant.color;
  if (variant.fabric) return variant.fabric;
  return variant.sku ?? "Variante";
}

function priceInput(value: number | null) {
  return value === null ? "" : (value / 100).toFixed(2).replace(".", ",");
}

function parseBrl(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

export function CatalogManagementCenter({
  products,
  total,
  summary,
  categories,
  initialQuery,
  initialCategory,
  initialStatus,
  initialStock,
  initialPending,
  initialSort,
  initialPageSize,
  initialPage,
  flashMessage,
}: {
  products: ProductRow[];
  total: number;
  summary: AdminProductPage["summary"];
  categories: AdminCategory[];
  initialQuery: string;
  initialCategory: string;
  initialStatus: string;
  initialStock: string;
  initialPending: string;
  initialSort: string;
  initialPageSize: number;
  initialPage: number;
  flashMessage: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);
  const [stock, setStock] = useState<StockFilter>(
    (initialStock as StockFilter) || "all",
  );
  const [pendingFilter, setPendingFilter] = useState(initialPending || "all");
  const [sort, setSort] = useState(initialSort || "recent");
  const [pageSize, setPageSize] = useState(initialPageSize || 25);
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<string[]>([]);
  const [quickProduct, setQuickProduct] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DialogTarget | null>(null);
  const [categoryTarget, setCategoryTarget] = useState("");
  const [stockDelta, setStockDelta] = useState("1");
  const [notice, setNotice] = useState("");
  const [operationErrors, setOperationErrors] = useState<string[]>([]);
  const quickDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const initializedFilters = useRef(false);

  useEffect(() => {
    if (quickProduct) quickDialog.current?.showModal();
    else if (quickDialog.current?.open) quickDialog.current.close();
  }, [quickProduct]);
  useEffect(() => {
    if (deleteTarget) deleteDialog.current?.showModal();
    else if (deleteDialog.current?.open) deleteDialog.current.close();
  }, [deleteTarget]);

  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );

  useEffect(() => {
    if (!initializedFilters.current) {
      initializedFilters.current = true;
      return;
    }
    setPage(1);
  }, [query, category, status, stock, pendingFilter, sort, pageSize]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    if (stock !== "all") params.set("stock", stock);
    if (pendingFilter !== "all") params.set("pending", pendingFilter);
    if (sort !== "recent") params.set("sort", sort);
    if (pageSize !== 25) params.set("size", String(pageSize));
    if (page !== 1) params.set("page", String(page));
    const next = params.size ? `/admin/produtos?${params}` : "/admin/produtos";
    const timer = window.setTimeout(
      () => startTransition(() => router.replace(next, { scroll: false })),
      280,
    );
    return () => window.clearTimeout(timer);
  }, [
    query,
    category,
    status,
    stock,
    pendingFilter,
    sort,
    pageSize,
    page,
    router,
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const visible = products;
  const pageIds = visible.map((product) => product.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function submitStatus(nextStatus: "active" | "draft", ids = selected) {
    setOperationErrors([]);
    startTransition(async () => {
      const result = await setCatalogProductStatuses(ids, nextStatus);
      setNotice(result.message);
      setOperationErrors(
        result.failed.map((item) => {
          const product = products.find((entry) => entry.id === item.id);
          return `${product?.name ?? "Produto"}: ${item.reason}`;
        }),
      );
      setSelected(result.failed.map((item) => item.id));
      router.refresh();
    });
  }

  function submitQuickEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickProduct) return;
    const form = new FormData(event.currentTarget);
    const variants = quickProduct.product_variants.map((variant, index) => ({
      id: variant.id,
      sku: String(form.get(`sku-${index}`) ?? "").trim(),
      priceCents: parseBrl(String(form.get(`price-${index}`) ?? "")),
      onHand: Number(form.get(`stock-${index}`)),
      lowStockThreshold: Number(form.get(`threshold-${index}`)),
    }));
    startTransition(async () => {
      const result = await quickEditCatalogProduct({
        productId: quickProduct.id,
        name: String(form.get("name") ?? ""),
        categoryId: String(form.get("categoryId") ?? ""),
        variants,
      });
      setNotice(result.message);
      if (result.ok) setQuickProduct(null);
      router.refresh();
    });
  }

  function deleteProducts(target: DialogTarget) {
    startTransition(async () => {
      const results = [];
      for (const id of target.ids) results.push(await deleteCatalogProduct(id));
      const deleted = results.filter((result) =>
        result.message.startsWith("Produto excluído"),
      ).length;
      const archived = results.filter((result) =>
        result.message.startsWith("Produto arquivado"),
      ).length;
      const failed = results.filter((result) => !result.ok).length;
      setNotice(
        `${deleted} excluído(s), ${archived} arquivado(s)${failed ? `, ${failed} com erro` : ""}.`,
      );
      setSelected([]);
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function bulkChangeCategory() {
    startTransition(async () => {
      const result = await changeCatalogCategory(selected, categoryTarget);
      setNotice(result.message);
      if (result.ok) setSelected([]);
      router.refresh();
    });
  }

  function bulkAdjustStock(delta: number) {
    startTransition(async () => {
      const result = await adjustCatalogInventory(selected, delta);
      setNotice(result.message);
      if (result.ok) setSelected([]);
      router.refresh();
    });
  }

  function deleteSelection() {
    const chosen = products.filter((product) => selected.includes(product.id));
    setDeleteTarget({
      ids: chosen.map((item) => item.id),
      names: chosen.map((item) => item.name),
    });
  }

  return (
    <section className={styles.catalogCenter} aria-busy={isPending}>
      <header className={styles.catalogHeading}>
        <div>
          <h1>Produtos</h1>
          <p>Catálogo, disponibilidade e publicação em um só lugar.</p>
        </div>
        <Link href="/admin/produtos/novo" className={styles.primaryButton}>
          <Plus size={16} /> Novo produto
        </Link>
      </header>
      {flashMessage && (
        <p className={styles.success} role="status">
          {flashMessage}
        </p>
      )}

      <div className={styles.catalogStats} aria-label="Resumo do catálogo">
        <button
          type="button"
          onClick={() => {
            setStatus("all");
            setStock("all");
            setPendingFilter("all");
          }}
        >
          <strong>{summary.total}</strong>
          <span>Todos</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("active");
            setStock("all");
            setPendingFilter("all");
          }}
        >
          <strong>{summary.published}</strong>
          <span>Publicados</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus("draft");
            setStock("all");
            setPendingFilter("all");
          }}
        >
          <strong>{summary.drafts}</strong>
          <span>Rascunhos</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setStock("low");
            setStatus("all");
          }}
        >
          <strong>{summary.low_stock}</strong>
          <span>Estoque baixo</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setStock("out");
            setStatus("all");
          }}
        >
          <strong>{summary.out_of_stock}</strong>
          <span>Sem estoque</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingFilter("pending");
            setStatus("all");
          }}
        >
          <strong>{summary.pending}</strong>
          <span>Com pendências</span>
        </button>
      </div>

      <div className={styles.categoryToolbar}>
        <nav
          className={styles.categoryChips}
          aria-label="Filtrar por categoria"
        >
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            Todos
          </button>
          {categories.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </nav>
        <details className={styles.categoryManager}>
          <summary>
            <SlidersHorizontal size={14} /> Gerenciar categorias
          </summary>
          <div className={styles.categoryManagerPanel}>
            <h2>Categorias</h2>
            {categories.map((item) => (
              <div className={styles.categoryManagerRow} key={item.id}>
                <form action={renameCategory}>
                  <input type="hidden" name="categoryId" value={item.id} />
                  <label
                    className="sr-only"
                    htmlFor={`category-name-${item.id}`}
                  >
                    Nome de {item.name}
                  </label>
                  <input
                    id={`category-name-${item.id}`}
                    name="name"
                    defaultValue={item.name}
                    maxLength={120}
                    required
                  />
                  <button type="submit">Salvar nome</button>
                </form>
                <form action={toggleCategory}>
                  <input type="hidden" name="categoryId" value={item.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!item.is_active)}
                  />
                  <button type="submit">
                    {item.is_active ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            ))}
            <details className={styles.newCategoryDetails}>
              <summary>
                <Plus size={14} /> Nova categoria
              </summary>
              <form action={createCategory}>
                <label>
                  Nome
                  <input name="name" maxLength={120} required />
                </label>
                <label>
                  Descrição
                  <input name="description" maxLength={500} />
                </label>
                <label className={styles.inlineCheck}>
                  <input type="checkbox" name="active" /> Ativa na loja
                </label>
                <button type="submit">Criar categoria</button>
              </form>
            </details>
          </div>
        </details>
      </div>

      <div className={styles.catalogFilters}>
        <label className={styles.catalogSearch}>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou SKU"
            aria-label="Buscar produtos por nome, slug ou SKU"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Publicado</option>
            <option value="draft">Rascunho</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
        <label>
          <span>Estoque</span>
          <select
            value={stock}
            onChange={(event) => setStock(event.target.value as StockFilter)}
          >
            <option value="all">Todos</option>
            <option value="available">Disponível</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </select>
        </label>
        <label>
          <span>Pendências</span>
          <select
            value={pendingFilter}
            onChange={(event) => setPendingFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            <option value="pending">Com pendências</option>
            <option value="ready">Sem pendências</option>
          </select>
        </label>
        <label>
          <span>Ordenar</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">Mais recente</option>
            <option value="oldest">Mais antigo</option>
            <option value="name-asc">Nome A–Z</option>
            <option value="name-desc">Nome Z–A</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="stock-asc">Menor estoque</option>
            <option value="stock-desc">Maior estoque</option>
          </select>
        </label>
      </div>
      {isPending && (
        <p className={styles.catalogLoadingStatus} role="status">
          Atualizando resultados do catálogo…
        </p>
      )}

      {selected.length > 0 && (
        <div
          className={styles.bulkToolbar}
          role="region"
          aria-label="Ações em massa"
        >
          <strong>{selected.length} selecionado(s)</strong>
          <button
            type="button"
            onClick={() => submitStatus("active")}
            disabled={isPending}
          >
            Publicar
          </button>
          <button
            type="button"
            onClick={() => submitStatus("draft")}
            disabled={isPending}
          >
            Despublicar
          </button>
          <label className={styles.bulkCategory}>
            <span className="sr-only">Mover para categoria</span>
            <select
              value={categoryTarget}
              onChange={(event) => setCategoryTarget(event.target.value)}
            >
              <option value="">Alterar categoria…</option>
              {categories
                .filter((item) => item.is_active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => bulkChangeCategory()}
            disabled={isPending || !categoryTarget}
          >
            Aplicar
          </button>
          <label className={styles.bulkStock}>
            <span className="sr-only">Unidades de ajuste por variante</span>
            <input
              aria-label="Unidades para ajustar por variante"
              type="number"
              min="1"
              max="1000"
              value={stockDelta}
              onChange={(event) => setStockDelta(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              bulkAdjustStock(Math.max(1, Number(stockDelta) || 1))
            }
            disabled={isPending}
          >
            Estoque +
          </button>
          <button
            type="button"
            onClick={() =>
              bulkAdjustStock(-Math.max(1, Number(stockDelta) || 1))
            }
            disabled={isPending}
          >
            Estoque −
          </button>
          <button
            type="button"
            className={styles.bulkDelete}
            onClick={deleteSelection}
            disabled={isPending}
          >
            <Trash2 size={15} /> Excluir
          </button>
          <button
            type="button"
            className={styles.bulkClear}
            onClick={() => setSelected([])}
          >
            Limpar seleção
          </button>
        </div>
      )}
      {(notice || operationErrors.length > 0) && (
        <div
          className={operationErrors.length ? styles.alert : styles.success}
          role={operationErrors.length ? "alert" : "status"}
        >
          {notice && <p>{notice}</p>}
          {operationErrors.length > 0 && (
            <ul>
              {operationErrors.slice(0, 8).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.catalogTableWrap}>
        <table className={styles.catalogTable}>
          <thead>
            <tr>
              <th className={styles.selectColumn}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os produtos desta página"
                  checked={allPageSelected}
                  onChange={() =>
                    setSelected((current) =>
                      allPageSelected
                        ? current.filter((id) => !pageIds.includes(id))
                        : [...new Set([...current, ...pageIds])],
                    )
                  }
                />
              </th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Status</th>
              <th>Atualizado</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => {
              const available = productStock(product);
              const low = isLowStock(product);
              const categoryInfo = categoriesById.get(product.category_id);
              const selectedRow = selected.includes(product.id);
              return (
                <tr key={product.id} data-selected={selectedRow}>
                  <td className={styles.selectColumn}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${product.name}`}
                      checked={selectedRow}
                      onChange={() => toggleSelected(product.id)}
                    />
                  </td>
                  <td className={styles.catalogProductCell}>
                    <Link
                      href={`/admin/produtos/${product.id}`}
                      className={styles.catalogProductLink}
                    >
                      {product.thumbnail ? (
                        <Image
                          src={product.thumbnail}
                          alt=""
                          width={52}
                          height={52}
                          unoptimized
                        />
                      ) : (
                        <span className={styles.thumbnailFallback}>IS</span>
                      )}
                      <span>
                        <strong>{product.name}</strong>
                        <small>
                          {primarySku(product)}
                          {product.product_variants.length > 1
                            ? ` · ${product.product_variants.length} variantes`
                            : ""}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>{categoryInfo?.name ?? "—"}</td>
                  <td>{productPrice(product)}</td>
                  <td>
                    <strong>{available} un.</strong>
                    {low && available > 0 && (
                      <small className={styles.stockWarning}>
                        Estoque baixo
                      </small>
                    )}
                    {available === 0 && (
                      <small className={styles.stockEmpty}>Sem estoque</small>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${styles[`status_${product.status}`]}`}
                    >
                      {statusNames[product.status]}
                    </span>
                  </td>
                  <td>
                    <time dateTime={product.updated_at}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(product.updated_at))}
                    </time>
                  </td>
                  <td className={styles.rowActionsCell}>
                    <details className={styles.rowActions}>
                      <summary aria-label={`Ações para ${product.name}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div>
                        <Link href={`/admin/produtos/${product.id}`}>
                          Editar ficha
                        </Link>
                        <button
                          type="button"
                          onClick={() => setQuickProduct(product)}
                        >
                          Edição rápida
                        </button>
                        {product.status === "active" ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => submitStatus("draft", [product.id])}
                          >
                            Despublicar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => submitStatus("active", [product.id])}
                          >
                            Publicar
                          </button>
                        )}
                        {product.status === "active" && (
                          <Link
                            href={`/produto/${product.slug}`}
                            target="_blank"
                          >
                            Ver na loja <ExternalLink size={13} />
                          </Link>
                        )}
                        <button
                          type="button"
                          className={styles.deleteAction}
                          onClick={() =>
                            setDeleteTarget({
                              ids: [product.id],
                              names: [product.name],
                            })
                          }
                        >
                          Excluir
                        </button>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={8} className={styles.catalogEmpty}>
                  Nenhum produto corresponde a esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className={styles.catalogPagination}>
        <span>
          {total
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`
            : "0 produtos"}
        </span>
        <label>
          Por página
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(pages, current + 1))}
          disabled={page >= pages}
        >
          Próxima
        </button>
      </footer>

      <dialog
        className={styles.quickEditDialog}
        ref={quickDialog}
        onCancel={(event) => {
          event.preventDefault();
          setQuickProduct(null);
        }}
      >
        {quickProduct && (
          <form onSubmit={submitQuickEdit}>
            <header>
              <div>
                <p className={styles.kicker}>EDIÇÃO RÁPIDA</p>
                <h2>{quickProduct.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Fechar edição"
                onClick={() => setQuickProduct(null)}
              >
                ×
              </button>
            </header>
            <label>
              Nome
              <input
                name="name"
                defaultValue={quickProduct.name}
                maxLength={180}
                required
              />
            </label>
            <label>
              Categoria
              <select
                name="categoryId"
                defaultValue={quickProduct.category_id}
                required
              >
                {categories
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className={styles.quickVariantHeader}>
              <span>Variante</span>
              <span>SKU</span>
              <span>Preço</span>
              <span>Estoque</span>
              <span>Baixo em</span>
            </div>
            {quickProduct.product_variants.map((variant, index) => (
              <div className={styles.quickVariant} key={variant.id}>
                <strong>{productVariantLabel(variant)}</strong>
                <label>
                  <span className="sr-only">SKU {index + 1}</span>
                  <input
                    name={`sku-${index}`}
                    defaultValue={variant.sku ?? ""}
                    required
                  />
                </label>
                <label>
                  <span className="sr-only">Preço em reais {index + 1}</span>
                  <input
                    name={`price-${index}`}
                    defaultValue={priceInput(variant.price_cents)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  <span className="sr-only">Estoque {index + 1}</span>
                  <input
                    name={`stock-${index}`}
                    type="number"
                    min={variant.inventory?.reserved ?? 0}
                    defaultValue={variant.inventory?.on_hand ?? 0}
                    required
                  />
                </label>
                <label>
                  <span className="sr-only">
                    Alerta de estoque baixo {index + 1}
                  </span>
                  <input
                    name={`threshold-${index}`}
                    type="number"
                    min="0"
                    defaultValue={variant.inventory?.low_stock_threshold ?? 0}
                    required
                  />
                </label>
              </div>
            ))}
            {notice && <p role="status">{notice}</p>}
            <footer>
              <button type="button" onClick={() => setQuickProduct(null)}>
                Cancelar
              </button>
              <button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar alterações"}
              </button>
            </footer>
          </form>
        )}
      </dialog>

      <dialog
        className={styles.deleteDialog}
        ref={deleteDialog}
        onCancel={(event) => {
          event.preventDefault();
          setDeleteTarget(null);
        }}
      >
        {deleteTarget && (
          <div>
            <h2>
              {deleteTarget.ids.length === 1
                ? `Excluir “${deleteTarget.names[0]}”?`
                : `Excluir ${deleteTarget.ids.length} produtos?`}
            </h2>
            <p>
              O produto será removido do catálogo. Se houver itens no carrinho,
              avaliações ou outra referência histórica, ele será arquivado para
              preservar esses dados. Arquivos de imagem sem compartilhamento
              serão removidos do bucket privado.
            </p>
            {deleteTarget.names.length > 1 && (
              <ul>
                {deleteTarget.names.slice(0, 5).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
            <footer>
              <button type="button" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.deleteConfirm}
                disabled={isPending}
                onClick={() => deleteProducts(deleteTarget)}
              >
                {isPending ? "Removendo…" : "Confirmar exclusão"}
              </button>
            </footer>
          </div>
        )}
      </dialog>
    </section>
  );
}
