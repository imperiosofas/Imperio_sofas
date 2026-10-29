"use client";

import { useActionState, useMemo, useState } from "react";
import { startCheckoutAction, type CheckoutState } from "./actions";
import styles from "./checkout.module.css";

export type PickupGroup = {
  supplierCode: string;
  supplierName: string;
  locations: { id: string; label: string }[];
};

export function CheckoutForm({
  idempotencyKey,
  quoteId,
  pickupGroups,
}: {
  idempotencyKey: string;
  quoteId: string | null;
  pickupGroups: PickupGroup[];
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    startCheckoutAction,
    { error: null },
  );
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pickupGroups
        .filter((group) => group.locations.length === 1)
        .map((group) => [group.supplierCode, group.locations[0].id]),
    ),
  );
  const ready =
    quoteId !== null || pickupGroups.every((g) => choice[g.supplierCode]);
  const payload = useMemo(
    () =>
      JSON.stringify(
        quoteId
          ? []
          : pickupGroups.map((group) => ({
              supplier_code: group.supplierCode,
              pickup_location_id: choice[group.supplierCode] ?? "",
            })),
      ),
    [choice, pickupGroups, quoteId],
  );

  return (
    <form action={action}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="quoteId" value={quoteId ?? ""} />
      <input type="hidden" name="pickup" value={payload} />

      {quoteId === null &&
        pickupGroups.map((group) => (
          <label className={styles.field} key={group.supplierCode}>
            Local de retirada ({group.supplierName})
            <select
              required
              value={choice[group.supplierCode] ?? ""}
              onChange={(event) =>
                setChoice((current) => ({
                  ...current,
                  [group.supplierCode]: event.target.value,
                }))
              }
            >
              <option value="">Selecione um local</option>
              {group.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </select>
          </label>
        ))}

      <button
        className={styles.primary}
        type="submit"
        disabled={pending || !ready}
      >
        {pending ? "Criando pedido…" : "Ir para o pagamento"}
      </button>
      <p className={styles.error} role="alert" aria-live="assertive">
        {state.error}
      </p>
    </form>
  );
}
