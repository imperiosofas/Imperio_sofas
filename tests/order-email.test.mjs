import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderEmail,
  escapeHtml,
} from "../src/features/email/order-email-content.ts";

const seller = {
  legalName: "Império Valle Móveis Ltda.",
  tradeName: "Império Sofás",
  cnpj: "42.046.387/0001-67",
  address:
    "Avenida Cinderela, nº 2011, Jardim Gurilândia, Taubaté/SP, CEP 12071-500",
  phone: "(12) 99218-0333",
  email: "imperiosofas20@gmail.com",
};

const order = {
  id: "11111111-2222-3333-4444-555555555555",
  number: 1042,
  customerName: "Maria <script>alert(1)</script> Silva",
  itemsCents: 79800,
  freightCents: 15000,
  floorCents: 2000,
  totalCents: 96800,
  paymentExpiresAt: "2026-11-18T15:30:00Z",
  paidAt: "2026-11-18T15:10:00Z",
  deliveryAddress: "Rua A, 10 - Centro - Taubaté/SP - CEP 12000-000 - 2º andar",
  termsVersion: "2026-10-30",
  withdrawalRequestedAt: "2026-11-20T10:00:00Z",
  withdrawalReason: null,
  groups: [
    {
      supplierName: "Vale",
      mode: "delivery",
      pickupLabel: null,
      leadMin: 7,
      leadMax: 7,
      items: [
        {
          name: "Poltrona Josy",
          quantity: 2,
          unitCents: 39900,
          lineCents: 79800,
        },
      ],
    },
  ],
};

test("created e-mail carries the contract summary and seller identification", () => {
  const {
    subject,
    html,
    text: raw,
  } = buildOrderEmail("created", order, seller, "https://loja.example/");
  const text = raw.replace(/ /g, " ");
  assert.match(subject, /pedido nº 1042/);
  for (const piece of [
    "Poltrona Josy",
    "R$ 798,00",
    "R$ 150,00",
    "R$ 20,00",
    "R$ 968,00",
    "até 7 dias úteis",
    "CNPJ 42.046.387/0001-67",
    "versão aceita: 2026-10-30",
    "https://loja.example/pedido/" + order.id,
    "Desistir da compra",
  ])
    assert.ok(text.includes(piece), piece);
  assert.ok(html.includes("https://loja.example/termos"));
});

test("customer-provided text is escaped in HTML", () => {
  const { html } = buildOrderEmail(
    "paid",
    order,
    seller,
    "https://loja.example",
  );
  assert.ok(!html.includes("<script>"));
  assert.equal(
    escapeHtml(`<a href="x">'&`),
    "&lt;a href=&quot;x&quot;&gt;&#39;&amp;",
  );
});

test("paid and withdrawal e-mails say what happened", () => {
  assert.match(
    buildOrderEmail("paid", order, seller, "https://x").text,
    /Pagamento confirmado/,
  );
  const w = buildOrderEmail("withdrawal", order, seller, "https://x");
  assert.match(w.subject, /Desistência registrada/);
  assert.match(
    w.text,
    /devolução integral dos valores pagos, inclusive o frete/,
  );
});
