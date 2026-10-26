"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Truck } from "lucide-react";
import { z } from "zod";
import type { CartItem } from "../commerce/data";
import { createCustomerLogisticsQuote } from "./actions";
import {
  createQuoteIdempotency,
  getCartSnapshotFingerprint,
  getQuoteRequestFingerprint,
} from "./quote-idempotency.mjs";
import type {
  CartLogisticsPresentation,
  DeliveryArea,
  LogisticsMode,
  PickupLocation,
  SupplierCode,
} from "./types";
import styles from "./logistics.module.css";

const cepResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("invalid") }),
  z.object({ status: z.literal("not_found") }),
  z.object({ status: z.literal("unavailable") }),
  z.object({
    status: z.literal("found"),
    postalCode: z.string().regex(/^\d{8}$/),
    municipalityId: z.string().regex(/^\d{7}$/),
    city: z.string().min(1),
    state: z.string().regex(/^[A-Z]{2}$/),
    street: z.string(),
    neighborhood: z.string(),
  }),
]);

type FoundCep = Extract<z.infer<typeof cepResponseSchema>, { status: "found" }>;
type SupplierGroup = {
  code: SupplierCode;
  name: string;
  items: CartItem[];
  modes: LogisticsMode[];
};

function formatBrl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function findArea(cep: FoundCep, areas: DeliveryArea[]): DeliveryArea | null {
  return (
    areas.find(
      (area) =>
        area.ibgeCode === cep.municipalityId &&
        area.cityName === cep.city &&
        area.stateCode === cep.state,
    ) ?? null
  );
}

function supplierLabel(code: SupplierCode) {
  return code === "VALE" ? "Império Sofás Vale" : "Mundial";
}

function pickupLabel(location: PickupLocation) {
  return `${location.displayName} — ${location.street}, ${location.streetNumber}, ${location.neighborhood}, ${location.cityName}/${location.stateCode}`;
}

export function CartLogisticsPanel({
  items,
  logistics,
}: {
  items: CartItem[];
  logistics: CartLogisticsPresentation | null;
}) {
  const router = useRouter();
  const initialGroups = useMemo(() => {
    const grouped = new Map<SupplierCode, CartItem[]>();
    for (const item of items) {
      const code = item.logistics?.supplierCode;
      if (!code || !item.logistics?.supplierAssigned) continue;
      grouped.set(code, [...(grouped.get(code) ?? []), item]);
    }
    return [...grouped.entries()].map(([code, groupItems]): SupplierGroup => {
      const modes = groupItems[0]?.logistics?.fulfillmentModes ?? [];
      return {
        code,
        name: groupItems[0]?.logistics?.supplierName ?? supplierLabel(code),
        items: groupItems,
        modes: modes.filter((mode) =>
          groupItems.every((item) =>
            item.logistics?.fulfillmentModes.includes(mode),
          ),
        ),
      };
    });
  }, [items]);
  const [modes, setModes] = useState<Record<string, LogisticsMode>>(() =>
    Object.fromEntries(
      initialGroups.map((group) => [group.code, group.modes[0] ?? "delivery"]),
    ),
  );
  const [pickupLocations, setPickupLocations] = useState<
    Record<string, string>
  >({});
  const [postalCode, setPostalCode] = useState("");
  const [floor, setFloor] = useState("0");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [cepStatus, setCepStatus] = useState<
    "idle" | "checking" | "invalid" | "not_found" | "unavailable" | "found"
  >("idle");
  const [verifiedCep, setVerifiedCep] = useState<FoundCep | null>(null);
  const [notice, setNotice] = useState("");
  const [createdQuote, setCreatedQuote] = useState<{
    id: string;
    whatsappUrl: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<ReturnType<typeof createQuoteIdempotency> | null>(
    null,
  );
  if (requestId.current === null) {
    requestId.current = createQuoteIdempotency(() => crypto.randomUUID());
  }

  const hasUnknownItems = items.some(
    (item) =>
      !item.logistics ||
      !item.logistics.supplierAssigned ||
      !item.logistics.supplierCode ||
      !item.logistics.availableForQuote ||
      item.logistics.fulfillmentModes.length === 0,
  );
  const groupsReady =
    initialGroups.length > 0 &&
    !hasUnknownItems &&
    initialGroups.every((group) => group.modes.length > 0);
  const hasDelivery = initialGroups.some(
    (group) => modes[group.code] === "delivery",
  );
  const currentFloor = Number(floor);
  const floorChargeCents = logistics
    ? Math.max(0, currentFloor - logistics.floorCharge.includedThroughFloor) *
      logistics.floorCharge.floorChargeCents
    : 0;
  const feeIsSupported =
    Number.isSafeInteger(currentFloor) &&
    currentFloor >= 0 &&
    currentFloor <= 2_147_483_647 &&
    Number.isSafeInteger(floorChargeCents) &&
    floorChargeCents <= 2_147_483_647;
  const deliveryArea =
    verifiedCep && logistics
      ? findArea(verifiedCep, logistics.deliveryAreas)
      : null;
  const cartFingerprint = getCartSnapshotFingerprint(items);
  const previousCartFingerprint = useRef(cartFingerprint);

  useEffect(() => {
    if (previousCartFingerprint.current === cartFingerprint) return;
    previousCartFingerprint.current = cartFingerprint;
    requestId.current?.clear();
    setCreatedQuote(null);
    setModes(
      Object.fromEntries(
        initialGroups.map((group) => [
          group.code,
          group.modes[0] ?? "delivery",
        ]),
      ),
    );
    setPickupLocations({});
    setNotice("O carrinho foi atualizado. Revise as opções de recebimento.");
  }, [cartFingerprint, initialGroups]);

  function resetRequest() {
    requestId.current?.clear();
    setCreatedQuote(null);
    setNotice("");
  }

  async function verifyPostalCode() {
    resetRequest();
    setVerifiedCep(null);
    setCepStatus("checking");
    setNotice("");
    const normalized = postalCode.replace(/\D/g, "");
    if (!/^\d{8}$/.test(normalized)) {
      setCepStatus("invalid");
      return;
    }
    try {
      const response = await fetch(
        `/api/logistics/cep?cep=${encodeURIComponent(normalized)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      const parsed = cepResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setCepStatus("unavailable");
        return;
      }
      if (parsed.data.status === "found" && !response.ok) {
        setCepStatus("unavailable");
        return;
      }
      setCepStatus(parsed.data.status);
      if (parsed.data.status === "found") setVerifiedCep(parsed.data);
    } catch {
      setCepStatus("unavailable");
    }
  }

  function submitQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!logistics || !groupsReady) {
      setNotice("A logística de todos os itens precisa estar disponível.");
      return;
    }
    if (!hasDelivery) {
      setNotice(
        "Para retirada, use o local indicado. Nenhuma cotação é necessária.",
      );
      return;
    }
    if (!verifiedCep || !deliveryArea) {
      setNotice("Confirme um CEP atendido antes de solicitar a cotação.");
      return;
    }
    if (
      !Number.isSafeInteger(currentFloor) ||
      currentFloor < 0 ||
      !feeIsSupported
    ) {
      setNotice("Confira o andar informado e o adicional de acesso.");
      return;
    }
    if (!number.trim()) {
      setNotice("Informe o número do endereço.");
      return;
    }
    const supplierModes = initialGroups.map((group) => {
      const mode = modes[group.code];
      const pickupLocationId =
        mode === "pickup" ? (pickupLocations[group.code] ?? null) : null;
      return { supplierCode: group.code, mode, pickupLocationId };
    });
    if (
      supplierModes.some(
        (choice) => choice.mode === "pickup" && !choice.pickupLocationId,
      )
    ) {
      setNotice("Escolha o local de retirada para cada fornecedor.");
      return;
    }
    const idempotency = requestId.current;
    if (!idempotency) {
      setNotice("Não foi possível preparar a solicitação. Tente novamente.");
      return;
    }
    startTransition(async () => {
      try {
        const address = {
          postalCode: verifiedCep.postalCode,
          floor: currentFloor,
          number: number.trim(),
          complement: complement.trim(),
        };
        const requestFingerprint = await getQuoteRequestFingerprint({
          cart: items,
          supplierModes,
          address,
          verifiedCep,
        });
        const payload = {
          requestId: idempotency.get(requestFingerprint),
          supplierModes,
          address,
        };
        const result = await createCustomerLogisticsQuote(payload);
        if (result.status === "ok") {
          requestId.current?.clear();
          setCreatedQuote({
            id: result.quoteId,
            whatsappUrl: result.whatsappUrl,
          });
          setNotice(
            "Solicitação registrada. Ela não cria pedido nem pagamento.",
          );
          return;
        }
        if (
          result.status === "cart_changed" ||
          result.status === "request_changed"
        ) {
          requestId.current?.clear();
          setCreatedQuote(null);
          if (result.status === "cart_changed") router.refresh();
        }
        setNotice(result.message);
      } catch {
        setNotice(
          "Não foi possível concluir agora. Tente novamente mantendo os mesmos dados.",
        );
      }
    });
  }

  if (!items.length) return null;
  if (!logistics) {
    return (
      <section className={styles.panel} aria-labelledby="logistics-title">
        <div className={styles.panelHeading}>
          <Truck aria-hidden="true" />
          <div>
            <p className={styles.eyebrow}>ENTREGA E RETIRADA</p>
            <h2 id="logistics-title">Logística indisponível</h2>
          </div>
        </div>
        <p>
          Não foi possível carregar as opções logísticas neste ambiente. O
          carrinho permanece disponível.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="logistics-title">
      <div className={styles.panelHeading}>
        <Truck aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>ENTREGA E RETIRADA</p>
          <h2 id="logistics-title">Como prefere receber?</h2>
        </div>
      </div>
      {hasUnknownItems ? (
        <p className={styles.warning} role="status">
          Há item sem fornecedor ou logística confirmada. Não será possível
          solicitar logística para o carrinho até que os dados estejam
          disponíveis.
        </p>
      ) : null}
      <form onSubmit={submitQuote}>
        <div className={styles.supplierGroups}>
          {initialGroups.map((group) => {
            const locations = logistics.pickupLocations.filter(
              (location) => location.supplierCode === group.code,
            );
            return (
              <fieldset className={styles.supplierGroup} key={group.code}>
                <legend>{group.name}</legend>
                <p>
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "produto" : "produtos"} deste
                  fornecedor
                </p>
                <div className={styles.modeChoices}>
                  {group.modes.map((mode) => (
                    <label className={styles.modeChoice} key={mode}>
                      <input
                        type="radio"
                        name={`mode-${group.code}`}
                        value={mode}
                        checked={modes[group.code] === mode}
                        disabled={pending || !groupsReady}
                        onChange={() => {
                          setModes((current) => ({
                            ...current,
                            [group.code]: mode,
                          }));
                          resetRequest();
                        }}
                      />
                      <span>
                        {mode === "delivery" ? "Entrega" : "Retirada"}
                      </span>
                    </label>
                  ))}
                </div>
                {modes[group.code] === "pickup" ? (
                  locations.length ? (
                    <label className={styles.field}>
                      Local de retirada
                      <select
                        required
                        value={pickupLocations[group.code] ?? ""}
                        onChange={(event) => {
                          setPickupLocations((current) => ({
                            ...current,
                            [group.code]: event.target.value,
                          }));
                          resetRequest();
                        }}
                      >
                        <option value="">Selecione um local</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {pickupLabel(location)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className={styles.warning}>
                      Nenhum local de retirada ativo foi informado.
                    </p>
                  )
                ) : null}
              </fieldset>
            );
          })}
        </div>

        {hasDelivery ? (
          <div className={styles.addressBlock}>
            <h3>
              <MapPin size={17} /> Endereço para cotação
            </h3>
            <div className={styles.cepRow}>
              <label className={styles.field}>
                CEP
                <input
                  autoComplete="postal-code"
                  inputMode="numeric"
                  value={postalCode}
                  maxLength={9}
                  placeholder="00000-000"
                  onChange={(event) => {
                    setPostalCode(event.target.value);
                    setCepStatus("idle");
                    setVerifiedCep(null);
                    resetRequest();
                  }}
                />
              </label>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => void verifyPostalCode()}
                disabled={cepStatus === "checking" || pending}
              >
                {cepStatus === "checking" ? "Consultando…" : "Consultar CEP"}
              </button>
            </div>
            {cepStatus === "found" && verifiedCep ? (
              <p
                className={deliveryArea ? styles.verified : styles.warning}
                role="status"
              >
                {deliveryArea ? (
                  <>
                    <CheckCircle2 size={16} /> {verifiedCep.city}/
                    {verifiedCep.state} — CEP confirmado e área atendida.
                  </>
                ) : (
                  <>
                    CEP confirmado para {verifiedCep.city}/{verifiedCep.state},
                    mas o município ainda não está na área de entrega.
                  </>
                )}
              </p>
            ) : null}
            {cepStatus === "not_found" ? (
              <p className={styles.warning} role="status">
                CEP não encontrado. Confira os números.
              </p>
            ) : null}
            {cepStatus === "unavailable" ? (
              <p className={styles.warning} role="status">
                Consulta de CEP indisponível. Não é possível enviar a cotação
                agora.
              </p>
            ) : null}
            {cepStatus === "invalid" ? (
              <p className={styles.warning} role="status">
                Informe um CEP válido com oito dígitos.
              </p>
            ) : null}
            <div className={styles.addressFields}>
              <label className={styles.field}>
                Número
                <input
                  autoComplete="address-line2"
                  value={number}
                  maxLength={80}
                  onChange={(event) => {
                    setNumber(event.target.value);
                    resetRequest();
                  }}
                  required
                />
              </label>
              <label className={styles.field}>
                Andar
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={floor}
                  onChange={(event) => {
                    setFloor(event.target.value);
                    resetRequest();
                  }}
                  aria-describedby="floor-charge-note"
                  required
                />
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                Complemento (opcional)
                <input
                  autoComplete="address-line2"
                  value={complement}
                  maxLength={120}
                  onChange={(event) => {
                    setComplement(event.target.value);
                    resetRequest();
                  }}
                />
              </label>
            </div>
            <p className={styles.floorCharge} id="floor-charge-note">
              Adicional por andar, uma vez por endereço:{" "}
              {feeIsSupported
                ? formatBrl(floorChargeCents)
                : "fora do limite monetário suportado"}
              .
            </p>
            <p className={styles.finePrint}>
              Os prazos são informados em dias úteis após a confirmação do
              pagamento. Esta etapa apenas solicita uma cotação; não cria pedido
              nem pagamento.
            </p>
          </div>
        ) : (
          <p className={styles.finePrint}>
            A retirada não gera solicitação de frete nem pedido. Confira o local
            escolhido antes de prosseguir.
          </p>
        )}

        <div className={styles.submitRow}>
          {hasDelivery ? (
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={
                pending || !groupsReady || !deliveryArea || !feeIsSupported
              }
            >
              {pending
                ? "Enviando solicitação…"
                : "Solicitar cotação de entrega"}
              <ArrowRight size={17} />
            </button>
          ) : null}
          <span role="status" aria-live="polite">
            {notice}
          </span>
        </div>
      </form>
      {createdQuote ? (
        <div className={styles.success} role="status">
          <strong>Solicitação registrada</strong>
          <p>
            Referência {createdQuote.id.slice(0, 8)}. Acompanhe a resposta em
            Minhas entregas.
          </p>
          <div className={styles.successLinks}>
            <Link href="/conta/entregas">
              Ver minhas entregas <ArrowRight size={15} />
            </Link>
            {createdQuote.whatsappUrl ? (
              <a
                href={createdQuote.whatsappUrl}
                target="_blank"
                rel="noreferrer"
              >
                Falar sobre a cotação
              </a>
            ) : (
              <span>
                Contato por WhatsApp indisponível; sua solicitação continua
                registrada.
              </span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
