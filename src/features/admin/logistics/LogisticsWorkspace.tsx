"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { ArrowRight, Check, CircleAlert, Search } from "lucide-react";
import {
  assignProductSupplier,
  saveLogisticsPickupLocation,
  searchIbgeMunicipalities,
  setLogisticsArea,
  setLogisticsGroupFreight,
  updateLogisticsSettings,
  updateLogisticsSupplier,
} from "./actions";
import { LogisticsActionForm } from "./LogisticsActionForm";
import type {
  LogisticsArea,
  LogisticsLoadResult,
  LogisticsOverview,
  LogisticsPageSection,
  LogisticsProduct,
  LogisticsQuote,
  LogisticsReadIssue,
  LogisticsSettings,
  LogisticsSupplier,
} from "./types";
import styles from "./logistics.module.css";

type WorkspaceData =
  | LogisticsOverview
  | LogisticsSupplier[]
  | LogisticsArea[]
  | LogisticsProduct[]
  | LogisticsQuote[];
type ActionResult = { ok: true } | { ok: false; message: string };
type LogisticsAction = (input: unknown) => Promise<ActionResult>;
type Municipality = {
  ibgeCode: string;
  cityName: string;
  stateCode: "SP";
  approved: boolean;
};

const sectionCopy: Record<
  LogisticsPageSection,
  { title: string; description: string }
> = {
  overview: {
    title: "Operação de entregas",
    description:
      "Acompanhe solicitações, cobertura e fornecedores a partir dos dados operacionais cadastrados.",
  },
  requests: {
    title: "Solicitações de frete",
    description:
      "Revise os grupos por fornecedor e informe somente o frete-base negociado. O adicional por andar é calculado no servidor.",
  },
  areas: {
    title: "Áreas atendidas",
    description:
      "Consulte municípios na fonte oficial do IBGE e habilite somente áreas aprovadas para a operação.",
  },
  suppliers: {
    title: "Fornecedores",
    description:
      "Mantenha modalidades, prazos operacionais e observações confirmadas para Vale e Mundial.",
  },
  products: {
    title: "Produtos e logística",
    description:
      "Atribua cada produto manualmente. Nenhum fornecedor é inferido por nome, categoria ou preço.",
  },
  pickup: {
    title: "Locais de retirada",
    description:
      "Consulte, cadastre e atualize manualmente endereços de retirada confirmados, incluindo seu estado de ativação.",
  },
  settings: {
    title: "Configurações de entrega",
    description:
      "Configure o adicional por andar e os campos opcionais sem preencher valores comerciais não confirmados.",
  },
};

const quoteStatuses = [
  "awaiting_quote",
  "quoted",
  "accepted",
  "rejected",
  "cancelled",
  "invalidated",
  "expired",
] as const;

function formatMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "A informar";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatMoneyInput(cents: number | null) {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não disponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_quote: "Aguardando cotação",
    quoted: "Cotado · aguardando cliente",
    accepted: "Aceita pelo cliente",
    rejected: "Recusada pelo cliente",
    cancelled: "Cancelada",
    invalidated: "Invalidada",
    expired: "Expirada",
    quoted_group: "Cotado",
    awaiting_group: "Aguardando frete",
    active: "Ativo",
    draft: "Rascunho",
    published: "Publicado",
    archived: "Arquivado",
  };
  return labels[status] ?? status;
}

function useMutationFeedback() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function run(action: LogisticsAction, input: unknown) {
    setFeedback(null);
    startTransition(() => {
      void action(input)
        .then((result) => {
          setFeedback(result);
          if (result.ok) router.refresh();
        })
        .catch(() =>
          setFeedback({
            ok: false,
            message: "Ocorreu um erro de comunicação. Tente novamente.",
          }),
        );
    });
  }

  return { pending, feedback, run };
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={result.ok ? styles.successMessage : styles.errorMessage}
      role={result.ok ? "status" : "alert"}
    >
      {result.ok ? (
        <Check size={15} aria-hidden="true" />
      ) : (
        <CircleAlert size={15} aria-hidden="true" />
      )}
      {result.ok ? "Alteração salva." : result.message}
    </p>
  );
}

function DataUnavailable({
  reason,
}: {
  reason: "rpc_missing" | "query_failed" | "shape_mismatch";
}) {
  const messages = {
    rpc_missing:
      "A consulta administrativa ainda não está disponível no banco conectado. Nenhuma contagem foi substituída por valores fictícios.",
    query_failed:
      "Não foi possível consultar os dados de logística agora. Tente atualizar a página.",
    shape_mismatch:
      "A resposta da RPC diverge do contrato esperado. Os dados foram ocultados para evitar exibir informações incorretas.",
  };
  return (
    <div className={styles.unavailable} role="status">
      <CircleAlert size={19} aria-hidden="true" />
      <p>{messages[reason]}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value.toLocaleString("pt-BR")}</strong>
      <small>{detail}</small>
    </article>
  );
}

function OverviewPanel({ data }: { data: LogisticsOverview }) {
  const settings = data.settings;
  return (
    <>
      <section className={styles.metrics} aria-label="Indicadores operacionais">
        <MetricCard
          label="Solicitações abertas"
          value={data.open_quote_count}
          detail="Cotações em andamento"
        />
        <MetricCard
          label="Produtos sem fornecedor"
          value={data.unassigned_product_count}
          detail={`de ${data.product_count} produtos cadastrados`}
        />
        <MetricCard
          label="Áreas habilitadas"
          value={data.enabled_area_count}
          detail="Cobertura registrada no sistema"
        />
        <MetricCard
          label="Fornecedores ativos"
          value={data.active_supplier_count}
          detail={`de ${data.supplier_count} fornecedores`}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Acompanhamento</span>
            <h2>Solicitações por status</h2>
          </div>
          <Link className={styles.textLink} href="/admin/entregas/solicitacoes">
            Abrir solicitações <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.statusGrid}>
          {quoteStatuses.map((status) => (
            <div className={styles.statusItem} key={status}>
              <span>{statusLabel(status)}</span>
              <strong>
                {(data.quote_counts[status] ?? 0).toLocaleString("pt-BR")}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Condições atuais</span>
            <h2>Regras registradas</h2>
          </div>
          <Link
            className={styles.textLink}
            href="/admin/entregas/configuracoes"
          >
            Configurar <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.ruleGrid}>
          <div>
            <span>Adicional por andar</span>
            <strong>{formatMoney(settings.floor_charge_cents)}</strong>
          </div>
          <div>
            <span>Andares incluídos</span>
            <strong>Até o {settings.included_through_floor}º</strong>
          </div>
          <div>
            <span>Validade da cotação</span>
            <strong>
              {settings.quote_expiration_minutes === null
                ? "Não definida"
                : `${settings.quote_expiration_minutes} min`}
            </strong>
          </div>
          <div>
            <span>WhatsApp oficial</span>
            <strong>{settings.whatsapp_phone_e164 ?? "Não configurado"}</strong>
          </div>
        </div>
        {settings.multi_delivery_policy_status === "pending" && (
          <p className={styles.note}>
            A política de múltiplas entregas ainda está pendente; este painel
            não habilita checkout.
          </p>
        )}
      </section>
    </>
  );
}

function ProductAssignmentForm({
  product,
  suppliers,
}: {
  product: LogisticsProduct;
  suppliers: LogisticsSupplier[];
}) {
  const { pending, feedback, run } = useMutationFeedback();
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supplierId = String(form.get("supplierId") ?? "");
    run(assignProductSupplier, {
      productId: product.product_id,
      supplierId: supplierId || null,
    });
  }

  return (
    <form className={styles.assignmentForm} onSubmit={handleSubmit}>
      <label
        className={styles.srOnly}
        htmlFor={`supplier-${product.product_id}`}
      >
        Fornecedor de {product.name}
      </label>
      <select
        defaultValue={product.supplier_id ?? ""}
        disabled={pending || suppliers.length === 0}
        id={`supplier-${product.product_id}`}
        name="supplierId"
      >
        <option value="">Sem fornecedor</option>
        {suppliers.map((supplier) => (
          <option
            disabled={!supplier.is_active}
            key={supplier.supplier_id}
            value={supplier.supplier_id}
          >
            {supplier.display_name}
            {supplier.is_active ? "" : " · inativo"}
          </option>
        ))}
      </select>
      <button
        className={styles.secondaryButton}
        disabled={pending || suppliers.length === 0}
        type="submit"
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <Feedback result={feedback} />
    </form>
  );
}

function ProductsPanel({
  products,
  suppliers,
}: {
  products: LogisticsProduct[];
  suppliers: LogisticsSupplier[] | null;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = products.filter((product) =>
    `${product.name} ${product.slug} ${product.category_name} ${product.supplier_code ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalized),
  );
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>
            {products.length.toLocaleString("pt-BR")} produtos
          </span>
          <h2>Atribuição manual de fornecedor</h2>
        </div>
        <label className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <span className={styles.srOnly}>Buscar produtos</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar produto ou categoria"
            value={query}
          />
        </label>
      </div>
      {suppliers === null && (
        <p className={styles.inlineWarning}>
          Não foi possível carregar fornecedores; atribuições estão
          desabilitadas.
        </p>
      )}
      {filtered.length === 0 ? (
        <p className={styles.emptyState}>Nenhum produto corresponde à busca.</p>
      ) : (
        <div className={styles.productList}>
          {filtered.map((product) => (
            <article className={styles.productRow} key={product.product_id}>
              <div className={styles.productCopy}>
                <h3>{product.name}</h3>
                <p>
                  {product.category_name} <span>·</span>{" "}
                  {statusLabel(product.status)}
                </p>
                <small>
                  {product.active_variant_count} de {product.variant_count}{" "}
                  variantes ativas
                </small>
              </div>
              {suppliers ? (
                <ProductAssignmentForm
                  product={product}
                  suppliers={suppliers}
                />
              ) : (
                <span className={styles.muted}>Indisponível</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AreaToggle({ area }: { area: LogisticsArea }) {
  const { pending, feedback, run } = useMutationFeedback();
  return (
    <div className={styles.areaAction}>
      <span
        className={area.is_enabled ? styles.enabledTag : styles.disabledTag}
      >
        {area.is_enabled ? "Habilitada" : "Desabilitada"}
      </span>
      <button
        className={
          area.is_enabled ? styles.secondaryButton : styles.primaryButton
        }
        disabled={pending}
        onClick={() =>
          run(setLogisticsArea, {
            ibgeCode: area.ibge_code,
            cityName: area.city_name,
            enabled: !area.is_enabled,
          })
        }
        type="button"
      >
        {pending ? "Salvando…" : area.is_enabled ? "Desabilitar" : "Habilitar"}
      </button>
      <Feedback result={feedback} />
    </div>
  );
}

function AreasPanel({ areas }: { areas: LogisticsArea[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Municipality[] | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const indexed = new Map(areas.map((area) => [area.ibge_code, area]));

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchMessage(null);
    startTransition(() => {
      void searchIbgeMunicipalities({ query })
        .then((result) => {
          if (!result.ok) {
            setResults([]);
            setSearchMessage(
              "A consulta oficial do IBGE está indisponível. Tente novamente mais tarde.",
            );
            return;
          }
          setResults([...result.municipalities]);
          if (result.municipalities.length === 0)
            setSearchMessage(
              "Nenhum município paulista encontrado para esta busca.",
            );
        })
        .catch(() => {
          setResults([]);
          setSearchMessage("Não foi possível consultar o IBGE agora.");
        });
    });
  }

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Fonte oficial · IBGE</span>
            <h2>Buscar município</h2>
          </div>
        </div>
        <form className={styles.lookupForm} onSubmit={search}>
          <label className={styles.srOnly} htmlFor="ibge-city-search">
            Nome do município
          </label>
          <input
            id="ibge-city-search"
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: Taubaté"
            value={query}
          />
          <button
            className={styles.primaryButton}
            disabled={pending || query.trim().length < 2}
            type="submit"
          >
            <Search size={16} aria-hidden="true" />{" "}
            {pending ? "Consultando…" : "Buscar no IBGE"}
          </button>
        </form>
        <p className={styles.note}>
          A busca consulta municípios de SP no IBGE. A habilitação continua
          restrita às cidades já aprovadas para cobertura.
        </p>
        {searchMessage && (
          <p className={styles.inlineWarning} role="status">
            {searchMessage}
          </p>
        )}
        {results && results.length > 0 && (
          <div className={styles.searchResults}>
            {results.map((municipality) => {
              const existing = indexed.get(municipality.ibgeCode);
              if (existing)
                return (
                  <article
                    className={styles.areaRow}
                    key={municipality.ibgeCode}
                  >
                    <div>
                      <h3>
                        {municipality.cityName} <small>SP</small>
                      </h3>
                      <p>Código IBGE {municipality.ibgeCode}</p>
                    </div>
                    <AreaToggle area={existing} />
                  </article>
                );
              return (
                <article className={styles.areaRow} key={municipality.ibgeCode}>
                  <div>
                    <h3>
                      {municipality.cityName} <small>SP</small>
                    </h3>
                    <p>Código IBGE {municipality.ibgeCode}</p>
                  </div>
                  {municipality.approved ? (
                    <NewAreaToggle municipality={municipality} />
                  ) : (
                    <span className={styles.muted}>
                      Ainda não aprovado para cobertura
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>
              {areas.filter((area) => area.is_enabled).length} habilitadas
            </span>
            <h2>Municípios cadastrados</h2>
          </div>
        </div>
        {areas.length === 0 ? (
          <p className={styles.emptyState}>
            A consulta não retornou áreas cadastradas.
          </p>
        ) : (
          <div className={styles.productList}>
            {areas.map((area) => (
              <article className={styles.areaRow} key={area.ibge_code}>
                <div>
                  <h3>
                    {area.city_name} <small>{area.state_code}</small>
                  </h3>
                  <p>
                    IBGE {area.ibge_code} · origem {area.source} ·{" "}
                    {area.pickup_location_count} locais de retirada
                  </p>
                </div>
                <AreaToggle area={area} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function NewAreaToggle({ municipality }: { municipality: Municipality }) {
  const { pending, feedback, run } = useMutationFeedback();
  return (
    <div className={styles.areaAction}>
      <span className={styles.disabledTag}>Desabilitada</span>
      <button
        className={styles.primaryButton}
        disabled={pending}
        onClick={() =>
          run(setLogisticsArea, {
            ibgeCode: municipality.ibgeCode,
            cityName: municipality.cityName,
            enabled: true,
          })
        }
        type="button"
      >
        {pending ? "Salvando…" : "Habilitar área"}
      </button>
      <Feedback result={feedback} />
    </div>
  );
}

function SupplierForm({ supplier }: { supplier: LogisticsSupplier }) {
  const { pending, feedback, run } = useMutationFeedback();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(updateLogisticsSupplier, {
      code: supplier.code,
      supplierId: supplier.supplier_id,
      displayName: String(form.get("displayName") ?? ""),
      isActive: form.get("isActive") === "on",
      allowsDelivery: form.get("allowsDelivery") === "on",
      allowsPickup: form.get("allowsPickup") === "on",
      leadMinBusinessDays: String(form.get("leadMinBusinessDays") ?? ""),
      leadMaxBusinessDays: String(form.get("leadMaxBusinessDays") ?? ""),
      deliveryQuoteRequired: form.get("deliveryQuoteRequired") === "on",
      adminNotes: String(form.get("adminNotes") ?? ""),
    });
  }
  return (
    <article className={styles.supplierCard}>
      <div className={styles.supplierHeading}>
        <div>
          <span className={styles.eyebrow}>Fornecedor {supplier.code}</span>
          <h2>{supplier.display_name}</h2>
        </div>
        <span
          className={
            supplier.is_active ? styles.enabledTag : styles.disabledTag
          }
        >
          {supplier.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>
      <p className={styles.note}>
        {supplier.assigned_product_count} produtos atribuídos · prazos contados
        após confirmação do pagamento.
      </p>
      <form className={styles.settingsForm} onSubmit={submit}>
        <label className={styles.field}>
          <span>Nome de exibição</span>
          <input
            defaultValue={supplier.display_name}
            maxLength={80}
            name="displayName"
            required
          />
        </label>
        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>Prazo mínimo (dias úteis)</span>
            <input
              defaultValue={supplier.lead_min_business_days}
              max={2147483647}
              min={0}
              name="leadMinBusinessDays"
              type="number"
            />
          </label>
          <label className={styles.field}>
            <span>Prazo máximo (dias úteis)</span>
            <input
              defaultValue={supplier.lead_max_business_days}
              max={2147483647}
              min={0}
              name="leadMaxBusinessDays"
              type="number"
            />
          </label>
        </div>
        <div className={styles.checkGrid}>
          <label>
            <input
              defaultChecked={supplier.is_active}
              name="isActive"
              type="checkbox"
            />{" "}
            Fornecedor ativo
          </label>
          <label>
            <input
              defaultChecked={supplier.allows_delivery}
              name="allowsDelivery"
              type="checkbox"
            />{" "}
            Permite entrega
          </label>
          {supplier.code === "VALE" && (
            <label>
              <input
                defaultChecked={supplier.allows_pickup}
                name="allowsPickup"
                type="checkbox"
              />{" "}
              Permite retirada
            </label>
          )}
          {supplier.code === "MUNDIAL" && (
            <p className={styles.note}>Mundial opera somente com entrega.</p>
          )}
          <label>
            <input
              defaultChecked={supplier.delivery_quote_required}
              name="deliveryQuoteRequired"
              type="checkbox"
            />{" "}
            Entrega exige cotação
          </label>
        </div>
        <label className={styles.field}>
          <span>Observações administrativas</span>
          <textarea
            defaultValue={supplier.admin_notes ?? ""}
            maxLength={2000}
            name="adminNotes"
            rows={3}
          />
        </label>
        <div className={styles.supplierFooter}>
          <span>
            Prazo inicia em:{" "}
            {supplier.lead_time_starts_on === "payment_confirmed"
              ? "pagamento confirmado"
              : supplier.lead_time_starts_on}
          </span>
          <button
            className={styles.primaryButton}
            disabled={pending}
            type="submit"
          >
            {pending ? "Salvando…" : "Salvar fornecedor"}
          </button>
        </div>
        <Feedback result={feedback} />
      </form>
      {supplier.pickup_locations.length > 0 && (
        <div className={styles.pickupBlock}>
          <h3>Locais de retirada cadastrados</h3>
          {supplier.pickup_locations.map((location) => (
            <p key={location.pickup_location_id}>
              {location.display_name} · {location.street},{" "}
              {location.street_number} · {location.neighborhood},{" "}
              {location.city_name}/{location.state_code} · CEP{" "}
              {location.postal_code}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

function SuppliersPanel({ suppliers }: { suppliers: LogisticsSupplier[] }) {
  return suppliers.length === 0 ? (
    <p className={styles.emptyState}>Nenhum fornecedor cadastrado.</p>
  ) : (
    <div className={styles.supplierList}>
      {suppliers.map((supplier) => (
        <SupplierForm key={supplier.supplier_id} supplier={supplier} />
      ))}
    </div>
  );
}

function PickupLocationForm({
  supplier,
  areas,
  location,
}: {
  supplier: LogisticsSupplier;
  areas: LogisticsArea[];
  location?: LogisticsSupplier["pickup_locations"][number];
}) {
  const eligibleAreas = areas.filter((area) => area.state_code === "SP");
  return (
    <LogisticsActionForm
      action={saveLogisticsPickupLocation}
      booleanFields={["isActive"]}
      className={styles.pickupEditor}
      successMessage={
        location ? "Local de retirada atualizado." : "Local de retirada criado."
      }
    >
      <input
        name="pickupLocationId"
        type="hidden"
        value={location?.pickup_location_id ?? ""}
      />
      <input name="supplierId" type="hidden" value={supplier.supplier_id} />
      <div className={`${styles.pickupIdentity} ${styles.spanFull}`}>
        <strong>
          {location
            ? `Editar ${location.display_name}`
            : "Novo local confirmado"}
        </strong>
        <span>
          {supplier.display_name} · {supplier.code}
          {location ? " · fornecedor não pode ser alterado" : ""}
        </span>
      </div>
      <label className={styles.field}>
        <span>Código interno</span>
        <input
          defaultValue={location?.location_code ?? ""}
          maxLength={64}
          name="locationCode"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Nome do local</span>
        <input
          defaultValue={location?.display_name ?? ""}
          maxLength={120}
          name="displayName"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Rua</span>
        <input
          defaultValue={location?.street ?? ""}
          maxLength={160}
          name="street"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Número</span>
        <input
          defaultValue={location?.street_number ?? ""}
          maxLength={40}
          name="streetNumber"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Bairro</span>
        <input
          defaultValue={location?.neighborhood ?? ""}
          maxLength={120}
          name="neighborhood"
          required
        />
      </label>
      <label className={styles.field}>
        <span>CEP</span>
        <input
          autoComplete="postal-code"
          defaultValue={location?.postal_code ?? ""}
          inputMode="numeric"
          maxLength={9}
          name="postalCode"
          placeholder="00000-000"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Município aprovado</span>
        <select
          defaultValue={location?.ibge_code ?? ""}
          name="ibgeCode"
          required
        >
          <option disabled value="">
            Selecione um município
          </option>
          {eligibleAreas.map((area) => (
            <option key={area.ibge_code} value={area.ibge_code}>
              {area.city_name} · IBGE {area.ibge_code}
            </option>
          ))}
        </select>
      </label>
      <label className={`${styles.checkField} ${styles.spanFull}`}>
        <input
          defaultChecked={location?.is_active ?? false}
          name="isActive"
          type="checkbox"
        />
        <span>Local ativo para retirada</span>
      </label>
      <div className={`${styles.formActions} ${styles.spanFull}`}>
        <button className={styles.primaryButton} type="submit">
          {location ? "Salvar alterações" : "Cadastrar local confirmado"}
        </button>
        <p>
          Cadastre somente endereços efetivamente confirmados pela loja. A
          ativação também exige fornecedor habilitado para retirada.
        </p>
      </div>
    </LogisticsActionForm>
  );
}

function PickupLocationsPanel({
  suppliers,
  areas,
  areaIssue,
}: {
  suppliers: LogisticsSupplier[];
  areas: LogisticsArea[] | null;
  areaIssue?: LogisticsReadIssue;
}) {
  const locations = suppliers.flatMap((supplier) =>
    supplier.pickup_locations.map((location) => ({ supplier, location })),
  );
  const pickupSuppliers = suppliers.filter(
    (supplier) => supplier.is_active && supplier.allows_pickup,
  );

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>Ponto de retirada cadastrado</span>
          <h2>Galpão</h2>
        </div>
      </div>
      <p className={styles.note}>
        O endereço existente vem do cadastro aprovado. Novos locais só são
        gravados após preenchimento explícito e validação; nenhum outro endereço
        é presumido.
      </p>
      {areas ? (
        <>
          {pickupSuppliers.length > 0 ? (
            <div className={styles.pickupCreate}>
              <h3>Cadastrar outro endereço confirmado</h3>
              {pickupSuppliers.map((supplier) => (
                <PickupLocationForm
                  areas={areas}
                  key={supplier.supplier_id}
                  supplier={supplier}
                />
              ))}
            </div>
          ) : (
            <p className={styles.note}>
              Não há fornecedor ativo habilitado para retirada; nenhum novo
              local pode ser ativado.
            </p>
          )}
          <div className={styles.pickupList}>
            <h3>Locais cadastrados</h3>
            {locations.length === 0 ? (
              <p className={styles.emptyState}>
                A RPC não retornou locais cadastrados. Nenhum endereço foi
                criado ou presumido pela interface.
              </p>
            ) : (
              locations.map(({ supplier, location }) => (
                <article
                  className={styles.pickupCard}
                  key={location.pickup_location_id}
                >
                  <div className={styles.pickupRow}>
                    <div>
                      <strong>{location.display_name}</strong>
                      <span>
                        {supplier.display_name} · {supplier.code}
                      </span>
                    </div>
                    <address>
                      {location.street}, {location.street_number}
                      <br />
                      {location.neighborhood} · {location.city_name}/
                      {location.state_code}
                      <br />
                      CEP {location.postal_code}
                    </address>
                    <span
                      className={
                        location.is_active
                          ? styles.enabledTag
                          : styles.disabledTag
                      }
                    >
                      {location.is_active ? "Ativo" : "Inativo"}
                    </span>
                    <small>
                      Código {location.location_code} · IBGE{" "}
                      {location.ibge_code}
                    </small>
                  </div>
                  <PickupLocationForm
                    areas={areas}
                    location={location}
                    supplier={supplier}
                  />
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <DataUnavailable reason={areaIssue ?? "query_failed"} />
          <p className={styles.note}>
            Edição e cadastro estão temporariamente indisponíveis porque a lista
            administrativa de municípios não pôde ser carregada.
          </p>
          {locations.map(({ supplier, location }) => (
            <article
              className={styles.pickupCard}
              key={location.pickup_location_id}
            >
              <div className={styles.pickupRow}>
                <strong>{location.display_name}</strong>
                <span>
                  {supplier.display_name} · {location.street},{" "}
                  {location.street_number}, {location.neighborhood},{" "}
                  {location.city_name}/{location.state_code} · CEP{" "}
                  {location.postal_code}
                </span>
                <small>
                  {location.is_active ? "Ativo" : "Inativo"} ·{" "}
                  {location.location_code}
                </small>
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

function QuoteGroupCard({
  quote,
  group,
}: {
  quote: LogisticsQuote;
  group: LogisticsQuote["groups"][number];
}) {
  const { pending, feedback, run } = useMutationFeedback();
  const canSetBaseFreight =
    group.fulfillment_mode === "delivery" &&
    (group.status === "awaiting_quote" || group.status === "quoted") &&
    (quote.status === "awaiting_quote" || quote.status === "quoted");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(setLogisticsGroupFreight, {
      quoteId: quote.quote_id,
      supplierCode: group.supplier_code,
      baseFreight: String(form.get("baseFreight") ?? ""),
    });
  }
  return (
    <div className={styles.quoteGroup}>
      <div className={styles.quoteGroupHeading}>
        <div>
          <strong>{group.supplier_code === "VALE" ? "Vale" : "Mundial"}</strong>
          <span>
            {group.fulfillment_mode === "delivery" ? "Entrega" : "Retirada"} ·{" "}
            {statusLabel(
              group.status === "quoted" ? "quoted_group" : "awaiting_group",
            )}
          </span>
        </div>
        <span className={styles.money}>
          {formatMoney(group.base_freight_cents)}
        </span>
      </div>
      <ul className={styles.quoteItems}>
        {group.items.map((item) => (
          <li key={item.variant_id}>
            <span>
              {item.product_name}
              <small>
                Variante{" "}
                {Object.entries(item.variant)
                  .filter(
                    ([, value]) =>
                      value !== null &&
                      ["string", "number"].includes(typeof value),
                  )
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .slice(0, 3)
                  .join(" · ")}
              </small>
            </span>
            <span>× {item.quantity}</span>
          </li>
        ))}
      </ul>
      {canSetBaseFreight && (
        <form className={styles.freightForm} onSubmit={submit}>
          <label className={styles.field}>
            <span>Frete-base informado pelo vendedor</span>
            <div className={styles.currencyInput}>
              <span>R$</span>
              <input
                autoComplete="off"
                defaultValue={formatMoneyInput(group.base_freight_cents)}
                inputMode="decimal"
                name="baseFreight"
                placeholder="0,00"
                required
              />
            </div>
          </label>
          <button
            className={styles.primaryButton}
            disabled={pending}
            type="submit"
          >
            {pending
              ? "Salvando…"
              : group.status === "quoted"
                ? "Atualizar frete-base"
                : "Salvar frete-base"}
          </button>
          <Feedback result={feedback} />
        </form>
      )}
      {group.fulfillment_mode === "delivery" && (
        <p className={styles.note}>
          O adicional por andar ({formatMoney(quote.floor_charge_cents)}) é
          calculado pelo servidor e não pode ser editado aqui.
        </p>
      )}
    </div>
  );
}

function RequestsPanel({ quotes }: { quotes: LogisticsQuote[] }) {
  const [status, setStatus] = useState("all");
  const filtered =
    status === "all"
      ? quotes
      : quotes.filter((quote) => quote.status === status);
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.eyebrow}>
            {quotes.length.toLocaleString("pt-BR")} solicitações
          </span>
          <h2>Fila de cotação</h2>
        </div>
        <label className={styles.filterField}>
          <span>Filtrar status</span>
          <select
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">Todos</option>
            {quoteStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className={styles.emptyState}>
          Não há solicitações para este filtro.
        </p>
      ) : (
        <div className={styles.quoteList}>
          {filtered.map((quote) => (
            <article className={styles.quoteCard} key={quote.quote_id}>
              <header className={styles.quoteHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    Solicitação · {quote.quote_id.slice(0, 8)}
                  </span>
                  <h3>{statusLabel(quote.status)}</h3>
                  <p>Recebida em {formatDate(quote.created_at)}</p>
                </div>
                <span className={styles.statusPill}>
                  {statusLabel(quote.status)}
                </span>
              </header>
              {quote.delivery_address && (
                <div className={styles.destination}>
                  <strong>
                    {quote.delivery_address.city_name}/
                    {quote.delivery_address.state_code}
                  </strong>
                  <span>
                    CEP {quote.delivery_address.postal_code} ·{" "}
                    {quote.delivery_address.street},{" "}
                    {quote.delivery_address.number}
                    {quote.delivery_address.complement
                      ? `, ${quote.delivery_address.complement}`
                      : ""}
                  </span>
                  <span>
                    {quote.delivery_address.neighborhood} ·{" "}
                    {quote.delivery_address.floor_number === 0
                      ? "Térreo"
                      : `${quote.delivery_address.floor_number}º andar`}
                  </span>
                </div>
              )}
              <div className={styles.quoteGroups}>
                {quote.groups.map((group) => (
                  <QuoteGroupCard
                    group={group}
                    key={group.group_id}
                    quote={quote}
                  />
                ))}
              </div>
              <footer className={styles.quoteFooter}>
                <span>Adicional por andar calculado pelo servidor</span>
                <strong>{formatMoney(quote.floor_charge_cents)}</strong>
                <span>
                  {quote.quote_expires_at
                    ? `Validade ${formatDate(quote.quote_expires_at)}`
                    : "Validade não definida"}
                </span>
              </footer>
              <p className={styles.note}>
                A resposta de aceite ou recusa pertence ao cliente e não pode
                ser registrada neste painel.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsPanel({ settings }: { settings: LogisticsSettings }) {
  const { pending, feedback, run } = useMutationFeedback();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(updateLogisticsSettings, {
      floorCharge: String(form.get("floorCharge") ?? ""),
      includedThroughFloor: String(form.get("includedThroughFloor") ?? ""),
      quoteExpirationMinutes: String(form.get("quoteExpirationMinutes") ?? ""),
      whatsappPhoneE164: String(form.get("whatsappPhoneE164") ?? ""),
    });
  }
  return (
    <section className={styles.panel}>
      <form className={styles.settingsForm} onSubmit={submit}>
        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>Adicional por andar (reais)</span>
            <div className={styles.currencyInput}>
              <span>R$</span>
              <input
                defaultValue={formatMoneyInput(settings.floor_charge_cents)}
                inputMode="decimal"
                name="floorCharge"
                placeholder="0,00"
                required
              />
            </div>
            <small>O cálculo final acontece exclusivamente no servidor.</small>
          </label>
          <label className={styles.field}>
            <span>Andares incluídos</span>
            <input
              defaultValue={settings.included_through_floor}
              max={2147483647}
              min={0}
              name="includedThroughFloor"
              type="number"
            />
          </label>
        </div>
        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>Validade da cotação (minutos)</span>
            <input
              defaultValue={settings.quote_expiration_minutes ?? ""}
              min={1}
              name="quoteExpirationMinutes"
              placeholder="Não definida"
              type="number"
            />
            <small>
              Em branco mantém a validade nula até decisão operacional.
            </small>
          </label>
          <label className={styles.field}>
            <span>WhatsApp oficial (E.164)</span>
            <input
              autoComplete="tel"
              defaultValue={settings.whatsapp_phone_e164 ?? ""}
              inputMode="tel"
              name="whatsappPhoneE164"
              placeholder="Não configurado"
            />
            <small>Deixe vazio até a empresa confirmar o número oficial.</small>
          </label>
        </div>
        <div className={styles.policyNotice}>
          <CircleAlert size={17} aria-hidden="true" />
          <p>
            A regra para múltiplas entregas ao mesmo endereço está pendente.
            Estas configurações não ativam checkout, cobrança ou pedido.
          </p>
        </div>
        <div className={styles.formFooter}>
          <span>Somente valores operacionais aprovados devem ser salvos.</span>
          <button
            className={styles.primaryButton}
            disabled={pending}
            type="submit"
          >
            {pending ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
        <Feedback result={feedback} />
      </form>
    </section>
  );
}

export function LogisticsWorkspace({
  section,
  data,
  related,
}: {
  section: LogisticsPageSection;
  data: LogisticsLoadResult<WorkspaceData>;
  related?: LogisticsLoadResult<WorkspaceData>;
}) {
  const copy = sectionCopy[section];
  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Administração / Entregas</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      {data.status === "unavailable" ? (
        <DataUnavailable reason={data.reason} />
      ) : (
        <div className={styles.content}>
          {section === "overview" && (
            <OverviewPanel data={data.data as LogisticsOverview} />
          )}
          {section === "requests" && (
            <RequestsPanel quotes={data.data as LogisticsQuote[]} />
          )}
          {section === "areas" && (
            <AreasPanel areas={data.data as LogisticsArea[]} />
          )}
          {section === "suppliers" && (
            <SuppliersPanel suppliers={data.data as LogisticsSupplier[]} />
          )}
          {section === "pickup" && (
            <PickupLocationsPanel
              suppliers={data.data as LogisticsSupplier[]}
              areas={
                related?.status === "ready"
                  ? (related.data as LogisticsArea[])
                  : null
              }
              areaIssue={
                related?.status === "unavailable" ? related.reason : undefined
              }
            />
          )}
          {section === "products" &&
            (related?.status === "ready" ? (
              <ProductsPanel
                products={data.data as LogisticsProduct[]}
                suppliers={related.data as LogisticsSupplier[]}
              />
            ) : (
              <>
                {related?.status === "unavailable" && (
                  <DataUnavailable reason={related.reason} />
                )}
                <ProductsPanel
                  products={data.data as LogisticsProduct[]}
                  suppliers={null}
                />
              </>
            ))}
          {section === "settings" && (
            <SettingsPanel
              settings={(data.data as LogisticsOverview).settings}
            />
          )}
        </div>
      )}
    </div>
  );
}
