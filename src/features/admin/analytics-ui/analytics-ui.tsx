import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Boxes,
  ChartNoAxesColumnIncreasing,
  CircleAlert,
  PackageCheck,
  PackageOpen,
  PackageX,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import type { getAdminAnalyticsSnapshot } from "../analytics-data";
import styles from "./analytics-ui.module.css";

type AnalyticsSnapshot = Awaited<ReturnType<typeof getAdminAnalyticsSnapshot>>;
type AnalyticsArea = "overview" | "products" | "stock" | "behavior" | "reports";

const navigation: { label: string; href: string; area: AnalyticsArea }[] = [
  { label: "Visão geral", href: "/admin/analytics", area: "overview" },
  { label: "Produtos", href: "/admin/analytics/produtos", area: "products" },
  { label: "Estoque", href: "/admin/analytics/estoque", area: "stock" },
  {
    label: "Comportamento",
    href: "/admin/analytics/comportamento",
    area: "behavior",
  },
  { label: "Relatórios", href: "/admin/relatorios", area: "reports" },
];

function number(value: number) {
  return value.toLocaleString("pt-BR");
}

function snapshotDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    dateTime: date.toISOString(),
    label: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date),
  };
}

function categoryHref(href: string, categoryId: string | null) {
  return categoryId
    ? `${href}?categoryId=${encodeURIComponent(categoryId)}`
    : href;
}

export function AnalyticsFrame({
  active,
  title,
  description,
  route,
  snapshot,
  categoryId,
  children,
}: {
  active: AnalyticsArea;
  title: string;
  description: string;
  route: string;
  snapshot: AnalyticsSnapshot;
  categoryId: string | null;
  children: ReactNode;
}) {
  const stamp = snapshotDate(snapshot.snapshot_at);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>IMPÉRIO SOFÁS · INTELIGÊNCIA DE LOJA</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.snapshotStamp}>
          <span className={styles.liveDot} aria-hidden="true" />
          <div>
            <strong>Estado atual</strong>
            <span>
              {stamp
                ? `Atualizado ${stamp.label}`
                : "Horário do snapshot indisponível"}
            </span>
          </div>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Navegação de analytics">
        {navigation.map((item) => (
          <Link
            key={item.area}
            href={categoryHref(item.href, categoryId)}
            aria-current={active === item.area ? "page" : undefined}
            className={active === item.area ? styles.activeTab : styles.tab}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.contextBar}>
        <p>
          <strong>Fotografia do momento</strong>
          <span>Sem comparação temporal · dados operacionais do servidor</span>
        </p>
        <form className={styles.categoryFilter} action={route} method="get">
          <label htmlFor={`${active}-category`}>Categoria</label>
          <select
            id={`${active}-category`}
            name="categoryId"
            defaultValue={categoryId ?? ""}
          >
            <option value="">Todas as categorias</option>
            {snapshot.categories.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.category_name}
              </option>
            ))}
          </select>
          <button type="submit">Aplicar</button>
        </form>
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <span>{label}</span>
        <span className={styles.metricIcon} aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className={styles.metricValue}>{number(value)}</strong>
      <span className={styles.metricNote}>{note}</span>
    </article>
  );
}

function Metrics({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const { summary } = snapshot;

  return (
    <section
      className={styles.metricGrid}
      aria-label="Indicadores atuais do catálogo"
    >
      <MetricCard
        label="Produtos ativos"
        value={summary.active_products}
        note={`de ${number(summary.products_total)} no catálogo`}
        icon={<PackageCheck size={18} strokeWidth={1.7} />}
      />
      <MetricCard
        label="Variantes ativas"
        value={summary.active_variants}
        note={`${number(summary.categories_total)} categorias cadastradas`}
        icon={<Boxes size={18} strokeWidth={1.7} />}
      />
      <MetricCard
        label="Estoque baixo"
        value={summary.low_stock_variants}
        note="variantes no limite ou abaixo do limite cadastrado"
        icon={<CircleAlert size={18} strokeWidth={1.7} />}
      />
      <MetricCard
        label="Indisponíveis"
        value={summary.out_of_stock_variants}
        note="variantes sem unidades disponíveis"
        icon={<PackageX size={18} strokeWidth={1.7} />}
      />
      <MetricCard
        label="Unidades disponíveis"
        value={summary.available_units_total}
        note="saldo operacional atual, visível só no admin"
        icon={<PackageOpen size={18} strokeWidth={1.7} />}
      />
      <MetricCard
        label="Rascunhos"
        value={summary.draft_products}
        note={`${number(summary.archived_products)} arquivados`}
        icon={<Archive size={18} strokeWidth={1.7} />}
      />
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <div className={styles.panelHeading}>
        <div>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <ChartNoAxesColumnIncreasing
        size={22}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function CategoryAvailability({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <Panel
      eyebrow="DISTRIBUIÇÃO"
      title="Disponibilidade por categoria"
      description="A barra compara variantes ativas com saldo ao total de variantes cadastradas, incluindo as inativas."
    >
      {snapshot.categories.length ? (
        <>
          <ol
            className={styles.barList}
            aria-label="Variantes com estoque por categoria"
          >
            {snapshot.categories.map((category) => {
              const percent = Math.round(
                (category.variants_in_stock /
                  Math.max(1, category.variants_total)) *
                  100,
              );

              return (
                <li className={styles.barRow} key={category.category_id}>
                  <span className={styles.barLabel}>
                    {category.category_name}
                  </span>
                  <span className={styles.barTrack} aria-hidden="true">
                    <span
                      className={styles.barFill}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <strong>{number(category.variants_in_stock)}</strong>
                </li>
              );
            })}
          </ol>
          <div
            className={styles.tableWrap}
            tabIndex={0}
            aria-label="Tabela rolável de disponibilidade por categoria"
          >
            <table className={styles.dataTable}>
              <caption className={styles.srOnly}>
                Quantidade atual de produtos, variantes e unidades por categoria
              </caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">Produtos</th>
                  <th scope="col">Variantes</th>
                  <th scope="col">Com saldo</th>
                  <th scope="col">Estoque baixo</th>
                  <th scope="col">Indisponíveis</th>
                  <th scope="col">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.categories.map((category) => (
                  <tr key={category.category_id}>
                    <th scope="row">{category.category_name}</th>
                    <td>{number(category.product_count)}</td>
                    <td>{number(category.variants_total)}</td>
                    <td>{number(category.variants_in_stock)}</td>
                    <td>{number(category.low_stock_variants)}</td>
                    <td>{number(category.out_of_stock_variants)}</td>
                    <td>{number(category.available_units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState title="Sem categorias neste recorte">
          O snapshot atual não retornou categorias para o filtro selecionado.
        </EmptyState>
      )}
    </Panel>
  );
}

function AttentionTable({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <Panel
      eyebrow="AÇÃO OPERACIONAL"
      title="Estoque que exige atenção"
      description="Quantidade e limite são dados internos do painel, não expostos na loja."
    >
      {snapshot.attention.length ? (
        <div
          className={styles.tableWrap}
          tabIndex={0}
          aria-label="Tabela rolável de variantes que exigem atenção"
        >
          <table className={styles.dataTable}>
            <caption className={styles.srOnly}>
              Variantes com estoque baixo ou indisponíveis
            </caption>
            <thead>
              <tr>
                <th scope="col">Produto / categoria</th>
                <th scope="col">SKU</th>
                <th scope="col">Disponíveis</th>
                <th scope="col">Limite baixo</th>
                <th scope="col">Situação</th>
                <th scope="col">Admin</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.attention.map((item) => {
                const status =
                  item.available_units === 0
                    ? "Indisponível"
                    : item.is_low_stock
                      ? "Estoque baixo"
                      : "Em atenção";

                return (
                  <tr key={item.variant_id}>
                    <th scope="row">
                      <span className={styles.primaryCell}>
                        {item.product_name}
                      </span>
                      <span className={styles.secondaryCell}>
                        {item.category_name}
                      </span>
                    </th>
                    <td>{item.sku || "Sem SKU"}</td>
                    <td className={styles.numericCell}>
                      {number(item.available_units)}
                    </td>
                    <td className={styles.numericCell}>
                      {item.low_stock_threshold === null
                        ? "Não definido"
                        : number(item.low_stock_threshold)}
                    </td>
                    <td>
                      <span
                        className={
                          item.available_units === 0
                            ? styles.statusEmpty
                            : styles.statusLow
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td>
                      <Link
                        className={styles.rowLink}
                        href={`/admin/produtos/${encodeURIComponent(item.product_id)}`}
                        aria-label={`Abrir ${item.product_name} no admin`}
                      >
                        Abrir <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={styles.tableFootnote}>
            A lista respeita o limite do snapshot fornecido pelo servidor.
          </p>
        </div>
      ) : (
        <EmptyState title="Nenhuma variante crítica">
          Não há variantes de atenção retornadas neste snapshot.
        </EmptyState>
      )}
    </Panel>
  );
}

function InventoryRanking({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <Panel
      eyebrow="POSIÇÃO ATUAL"
      title="Maior saldo de estoque por produto"
      description="Ordenação operacional pelo saldo agregado informado pelo servidor; inclui produtos ativos, rascunhos e arquivados, portanto não representa disponibilidade comercial, popularidade ou vendas."
    >
      {snapshot.top_inventory_products.length ? (
        <div
          className={styles.tableWrap}
          tabIndex={0}
          aria-label="Tabela rolável de produtos por unidades disponíveis"
        >
          <table className={styles.dataTable}>
            <caption className={styles.srOnly}>
              Produtos com maior quantidade de unidades disponíveis
            </caption>
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Categoria</th>
                <th scope="col">Variantes ativas</th>
                <th scope="col">Unidades disponíveis</th>
                <th scope="col">Admin</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.top_inventory_products.map((product) => (
                <tr key={product.product_id}>
                  <th scope="row">
                    <span className={styles.primaryCell}>
                      {product.product_name}
                    </span>
                    <span className={styles.secondaryCell}>
                      /{product.slug}
                    </span>
                  </th>
                  <td>{product.category_name}</td>
                  <td>{number(product.active_variant_count)}</td>
                  <td className={styles.numericCell}>
                    {number(product.available_units)}
                  </td>
                  <td>
                    <Link
                      className={styles.rowLink}
                      href={`/admin/produtos/${encodeURIComponent(product.product_id)}`}
                    >
                      Abrir <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Sem disponibilidade para ranquear">
          O servidor não retornou produtos com unidades disponíveis neste
          recorte.
        </EmptyState>
      )}
    </Panel>
  );
}

export function FuturePhaseTwoNotice() {
  return (
    <aside
      className={styles.futureNotice}
      aria-labelledby="analytics-phase-two-title"
    >
      <div className={styles.futureIcon} aria-hidden="true">
        <ShieldCheck size={19} strokeWidth={1.7} />
      </div>
      <div>
        <p className={styles.eyebrow}>FASE 2 · AGUARDANDO OPERAÇÃO COMERCIAL</p>
        <h2 id="analytics-phase-two-title">
          Disponível após ativação de pedidos
        </h2>
        <p>
          Vendas, receita, ticket médio, conversão de checkout, pagamentos,
          frete, reembolsos, custos e margem só entram após esses fluxos
          existirem e serem homologados. Não há valores financeiros estimados
          nesta tela.
        </p>
        <details className={styles.phaseTwoDetails}>
          <summary>Lembrete obrigatório — Analytics Fase 2</summary>
          <p>
            Quando frete, pedidos, checkout, pagamento e reembolso estiverem
            implementados e homologados, conectar os fatos financeiros e
            operacionais reais — receita bruta/líquida, pedidos válidos, ticket
            médio, conversão e abandono por etapa, meios de pagamento,
            reembolsos, custo/margem, SLA de entrega e receita por
            região/produto — a partir do estado persistido e validado no
            servidor, com webhooks idempotentes e snapshots de preços/custos.
            Nunca aceitar um evento `purchase` enviado pelo browser como prova
            de venda.
          </p>
        </details>
      </div>
    </aside>
  );
}

export function AnalyticsOverview({
  snapshot,
}: {
  snapshot: AnalyticsSnapshot;
}) {
  return (
    <>
      <Metrics snapshot={snapshot} />
      <div className={styles.twoColumnGrid}>
        <CategoryAvailability snapshot={snapshot} />
        <InventoryRanking snapshot={snapshot} />
      </div>
      <AttentionTable snapshot={snapshot} />
      <FuturePhaseTwoNotice />
    </>
  );
}

export function ProductAnalytics({
  snapshot,
}: {
  snapshot: AnalyticsSnapshot;
}) {
  return (
    <>
      <Metrics snapshot={snapshot} />
      <InventoryRanking snapshot={snapshot} />
      <Panel
        eyebrow="INTERESSE DE CLIENTES"
        title="Visualizações, favoritos e adições ao carrinho"
        description="Essas ações dependem de instrumentação first-party válida e consentimento aplicável."
      >
        <EmptyState title="Ainda sem dados">
          O snapshot operacional atual não contém eventos de visualização,
          favoritos ou adição ao carrinho. Nenhum zero foi presumido.
        </EmptyState>
      </Panel>
      <FuturePhaseTwoNotice />
    </>
  );
}

export function InventoryAnalytics({
  snapshot,
}: {
  snapshot: AnalyticsSnapshot;
}) {
  return (
    <>
      <Metrics snapshot={snapshot} />
      <CategoryAvailability snapshot={snapshot} />
      <AttentionTable snapshot={snapshot} />
      <InventoryRanking snapshot={snapshot} />
      <FuturePhaseTwoNotice />
    </>
  );
}

export function BehaviorAnalytics() {
  const events = [
    ["Visualização de produto", "product_view"],
    ["Seleção no catálogo", "product_list_select"],
    ["Busca no catálogo", "catalog_search"],
    ["Busca sem resultados", "catalog_search_no_results"],
    ["Adição ao carrinho", "cart_item_added"],
    ["Visualização do carrinho", "cart_viewed"],
    ["Favorito adicionado", "favorite_added"],
    ["Favorito removido", "favorite_removed"],
  ];

  return (
    <>
      <Panel
        eyebrow="EVENTOS FIRST-PARTY"
        title="Ainda sem dados"
        description="O snapshot operacional descreve o estado atual do catálogo e do estoque; ele não mede comportamento de clientes."
      >
        <div className={styles.behaviorBlocker}>
          <CircleAlert size={20} strokeWidth={1.7} aria-hidden="true" />
          <div>
            <h3>Consentimento e privacidade ainda são um bloqueio</h3>
            <p>
              Nenhum evento de navegação é coletado ou exibido aqui. A medição
              só deve ser ativada após definir base legal/consentimento,
              minimização de dados, retenção e controles de acesso. Por isso,
              esta tela não apresenta zeros nem tendências presumidas.
            </p>
          </div>
        </div>
        <div
          className={styles.tableWrap}
          tabIndex={0}
          aria-label="Tabela rolável de eventos de comportamento ainda não medidos"
        >
          <table className={styles.dataTable}>
            <caption className={styles.srOnly}>
              Eventos previstos, aguardando instrumentação com privacidade
              validada
            </caption>
            <thead>
              <tr>
                <th scope="col">Evento previsto</th>
                <th scope="col">Identificador</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {events.map(([label, event]) => (
                <tr key={event}>
                  <th scope="row">{label}</th>
                  <td>
                    <code>{event}</code>
                  </td>
                  <td>
                    <span className={styles.statusPending}>
                      Ainda sem dados
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <FuturePhaseTwoNotice />
    </>
  );
}

export function ReportsOverview({
  snapshot,
  categoryId,
}: {
  snapshot: AnalyticsSnapshot;
  categoryId: string | null;
}) {
  const reports = [
    {
      title: "Resumo do catálogo",
      description:
        "Produtos por estado, variantes ativas e categorias cadastradas.",
      value: number(snapshot.summary.products_total),
      unit: "produtos no snapshot atual",
    },
    {
      title: "Posição de estoque",
      description:
        "Unidades disponíveis, variantes com saldo, estoque baixo e indisponíveis.",
      value: number(snapshot.summary.available_units_total),
      unit: "unidades disponíveis agora",
    },
    {
      title: "Categorias",
      description: "Distribuição operacional atual por categoria.",
      value: number(snapshot.categories.length),
      unit: "categorias retornadas pelo servidor",
    },
  ];

  return (
    <>
      <section
        className={styles.reportGrid}
        aria-label="Relatórios de dados atuais"
      >
        {reports.map((report, index) => (
          <article className={styles.reportCard} key={report.title}>
            <span className={styles.reportIndex}>0{index + 1}</span>
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            <strong>{report.value}</strong>
            <span>{report.unit}</span>
          </article>
        ))}
      </section>
      <section className={styles.exportNotice} aria-labelledby="export-title">
        <p className={styles.eyebrow}>EXPORTAÇÃO XLSX</p>
        <h2 id="export-title">Snapshot administrativo em Excel</h2>
        <p>
          Baixe os dados atuais do catálogo e do estoque
          {categoryId
            ? " para a categoria selecionada"
            : " para todas as categorias"}
          .
        </p>
        <a
          className={styles.exportLink}
          href={`/api/admin/reports/analytics.xlsx${categoryId ? `?category=${encodeURIComponent(categoryId)}` : ""}`}
        >
          Baixar relatório Excel (.xlsx)
        </a>
      </section>
      <FuturePhaseTwoNotice />
    </>
  );
}

export function AnalyticsLoading() {
  return (
    <div
      className={styles.loadingState}
      role="status"
      aria-live="polite"
      aria-label="Carregando analytics"
      aria-busy="true"
    >
      <span />
      <span />
      <span />
      <span />
      <span />
      <p>Carregando o snapshot administrativo…</p>
    </div>
  );
}
