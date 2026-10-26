import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Package2,
  ShoppingBag,
  Star,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  BarList,
  Donut,
  SegmentBar,
  StackedBars,
  formatNumber,
  type Segment,
} from "./charts";
import type { OverviewData } from "./overview-data";
import styles from "./overview.module.css";

const COLOR = {
  ok: "#5f8a6a",
  low: "#d6a13a",
  out: "#b3584a",
  navy: "#2c3e55",
  gold: "#c79a2e",
  muted: "#b8b4aa",
} as const;

type Tone = "alert" | "warn" | "info";
type Attention = { key: string; tone: Tone; text: string; href: string };

const toneIcon: Record<Tone, LucideIcon> = {
  alert: AlertTriangle,
  warn: AlertTriangle,
  info: Info,
};

function plural(count: number, one: string, many: string) {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function buildAttention({
  snapshot,
  engagement,
  logistics,
}: OverviewData): Attention[] {
  const items: Attention[] = [];
  if (snapshot) {
    const { out_of_stock_variants: out, low_stock_variants: low } =
      snapshot.summary;
    if (out > 0)
      items.push({
        key: "out",
        tone: "alert",
        text: `${plural(out, "variação esgotada", "variações esgotadas")}`,
        href: "/admin/analytics/estoque",
      });
    if (low > 0)
      items.push({
        key: "low",
        tone: "warn",
        text: `${plural(low, "variação com estoque baixo", "variações com estoque baixo")}`,
        href: "/admin/analytics/estoque",
      });
    if (snapshot.summary.draft_products > 0)
      items.push({
        key: "draft",
        tone: "info",
        text: `${plural(snapshot.summary.draft_products, "produto em rascunho", "produtos em rascunho")} (não aparecem na loja)`,
        href: "/admin/produtos",
      });
  }
  if (logistics) {
    if (logistics.open_quote_count > 0)
      items.push({
        key: "quotes",
        tone: "alert",
        text: `${plural(logistics.open_quote_count, "cotação de entrega em aberto", "cotações de entrega em aberto")}`,
        href: "/admin/entregas/solicitacoes",
      });
    if (logistics.unassigned_product_count > 0)
      items.push({
        key: "supplier",
        tone: "warn",
        text: `${plural(logistics.unassigned_product_count, "produto ainda sem fornecedor definido", "produtos ainda sem fornecedor definido")}`,
        href: "/admin/entregas/produtos",
      });
    if (!logistics.settings.whatsapp_phone_e164)
      items.push({
        key: "whatsapp",
        tone: "info",
        text: "WhatsApp oficial da loja ainda não configurado",
        href: "/admin/entregas/configuracoes",
      });
  }
  if (engagement && engagement.reviews.last_7_days > 0)
    items.push({
      key: "reviews",
      tone: "info",
      text: `${plural(engagement.reviews.last_7_days, "avaliação nova", "avaliações novas")} nos últimos 7 dias`,
      href: "/admin/avaliacoes",
    });
  const order: Record<Tone, number> = { alert: 0, warn: 1, info: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}

function Card({
  title,
  icon: Icon,
  href,
  hrefLabel,
  wide,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.card} ${wide ? styles.wide : ""}`}>
      <div className={styles.cardHead}>
        <h2>
          <Icon size={18} aria-hidden="true" />
          {title}
        </h2>
        {href && (
          <Link href={href} className={styles.more}>
            {hrefLabel ?? "Ver detalhes"}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className={styles.unavailable}>
      Não foi possível carregar {what} agora. Atualize a página em instantes.
    </p>
  );
}

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={styles.kpi}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiNote}>{note}</p>
    </div>
  );
}

export function OverviewDashboard(data: OverviewData) {
  const { snapshot, engagement, logistics } = data;
  const attention = buildAttention(data);

  const updatedAt = snapshot
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(snapshot.snapshot_at))
    : null;

  const categories = snapshot
    ? [...snapshot.categories].sort(
        (a, b) =>
          b.variants_total - a.variants_total ||
          a.category_name.localeCompare(b.category_name, "pt-BR"),
      )
    : [];

  const stockSegments: Segment[] = snapshot
    ? [
        {
          label: "Em estoque",
          value: Math.max(
            0,
            snapshot.summary.active_variants -
              snapshot.summary.low_stock_variants -
              snapshot.summary.out_of_stock_variants,
          ),
          color: COLOR.ok,
        },
        {
          label: "Estoque baixo",
          value: snapshot.summary.low_stock_variants,
          color: COLOR.low,
        },
        {
          label: "Esgotado",
          value: snapshot.summary.out_of_stock_variants,
          color: COLOR.out,
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Visão geral</h1>
        <p>
          Como estão o catálogo, o estoque e as entregas agora.
          {updatedAt && <span> Atualizado em {updatedAt}.</span>}
        </p>
      </div>

      <section className={styles.attention} aria-labelledby="attention-title">
        <h2 id="attention-title">Precisa da sua atenção</h2>
        {attention.length ? (
          <ul>
            {attention.map((item) => {
              const Icon = toneIcon[item.tone];
              return (
                <li key={item.key} data-tone={item.tone}>
                  <Link href={item.href}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.text}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.allGood}>
            <CheckCircle2 size={18} aria-hidden="true" />
            Tudo em dia por enquanto. Nada pede ação agora.
          </p>
        )}
      </section>

      <div className={styles.kpis}>
        {snapshot ? (
          <>
            <Kpi
              label="Produtos ativos"
              value={formatNumber(snapshot.summary.active_products)}
              note={`de ${formatNumber(snapshot.summary.products_total)} cadastrados`}
            />
            <Kpi
              label="Unidades em estoque"
              value={formatNumber(snapshot.summary.available_units_total)}
              note={`em ${formatNumber(snapshot.summary.active_variants)} variações ativas`}
            />
          </>
        ) : null}
        {engagement ? (
          <>
            <Kpi
              label="Nota média"
              value={
                engagement.reviews.published
                  ? engagement.reviews.average_rating
                      .toFixed(1)
                      .replace(".", ",")
                  : "—"
              }
              note={`${plural(engagement.reviews.published, "avaliação publicada", "avaliações publicadas")}`}
            />
            <Kpi
              label="Favoritos"
              value={formatNumber(engagement.favorites.total)}
              note={`${plural(engagement.favorites.customers, "cliente", "clientes")} salvaram modelos`}
            />
          </>
        ) : null}
      </div>

      <div className={styles.grid}>
        <Card
          title="Estoque por categoria"
          icon={Warehouse}
          href="/admin/analytics/estoque"
          wide
        >
          {snapshot ? (
            categories.length ? (
              <StackedBars
                rows={categories.map((category) => ({
                  key: category.category_id,
                  label: category.category_name,
                  total:
                    category.variants_in_stock + category.out_of_stock_variants,
                  parts: [
                    {
                      label: "Em estoque",
                      value: Math.max(
                        0,
                        category.variants_in_stock -
                          category.low_stock_variants,
                      ),
                      color: COLOR.ok,
                    },
                    {
                      label: "Estoque baixo",
                      value: category.low_stock_variants,
                      color: COLOR.low,
                    },
                    {
                      label: "Esgotado",
                      value: category.out_of_stock_variants,
                      color: COLOR.out,
                    },
                  ],
                }))}
              />
            ) : (
              <p className={styles.empty}>Ainda não há categorias.</p>
            )
          ) : (
            <Unavailable what="o estoque" />
          )}
        </Card>

        <Card
          title="Saúde do estoque"
          icon={Package2}
          href="/admin/analytics/estoque"
        >
          {snapshot ? (
            <SegmentBar
              segments={stockSegments}
              label="Variações por situação"
            />
          ) : (
            <Unavailable what="o estoque" />
          )}
        </Card>

        <Card
          title="Situação do catálogo"
          icon={Package2}
          href="/admin/produtos"
        >
          {snapshot ? (
            <Donut
              label="Produtos por situação"
              centerLabel="produtos"
              segments={[
                {
                  label: "Ativos",
                  value: snapshot.summary.active_products,
                  color: COLOR.ok,
                },
                {
                  label: "Rascunho",
                  value: snapshot.summary.draft_products,
                  color: COLOR.gold,
                },
                {
                  label: "Arquivados",
                  value: snapshot.summary.archived_products,
                  color: COLOR.muted,
                },
              ]}
            />
          ) : (
            <Unavailable what="o catálogo" />
          )}
        </Card>

        <Card title="Notas das avaliações" icon={Star} href="/admin/avaliacoes">
          {engagement ? (
            engagement.reviews.published ? (
              <BarList
                color={COLOR.gold}
                rows={(["5", "4", "3", "2", "1"] as const).map((stars) => ({
                  key: stars,
                  label: `${stars} ${stars === "1" ? "estrela" : "estrelas"}`,
                  value: engagement.reviews.distribution[stars],
                }))}
              />
            ) : (
              <p className={styles.empty}>
                Ainda não há avaliações publicadas.
              </p>
            )
          ) : (
            <Unavailable what="as avaliações" />
          )}
        </Card>

        <Card
          title="Modelos mais curtidos"
          icon={Star}
          href="/admin/avaliacoes"
        >
          {engagement ? (
            engagement.top_favorited.length ? (
              <BarList
                color={COLOR.navy}
                unit="curtidas"
                rows={engagement.top_favorited.slice(0, 5).map((item) => ({
                  key: item.product_id,
                  label: item.name,
                  value: item.favorites,
                  href:
                    item.status === "active"
                      ? `/produto/${item.slug}`
                      : undefined,
                  note: item.average_rating
                    ? `Nota ${item.average_rating.toFixed(1).replace(".", ",")} em ${plural(item.review_count, "avaliação", "avaliações")}`
                    : "Sem avaliações",
                }))}
              />
            ) : (
              <p className={styles.empty}>
                Ainda não há favoritos. Quando clientes salvarem modelos, eles
                aparecem aqui.
              </p>
            )
          ) : (
            <Unavailable what="as curtidas" />
          )}
        </Card>

        <Card title="Entregas" icon={Truck} href="/admin/entregas">
          {logistics ? (
            <div className={styles.stack}>
              <SegmentBar
                label="Produtos com e sem fornecedor"
                segments={[
                  {
                    label: "Com fornecedor",
                    value:
                      logistics.product_count -
                      logistics.unassigned_product_count,
                    color: COLOR.ok,
                  },
                  {
                    label: "Sem fornecedor",
                    value: logistics.unassigned_product_count,
                    color: COLOR.low,
                  },
                ]}
              />
              <dl className={styles.facts}>
                <div>
                  <dt>Cotações em aberto</dt>
                  <dd>{formatNumber(logistics.open_quote_count)}</dd>
                </div>
                <div>
                  <dt>Cidades atendidas</dt>
                  <dd>{formatNumber(logistics.enabled_area_count)}</dd>
                </div>
                <div>
                  <dt>Fornecedores ativos</dt>
                  <dd>{formatNumber(logistics.active_supplier_count)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <Unavailable what="as entregas" />
          )}
        </Card>

        <Card title="Vendas e receita" icon={ShoppingBag} wide>
          <div className={styles.soon}>
            <p>
              Pedidos, receita, ticket médio e conversão aparecem aqui assim que
              o checkout estiver ativo. Nenhum valor é estimado antes disso.
            </p>
            <ul>
              <li>Pedidos e status</li>
              <li>Receita e ticket médio</li>
              <li>Pagamentos e reembolsos</li>
              <li>Funil de compra</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
