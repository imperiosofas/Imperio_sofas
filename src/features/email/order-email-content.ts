// Pure builders for the transactional order e-mails (Decreto 7.962/2013,
// art. 4º, III e IV: immediate confirmation and a copy of the contract summary
// the customer can keep). No I/O here so it can be unit tested.

export type OrderEmailKind = "created" | "paid" | "withdrawal";

export type OrderEmailItem = {
  name: string;
  quantity: number;
  unitCents: number;
  lineCents: number;
};

export type OrderEmailGroup = {
  supplierName: string;
  mode: "delivery" | "pickup";
  pickupLabel: string | null;
  leadMin: number | null;
  leadMax: number | null;
  items: OrderEmailItem[];
};

export type OrderEmailData = {
  id: string;
  number: number;
  customerName: string | null;
  itemsCents: number;
  freightCents: number;
  floorCents: number;
  totalCents: number;
  paymentExpiresAt: string;
  paidAt: string | null;
  deliveryAddress: string | null;
  termsVersion: string | null;
  withdrawalRequestedAt: string | null;
  withdrawalReason: string | null;
  groups: OrderEmailGroup[];
};

export type Seller = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
};

export type BuiltEmail = { subject: string; html: string; text: string };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function money(cents: number) {
  return brl.format(cents / 100);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function leadText(min: number | null, max: number | null) {
  if (min === null || max === null) return null;
  const range = min === max ? `até ${max}` : `${min} a ${max}`;
  return `${range} dias úteis após a confirmação do pagamento`;
}

function intro(kind: OrderEmailKind, order: OrderEmailData) {
  if (kind === "created")
    return [
      `Recebemos o seu pedido nº ${order.number}.`,
      `O estoque fica reservado até ${when.format(new Date(order.paymentExpiresAt))}. Se o pagamento não for concluído até lá, o pedido é cancelado automaticamente.`,
    ];
  if (kind === "paid")
    return [
      `Pagamento confirmado${order.paidAt ? ` em ${when.format(new Date(order.paidAt))}` : ""}. Seu pedido nº ${order.number} já está em preparação.`,
      "Os prazos abaixo contam a partir da confirmação do pagamento. Avisaremos quando o pedido sair para entrega ou estiver pronto para retirada.",
    ];
  return [
    `Recebemos o seu pedido de desistência da compra (direito de arrependimento) do pedido nº ${order.number}${order.withdrawalRequestedAt ? `, registrado em ${when.format(new Date(order.withdrawalRequestedAt))}` : ""}.`,
    "A loja vai entrar em contato para combinar o recolhimento do produto, se já tiver sido entregue, e a devolução integral dos valores pagos, inclusive o frete, pelo mesmo meio de pagamento.",
  ];
}

const subjects: Record<OrderEmailKind, (n: number) => string> = {
  created: (n) => `Recebemos seu pedido nº ${n} | Império Sofás`,
  paid: (n) => `Pagamento confirmado - pedido nº ${n} | Império Sofás`,
  withdrawal: (n) => `Desistência registrada - pedido nº ${n} | Império Sofás`,
};

export function buildOrderEmail(
  kind: OrderEmailKind,
  order: OrderEmailData,
  seller: Seller,
  appUrl: string,
): BuiltEmail {
  const base = appUrl.replace(/\/+$/, "");
  const orderUrl = `${base}/pedido/${order.id}`;
  const hello = order.customerName?.trim()
    ? `Olá, ${order.customerName.trim().split(/\s+/)[0]}!`
    : "Olá!";
  const lines = intro(kind, order);

  const groupText = order.groups.map((g) => {
    const head = `${g.supplierName} · ${g.mode === "pickup" ? "Retirada" : "Entrega"}`;
    const items = g.items.map(
      (i) =>
        `  ${i.quantity} × ${i.name} - ${money(i.unitCents)} = ${money(i.lineCents)}`,
    );
    const place =
      g.mode === "pickup"
        ? g.pickupLabel
          ? `  Retirar em: ${g.pickupLabel}`
          : null
        : order.deliveryAddress
          ? `  Entregar em: ${order.deliveryAddress}`
          : null;
    const lead = leadText(g.leadMin, g.leadMax);
    return [head, ...items, place, lead ? `  Prazo: ${lead}` : null]
      .filter(Boolean)
      .join("\n");
  });

  const totals = [
    `Produtos: ${money(order.itemsCents)}`,
    `Frete: ${order.freightCents ? money(order.freightCents) : "sem frete"}`,
    order.floorCents ? `Adicional por andar: ${money(order.floorCents)}` : null,
    `Total: ${money(order.totalCents)}`,
  ].filter(Boolean) as string[];

  const legalLinks = [
    {
      label: "Termos de compra",
      url: `${base}/termos`,
      note: order.termsVersion ? `(versão aceita: ${order.termsVersion})` : "",
    },
    {
      label: "Trocas e devoluções",
      url: `${base}/trocas-e-devolucoes`,
      note: "",
    },
    { label: "Privacidade", url: `${base}/privacidade`, note: "" },
  ];
  const legal = legalLinks.map(
    (l) => `${l.label}: ${l.url}${l.note ? ` ${l.note}` : ""}`,
  );
  const sellerLine = `${seller.tradeName} · ${seller.legalName} · CNPJ ${seller.cnpj} · ${seller.address} · ${seller.phone} · ${seller.email}`;
  const withdrawalHint =
    kind === "withdrawal"
      ? null
      : "Compras pelo site podem ser canceladas em até 7 dias corridos depois do recebimento (direito de arrependimento), pelo botão “Desistir da compra” na página do pedido.";

  const text = [
    hello,
    "",
    ...lines,
    "",
    `Pedido nº ${order.number}`,
    ...groupText,
    "",
    ...totals,
    "",
    `Acompanhe o pedido: ${orderUrl}`,
    withdrawalHint,
    "",
    ...legal,
    "",
    sellerLine,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const e = escapeHtml;
  const groupHtml = order.groups
    .map((g) => {
      const rows = g.items
        .map(
          (i) =>
            `<tr><td style="padding:6px 0">${i.quantity} × ${e(i.name)}<br><span style="color:#6b6760;font-size:13px">${e(money(i.unitCents))} cada</span></td><td style="padding:6px 0;text-align:right;white-space:nowrap">${e(money(i.lineCents))}</td></tr>`,
        )
        .join("");
      const place =
        g.mode === "pickup"
          ? g.pickupLabel
            ? `Retirar em: ${e(g.pickupLabel)}`
            : ""
          : order.deliveryAddress
            ? `Entregar em: ${e(order.deliveryAddress)}`
            : "";
      const lead = leadText(g.leadMin, g.leadMax);
      return `<div style="margin:16px 0;padding:14px 16px;border:1px solid #ddd8cd;border-radius:10px">
<p style="margin:0 0 6px;font-weight:700">${e(g.supplierName)} · ${g.mode === "pickup" ? "Retirada" : "Entrega"}</p>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}</table>
${place ? `<p style="margin:8px 0 0;font-size:14px">${place}</p>` : ""}
${lead ? `<p style="margin:4px 0 0;font-size:14px;color:#4a4742">Prazo: ${e(lead)}</p>` : ""}
</div>`;
    })
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ede9e1;font-family:Arial,Helvetica,sans-serif;color:#17191d">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8d6a2a">Império Sofás</p>
<h1 style="margin:0 0 16px;font-size:22px">${e(subjects[kind](order.number).split(" | ")[0])}</h1>
<div style="background:#f8f6f1;border:1px solid #d1cbc0;border-radius:14px;padding:20px">
<p style="margin:0 0 10px">${e(hello)}</p>
${lines.map((l) => `<p style="margin:0 0 10px;line-height:1.5">${e(l)}</p>`).join("")}
${groupHtml}
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;margin-top:8px">
${totals
  .map((t, idx) => {
    const [k, v] = t.split(": ");
    const last = idx === totals.length - 1;
    return `<tr><td style="padding:4px 0;${last ? "font-weight:700;border-top:1px solid #c7c2b7;padding-top:10px" : ""}">${e(k)}</td><td style="padding:4px 0;text-align:right;${last ? "font-weight:700;border-top:1px solid #c7c2b7;padding-top:10px" : ""}">${e(v)}</td></tr>`;
  })
  .join("")}
</table>
<p style="margin:20px 0 0"><a href="${e(orderUrl)}" style="display:inline-block;background:#17191d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Ver meu pedido</a></p>
${withdrawalHint ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#4a4742">${e(withdrawalHint)}</p>` : ""}
</div>
<p style="margin:16px 0 4px;font-size:12px;color:#5b5851;line-height:1.6">${legalLinks
    .map(
      (l) =>
        `<a href="${e(l.url)}" style="color:#6b531c">${e(l.label)}</a>${l.note ? ` ${e(l.note)}` : ""}`,
    )
    .join(" · ")}</p>
<p style="margin:0;font-size:12px;color:#5b5851;line-height:1.6">${e(sellerLine)}</p>
</div></body></html>`;

  return { subject: subjects[kind](order.number), html, text };
}
