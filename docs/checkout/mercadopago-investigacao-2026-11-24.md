# Investigação do checkout Mercado Pago (24/11/2026)

## Arquitetura real

- **Checkout Pro via API REST**, sem SDK e sem Bricks. Não existe "pagamento direto com cartão" no nosso site: os dois cenários relatados (cartão sem login e login no Mercado Pago) acontecem **na página hospedada do Mercado Pago**.
- Fluxo: `startCheckoutAction` → `create_checkout_order` (banco) → `startOrderPayment` → `POST /checkout/preferences` → redireciona o cliente para a URL devolvida → Mercado Pago chama `POST /api/webhooks/mercadopago` (HMAC) → `GET /v1/payments/{id}` → `order_apply_payment_event`.
- Configuração: `INTEGRATION_MODE`, `MP_ENV`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_EXPECTED_COLLECTOR_ID`, `APP_URL`.

## Causas encontradas (com evidência)

| #   | Problema                                                                                                                                                                                                                                                      | Onde                             | Evidência                                                                                                                                                                                                                                                                                                     | Correção                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **URL errada para as credenciais atuais.** O site abria `sandbox_init_point`. As credenciais de teste atuais são `APP_USR-` de um **usuário vendedor de teste** (`/users/me`: tags `test_user`), e o Mercado Pago trata essas preferências como "produtivas". | `mercadopago-client.ts`          | Resposta interna do checkout (`/checkout/v1/api/flow`) na página sandbox: `"productive": true`, `is_eligible: false`, `has_combination: false`, `error_type: service_error` → tela "Ops, ocorreu um erro." (`FL-88dae6fe…`). A **mesma preferência** no `init_point` (www) passou e o pagamento foi aprovado. | `selectCheckoutUrl`: `init_point` para `APP_USR-`; `sandbox_init_point` só para tokens legados `TEST-`. Teste unitário.                                               |
| 2   | **Webhook e retorno apontavam para um endereço protegido.** Sem `APP_URL` em runtime, o site usava `VERCEL_URL` (endereço do deploy, ex.: `imperio-sofas-kmqoxl0ia-…vercel.app`), que fica atrás do login da Vercel.                                          | `app-url.mjs`                    | Preferência do pedido 1016: `notification_url` e `back_urls` nesse host; `POST` nele → **302 para `vercel.com/sso-api`**. O webhook nunca chegaria.                                                                                                                                                           | Em deploy de produção usa `VERCEL_PROJECT_PRODUCTION_URL` (domínio público). `APP_URL` explícito continua tendo prioridade. Teste unitário.                           |
| 3   | **Cartão de teste errado.** `5031 4332 1540 6351` (passado por mim) não é aceito pelo Checkout Pro.                                                                                                                                                           | instrução manual                 | Mensagem "A transação não aceita este meio de pagamento"; lista oficial atual traz Mastercard `5480 8328 0103 3311` e Visa `4235 6477 2802 5682`. Com o cartão oficial a mensagem não aparece.                                                                                                                | Usar a lista oficial.                                                                                                                                                 |
| 4   | Login de conta de teste no Mercado Pago com erros `COW00-…`                                                                                                                                                                                                   | painel/login do Mercado Pago     | Ocorreu na tela de login do Mercado Pago, antes de qualquer pagamento; nenhum pagamento foi criado (`/v1/payments/search` vazio).                                                                                                                                                                             | Fora do nosso código. O fluxo como convidado funciona; o login com comprador de teste ainda precisa ser testado (não posso entrar com senha em serviço de terceiros). |
| 5   | Erros sem diagnóstico                                                                                                                                                                                                                                         | `mercadopago-client.ts`, webhook | Falhas retornavam `null` sem log.                                                                                                                                                                                                                                                                             | Logs seguros: status HTTP e código de erro do Mercado Pago; no webhook, só se havia assinatura/ids. Nunca token, cartão ou dados pessoais.                            |

**Por que as tentativas anteriores falharam:** cada teste esbarrava em pelo menos um dos problemas 1–3 ao mesmo tempo (URL sandbox + cartão errado); e mesmo que o pagamento passasse, o problema 2 impediria o pedido de virar "pago".

## Testes executados (24/11, credenciais de teste, app local + webhook no site publicado)

| Teste                              | Resultado             | Evidência                                                                                           |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| Criar preferência                  | OK                    | `POST /checkout/preferences` 200; `notification_url` = domínio público                              |
| Checkout Pro / redirecionamento    | OK depois da correção | Site redireciona para `www.mercadopago.com.br`                                                      |
| Página sandbox (antes da correção) | Falha reproduzida     | `service_error`, `is_eligible:false`                                                                |
| Pagamento aprovado (APRO)          | OK                    | pagamento `191429606660` `approved/accredited`; pedido 1017 → `paid`                                |
| Pagamento recusado (OTHE)          | OK                    | `rejected/cc_rejected_other_reason`; pedido continua aguardando                                     |
| Pagamento pendente (CONT)          | OK                    | `in_process/pending_contingency`; pedido continua aguardando                                        |
| Webhook + assinatura               | OK                    | 3 eventos recebidos e aceitos (`paid`, `rejected`, `in_process`)                                    |
| Consistência do banco              | OK                    | 1 pagamento aprovado por pedido; estoque consumido só no aprovado                                   |
| Login com comprador de teste       | **Não executado**     | Exige senha em serviço de terceiros                                                                 |
| Tokenização própria / Bricks       | Não se aplica         | Não usamos Bricks; a tokenização é da página do Mercado Pago (`/bricks/card-form/tokenization` 200) |

Todos os pedidos e usuários de teste foram apagados e o estoque voltou a 10.

## Pendências

- Publicar a correção na `staging` (deploy) e repetir um pagamento no site publicado.
- Opcional: definir `APP_URL=https://imperio-sofas-woad.vercel.app` na Vercel (deixa o endereço explícito).
- Decisões comerciais: o checkout oferece até 18x com juros e boleto; nosso pedido reserva estoque só 30 min (boleto não combina).
- Produção: credenciais de produção da conta real, `MP_ENV=live`, `INTEGRATION_MODE=live`, `APP_ENV=production`.

## Fontes

- Mercado Pago – Contas de teste (Checkout Pro): https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts
- Mercado Pago – Cartões de teste: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
- Mercado Pago – Compras de teste: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases
- Instruções de certificação Checkout Pro (usar `init_point`, não `sandbox_init_point`): https://http2.mlstatic.com/frontend-assets/dx-devsite/devprogram/2022-11-29/checkoutProPT.pdf
- Relato do cartão `5031…` recusado com "não aceita este meio de pagamento": https://github.com/phantosmia/oficina-mecanica-pagamento/pull/2
- Relato de `APP_USR` de usuário de teste falhando no sandbox (não oficial): https://www.limaopay.com.br/blog/como-testar-mercado-pago-sandbox
