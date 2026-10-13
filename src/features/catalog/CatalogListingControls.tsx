"use client";

import { useRef, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, ArrowDownUp, Search, X } from "lucide-react";
import type { CatalogListingFilters, CatalogListing } from "./types";
import { listingHref, listingSorts } from "./listing-url";
import styles from "./catalog-listing.module.css";

type Props = {
  path: string;
  filters: CatalogListingFilters;
  widths: CatalogListing["widths"];
  total: number;
  activeCount: number;
};

const widthLabel = (mm: number) =>
  `${(mm / 1000).toFixed(2).replace(".", ",")} m`;

function FilterFields({ filters, widths }: Pick<Props, "filters" | "widths">) {
  return (
    <>
      <details
        className={styles.filterGroup}
        open={
          Boolean(filters.minPriceCents || filters.maxPriceCents) || undefined
        }
      >
        <summary>Preço</summary>
        <div className={styles.priceFields}>
          <label>
            De (R$)
            <input
              name="min"
              type="number"
              min="1"
              step="1"
              defaultValue={
                filters.minPriceCents ? filters.minPriceCents / 100 : ""
              }
              inputMode="numeric"
            />
          </label>
          <label>
            Até (R$)
            <input
              name="max"
              type="number"
              min="1"
              step="1"
              defaultValue={
                filters.maxPriceCents ? filters.maxPriceCents / 100 : ""
              }
              inputMode="numeric"
            />
          </label>
        </div>
      </details>
      {widths.length > 0 && (
        <details
          className={styles.filterGroup}
          open={filters.widthsMm.length > 0 || undefined}
        >
          <summary>Largura</summary>
          {widths.map(({ widthMm, count }) => (
            <label className={styles.checkbox} key={widthMm}>
              <input
                type="checkbox"
                name="largura"
                value={widthMm}
                defaultChecked={filters.widthsMm.includes(widthMm)}
              />
              <span>{widthLabel(widthMm)}</span>
              <small>{count}</small>
            </label>
          ))}
        </details>
      )}
    </>
  );
}

export function CatalogListingControls({
  path,
  filters,
  widths,
  total,
  activeCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const filterDialog = useRef<HTMLDialogElement>(null);
  const sortDialog = useRef<HTMLDialogElement>(null);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const min = Number(data.get("min"));
    const max = Number(data.get("max"));
    filterDialog.current?.close();
    startTransition(() =>
      router.push(
        listingHref(path, filters, {
          minPriceCents: min > 0 ? min * 100 : undefined,
          maxPriceCents: max > 0 ? max * 100 : undefined,
          widthsMm: data.getAll("largura").map(Number),
          page: 1,
        }),
      ),
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.count}>
          <strong>{total}</strong> {total === 1 ? "modelo" : "modelos"}
        </div>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget)
              .get("q")
              ?.toString()
              .trim();
            startTransition(() =>
              router.push(
                listingHref(path, filters, {
                  query: query || undefined,
                  page: 1,
                }),
              ),
            );
          }}
          role="search"
        >
          <label className="sr-only" htmlFor="catalog-search">
            Buscar modelo
          </label>
          <input
            id="catalog-search"
            key={filters.query ?? ""}
            name="q"
            type="search"
            placeholder="Buscar sofás"
            defaultValue={filters.query ?? ""}
            maxLength={100}
          />
          <button type="submit" aria-label="Buscar">
            <Search size={19} />
          </button>
        </form>
        <details className={styles.desktopSort}>
          <summary>
            Ordenar: <strong>{listingSorts[filters.sort]}</strong>
          </summary>
          <div>
            {Object.entries(listingSorts).map(([value, label]) => (
              <Link
                key={value}
                href={listingHref(path, filters, {
                  sort: value as CatalogListingFilters["sort"],
                  page: 1,
                })}
                aria-current={filters.sort === value ? "true" : undefined}
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
      </div>
      <div className={styles.mobileActions}>
        <button type="button" onClick={() => filterDialog.current?.showModal()}>
          <SlidersHorizontal size={18} /> Filtrar
          {activeCount ? ` · ${activeCount}` : ""}
        </button>
        <button type="button" onClick={() => sortDialog.current?.showModal()}>
          <ArrowDownUp size={18} /> Ordenar
        </button>
      </div>
      {activeCount > 0 && (
        <div className={styles.chips} aria-label="Filtros aplicados">
          {filters.query && (
            <Link
              href={listingHref(path, filters, { query: undefined, page: 1 })}
            >
              Busca: {filters.query} <X size={14} />
            </Link>
          )}
          {filters.minPriceCents && (
            <Link
              href={listingHref(path, filters, {
                minPriceCents: undefined,
                page: 1,
              })}
            >
              A partir de R$ {filters.minPriceCents / 100} <X size={14} />
            </Link>
          )}
          {filters.maxPriceCents && (
            <Link
              href={listingHref(path, filters, {
                maxPriceCents: undefined,
                page: 1,
              })}
            >
              Até R$ {filters.maxPriceCents / 100} <X size={14} />
            </Link>
          )}
          {filters.widthsMm.map((width) => (
            <Link
              key={width}
              href={listingHref(path, filters, {
                widthsMm: filters.widthsMm.filter((item) => item !== width),
                page: 1,
              })}
            >
              {widthLabel(width)} <X size={14} />
            </Link>
          ))}
          <Link className={styles.clear} href={path}>
            Limpar filtros
          </Link>
        </div>
      )}
      <aside className={styles.sidebar} aria-label="Filtros de produtos">
        <h2>Filtrar</h2>
        <form onSubmit={applyFilters} key={listingHref(path, filters)}>
          <FilterFields filters={filters} widths={widths} />
          <button className={styles.apply} type="submit" disabled={pending}>
            Aplicar filtros
          </button>
        </form>
      </aside>
      <dialog
        ref={filterDialog}
        className={styles.dialog}
        aria-labelledby="filter-title"
      >
        <div className={styles.dialogHead}>
          <h2 id="filter-title">Filtrar produtos</h2>
          <button
            type="button"
            onClick={() => filterDialog.current?.close()}
            aria-label="Fechar filtros"
          >
            <X />
          </button>
        </div>
        <form
          onSubmit={applyFilters}
          key={`mobile-${listingHref(path, filters)}`}
        >
          <div className={styles.dialogBody}>
            <FilterFields filters={filters} widths={widths} />
          </div>
          <div className={styles.dialogFoot}>
            <Link href={path} onClick={() => filterDialog.current?.close()}>
              Limpar
            </Link>
            <button className={styles.apply} type="submit" disabled={pending}>
              Ver produtos
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={sortDialog}
        className={`${styles.dialog} ${styles.sortDialog}`}
        aria-labelledby="sort-title"
      >
        <div className={styles.dialogHead}>
          <h2 id="sort-title">Ordenar por</h2>
          <button
            type="button"
            onClick={() => sortDialog.current?.close()}
            aria-label="Fechar ordenação"
          >
            <X />
          </button>
        </div>
        <div className={styles.sortOptions}>
          {Object.entries(listingSorts).map(([value, label]) => (
            <Link
              key={value}
              aria-current={filters.sort === value ? "true" : undefined}
              href={listingHref(path, filters, {
                sort: value as CatalogListingFilters["sort"],
                page: 1,
              })}
              onClick={() => sortDialog.current?.close()}
            >
              {label}
            </Link>
          ))}
        </div>
      </dialog>
    </>
  );
}
