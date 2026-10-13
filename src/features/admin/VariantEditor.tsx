"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./admin.module.css";

export type VariantDraft = {
  id?: string;
  sku: string;
  fabric: string;
  color: string;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  priceCents: number | null;
  onHand: number;
  lowStockThreshold: number;
  isActive: boolean;
};

const emptyVariant = (): VariantDraft => ({
  sku: "",
  fabric: "",
  color: "",
  widthMm: null,
  depthMm: null,
  heightMm: null,
  priceCents: null,
  onHand: 0,
  lowStockThreshold: 0,
  isActive: true,
});

function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
  step,
}: {
  label: string;
  name: string;
  value: string | number;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={step}
        min={type === "number" ? 0 : undefined}
        inputMode={type === "number" ? "numeric" : undefined}
      />
    </label>
  );
}

export function VariantEditor({ initial }: { initial: VariantDraft[] }) {
  const [variants, setVariants] = useState(
    initial.length ? initial : [emptyVariant()],
  );

  return (
    <div className={styles.variantList}>
      {variants.map((variant, index) => {
        const prefix = `variants[${index}]`;
        return (
          <fieldset className={styles.variantCard} key={variant.id ?? index}>
            <legend>
              <span>Variação {String(index + 1).padStart(2, "0")}</span>
              {variant.id ? (
                <label className={styles.switch}>
                  <input
                    name={`${prefix}.isActive`}
                    type="checkbox"
                    defaultChecked={variant.isActive}
                  />
                  <span>Disponível para venda</span>
                </label>
              ) : (
                <input type="hidden" name={`${prefix}.isActive`} value="on" />
              )}
            </legend>
            {variant.id && (
              <input type="hidden" name={`${prefix}.id`} value={variant.id} />
            )}
            <div className={styles.variantGrid}>
              <Field
                label="SKU"
                name={`${prefix}.sku`}
                value={variant.sku}
                required
              />
              <Field
                label="Preço de venda (R$)"
                name={`${prefix}.price`}
                type="number"
                step="0.01"
                value={
                  variant.priceCents === null
                    ? ""
                    : (variant.priceCents / 100).toFixed(2)
                }
                required
              />
              <Field
                label="Largura (mm)"
                name={`${prefix}.widthMm`}
                type="number"
                value={variant.widthMm ?? ""}
              />
              <Field
                label="Profundidade (mm)"
                name={`${prefix}.depthMm`}
                type="number"
                value={variant.depthMm ?? ""}
              />
              <Field
                label="Altura (mm)"
                name={`${prefix}.heightMm`}
                type="number"
                value={variant.heightMm ?? ""}
              />
              <Field
                label="Tecido"
                name={`${prefix}.fabric`}
                value={variant.fabric}
              />
              <Field
                label="Cor"
                name={`${prefix}.color`}
                value={variant.color}
              />
              <Field
                label="Estoque físico"
                name={`${prefix}.onHand`}
                type="number"
                value={variant.onHand}
                required
              />
              <Field
                label="Aviso de estoque baixo"
                name={`${prefix}.lowStockThreshold`}
                type="number"
                value={variant.lowStockThreshold}
                required
              />
            </div>
            {!variant.id && variants.length > 1 && (
              <button
                className={styles.removeVariant}
                type="button"
                onClick={() =>
                  setVariants((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <Trash2 size={15} /> Remover variação ainda não salva
              </button>
            )}
          </fieldset>
        );
      })}
      <button
        className={styles.addVariant}
        type="button"
        onClick={() => setVariants((current) => [...current, emptyVariant()])}
        disabled={variants.length >= 30}
      >
        <Plus size={16} /> Adicionar variação
      </button>
    </div>
  );
}
