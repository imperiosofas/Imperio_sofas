# Arquitetura atual — Império Sofás (auditoria de 17/11/2026)

## Stack

| Camada     | Tecnologia                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Aplicação  | Next.js 16.4.6 (App Router, Server Components, Server Actions, Route Handlers), React 19, TypeScript ~6       |
| Estilo     | Tailwind 4 + CSS Modules; landing herdada em `src/sections` (ativo preservado)                                |
| Dados      | Supabase: Postgres com RLS, Auth (e-mail/senha, PKCE), Storage (bucket privado `catalog-images`)              |
| Hospedagem | Vercel (projeto `imperio-sofas`; branch de produção configurada = `staging`)                                  |
| Pagamento  | Mercado Pago Checkout Pro (código pronto, não validado com credenciais reais) + provedor `mock` só para teste |
| Testes     | `node --test` (unitários), Playwright (E2E e acessibilidade), pgTAP (`supabase/tests`), Lighthouse CI         |

## Organização do código

```
proxy.ts                       renova a sessão Supabase em cada request (não autoriza)
next.config.ts                 headers de segurança, limites de Server Actions
src/app/
  page.tsx                     home (landing + catálogo)
  (storefront)/                loja, categoria, produto, carrinho, checkout, pedido  [layout com rodapé legal]
  (account)/conta/...          login/cadastro, perfil, segurança, favoritos, pedidos, entregas, redefinir senha
  (legal)/                     termos, privacidade, trocas-e-devolucoes
  admin/...                    painel (layout exige admin): produtos, pedidos, entregas, avaliações, analytics, relatórios
  api/                         cart/summary, logistics/cep, webhooks/mercadopago, cron/expire-orders, admin/reports/*.xlsx
  auth/{confirm,callback}      verificação de e-mail/recuperação (interstitial + POST)
src/features/                  domínio: catalog, commerce (carrinho/favoritos/avaliações), checkout, logistics,
                               admin, auth, account, legal
src/lib/                       supabase (server/browser/service/admin-access), money, env, auth helpers
supabase/migrations            39 migrations (schema, RLS, RPCs SECURITY DEFINER com search_path='')
supabase/tests                 pgTAP
```

## Fronteiras de confiança

- **Navegador**: só recebe `NEXT_PUBLIC_SUPABASE_URL` e a chave publicável. Toda leitura/escrita passa pelo RLS.
- **Servidor (Server Components/Actions)**: usa a sessão do cliente (`createSupabaseServerClient`). Ações de admin chamam `requireCatalogAdmin()` (JWT + `getUser()` + linha em `catalog_admins`).
- **Service role** (`src/lib/supabase/service.ts`, `server-only`): só para pagamento (registrar/aplicar eventos), webhook, expiração e limpeza de storage.
- **Banco**: fonte da verdade de preço, estoque, frete e totais. `create_checkout_order` recalcula tudo; `order_apply_payment_event` confere o valor pago contra o total.

## Fluxos principais

1. **Catálogo** — RPCs públicas `get_catalog_listing`, `get_catalog_products`, `get_catalog_categories`; imagens por URL assinada do bucket privado.
2. **Carrinho** — RPCs `add_cart_item`/`set_cart_item` (atômicas, limitadas ao estoque livre). O cliente nunca envia preço.
3. **Frete** — cotação por fornecedor (Valle/Mundial): cliente pede, admin responde, cliente aceita; validade de 24 h; adicional de andar uma vez por endereço. CEP via ViaCEP+IBGE com fallback BrasilAPI.
4. **Checkout** — termos obrigatórios (versão gravada), consentimento opcional de WhatsApp, `create_checkout_order` (idempotente por chave, reserva estoque), `startOrderPayment` (exige termos aceitos) → Mercado Pago ou mock.
5. **Pagamento** — webhook com HMAC → `order_apply_payment_event` (deduplicado, confere valor). Valor divergente → `needs_review`.
6. **Pós-venda** — admin avança entregas/retiradas; cliente pode pedir desistência (protocolo imediato); admin registra estorno e, se quiser, devolve ao estoque; admin encerra pedidos `needs_review`.
7. **Expiração** — `expire_pending_orders` libera estoque de pedidos não pagos (rota cron existe; agendamento pendente).

## Integrações externas

| Integração                             | Estado                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Supabase TEST (`qsafyqsskwbjnailgoev`) | **fora do ar em 17/11** (DNS NXDOMAIN; provável pausa por inatividade) |
| Mercado Pago                           | código + testes unitários; sem credenciais/validação                   |
| ViaCEP / IBGE / BrasilAPI              | em uso (hosts fixos, entrada validada)                                 |
| Bling (NF-e)                           | não implementado (manual por enquanto)                                 |
| Resend (e-mails transacionais)         | não implementado (falta chave e domínio)                               |
