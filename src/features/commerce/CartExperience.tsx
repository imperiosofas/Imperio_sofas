"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "./data";
import { setCartItem } from "./actions";
import { formatBrlFromCents } from "../../lib/money";
import type { CartLogisticsPresentation } from "../logistics/types";
import { CartLogisticsPanel } from "../logistics/CartLogisticsPanel";
import styles from "./cart.module.css";

export function CartExperience({
  items,
  logistics,
}: {
  items: CartItem[];
  logistics: CartLogisticsPresentation | null;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const total = items.reduce(
    (sum, item) =>
      sum +
      (item.stock_status !== "unavailable"
        ? item.price_cents * item.quantity
        : 0),
    0,
  );
  function change(item: CartItem, quantity: number) {
    startTransition(async () => {
      const result = await setCartItem(item.variant_id, quantity);
      setNotice(result.message);
      if (result.ok) {
        window.dispatchEvent(new Event("cart:changed"));
        router.refresh();
      }
    });
  }
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <p>Sua seleção</p>
          <h1>Carrinho</h1>
          <span>
            {items.reduce((sum, item) => sum + item.quantity, 0)} itens
          </span>
        </div>
        {items.length ? (
          <>
            <div className={styles.columns}>
              <ul className={styles.items}>
                {items.map((item) => (
                  <li key={item.variant_id}>
                    <Link
                      className={styles.image}
                      href={`/produto/${item.product_slug}`}
                    >
                      {item.imageSrc ? (
                        <Image
                          src={item.imageSrc}
                          alt={item.name}
                          fill
                          unoptimized
                          sizes="120px"
                        />
                      ) : (
                        <span>Império Sofás</span>
                      )}
                    </Link>
                    <div className={styles.itemInfo}>
                      <Link
                        href={`/produto/${item.product_slug}`}
                        className={styles.name}
                      >
                        {item.name}
                      </Link>
                      <p>
                        {item.width_mm
                          ? `${(item.width_mm / 1000).toFixed(2).replace(".", ",")} m`
                          : ""}
                      </p>
                      <p>
                        {item.stock_status !== "unavailable"
                          ? formatBrlFromCents(item.price_cents)
                          : "Indisponível no momento"}
                      </p>
                      <p>
                        {item.stock_status === "low_stock"
                          ? "Estoque baixo"
                          : item.stock_status === "unavailable"
                            ? "Indisponível"
                            : "Disponível"}
                      </p>
                      <div className={styles.controls}>
                        <button
                          type="button"
                          disabled={pending || item.quantity <= 1}
                          onClick={() => change(item, item.quantity - 1)}
                          aria-label={`Diminuir quantidade de ${item.name}`}
                        >
                          <Minus size={17} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          disabled={
                            pending ||
                            item.quantity >= 99 ||
                            item.stock_status === "unavailable"
                          }
                          onClick={() => change(item, item.quantity + 1)}
                          aria-label={`Aumentar quantidade de ${item.name}`}
                        >
                          <Plus size={17} />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => change(item, 0)}
                          aria-label={`Remover ${item.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <strong>
                      {item.stock_status !== "unavailable"
                        ? formatBrlFromCents(item.price_cents * item.quantity)
                        : "Indisponível"}
                    </strong>
                  </li>
                ))}
              </ul>
              <aside className={styles.summary}>
                <h2>Resumo</h2>
                <div>
                  <span>Subtotal disponível</span>
                  <strong>{formatBrlFromCents(total)}</strong>
                </div>
                <p>
                  Retirada não tem frete. Para entrega, solicite a cotação
                  abaixo, aguarde a resposta da loja e aceite em Minhas entregas
                  antes de pagar.
                </p>
                <Link href="/checkout">Finalizar compra</Link>
                <Link href="/loja">Continuar explorando a loja</Link>
              </aside>
            </div>
            <CartLogisticsPanel items={items} logistics={logistics} />
          </>
        ) : (
          <div className={styles.empty}>
            <h2>Seu carrinho está vazio.</h2>
            <p>Explore os modelos disponíveis e escolha o seu sofá.</p>
            <Link href="/loja">Ver produtos</Link>
          </div>
        )}
        <span role="status" className={styles.notice}>
          {notice}
        </span>
      </div>
    </main>
  );
}
