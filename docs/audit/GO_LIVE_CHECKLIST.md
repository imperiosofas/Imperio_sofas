# GO_LIVE_CHECKLIST — Império Sofás (revisado em 2026-11-26)

> **Atualização 2026-11-26:** a sequência detalhada de lançamento agora está em
> `docs/production/PRODUCTION_SETUP_RUNBOOK.md` (com rollback em
> `docs/production/ROLLBACK_PLAN.md`). Esta lista continua válida como resumo por
> responsável; em caso de diferença, vale o runbook.

Versão validada no staging: commit **`ec407a9`** (branch `staging`). Depois dele:
scripts de verificação, testes, documentação e **uma correção no webhook** (e-mail
de pagamento tardio), que precisa ir ao staging e ser validada antes do lançamento
(`docs/production/PRE_LAUNCH_AUDIT.md`).

Nada desta lista foi feito em produção. Segredos (chaves, tokens, senhas) são
cadastrados **direto no painel de cada serviço** pelo dono da conta — nunca por
e-mail, chat ou repositório.

**Quem faz:** **Você** = responsável pelo projeto · **Cliente** = Império Sofás ·
**Externo** = depende de credencial/conta de terceiro (Mercado Pago, Resend,
Vercel, Supabase) · **Eu** = posso fazer com sua autorização explícita.

Já resolvido: dados da empresa, revisão jurídica, catálogo no TESTE, Mercado Pago
validado com credenciais de teste, auditoria QA e PERF-01 (staging aprovado).

---

## Fase 1 — Decisões (antes de tudo)

| #   | Tarefa                                                                                                 | Quem           |
| --- | ------------------------------------------------------------------------------------------------------ | -------------- |
| 1.1 | Parcelamento: até quantas vezes, com ou sem juros                                                      | Cliente        |
| 1.2 | Boleto: aceitar ou não (a reserva do estoque dura 30 min)                                              | Cliente        |
| 1.3 | Bling: usar agora ou depois? (a loja funciona sem; o `check:production` só exige se for configurado)   | Você + Cliente |
| 1.4 | Domínio: como o e-commerce substitui a landing `www.imperiosofas.com.br` (outra conta Vercel) e quando | Você + Cliente |
| 1.5 | Qual branch/projeto Vercel será produção (`main` hoje tem código antigo)                               | Você           |

## Fase 2 — Contas e planos

| #   | Tarefa                                                                                                                     | Quem                            |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2.1 | Vercel: time em **plano Pro** (Hobby esgota a cota de imagens em dias; confirmar nos Termos se Hobby admite uso comercial) | Você (Externo: Vercel)          |
| 2.2 | Vercel: alerta de gasto (Spend Management)                                                                                 | Você                            |
| 2.3 | Supabase: criar o projeto de **produção**, separado do TESTE, na região de São Paulo se possível                           | Você (Externo: Supabase)        |
| 2.4 | Supabase: backups / point-in-time recovery conforme o plano                                                                | Você                            |
| 2.5 | Resend: verificar o domínio do remetente                                                                                   | Você (Externo: Resend)          |
| 2.6 | Mercado Pago: conta de produção ativa e aprovada para receber                                                              | Cliente (Externo: Mercado Pago) |

## Fase 3 — Banco de produção

| #   | Tarefa                                                                                                                     | Quem                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 3.1 | Aplicar as 42 migrações de `supabase/migrations`, em ordem (inclui `20261125120000` e `20261125130000`)                    | Você, ou Eu com autorização e acesso |
| 3.2 | Auth → Email: **Require current password when updating = ligado**; Secure password change = ligado; Confirm email = ligado | Você                                 |
| 3.3 | Auth → URL Configuration: Site URL e Redirect URLs do domínio final                                                        | Você                                 |
| 3.4 | Auth → SMTP próprio (Resend) para cadastro e recuperação de senha                                                          | Você                                 |
| 3.5 | MFA opcional (não obrigatório)                                                                                             | Você                                 |
| 3.6 | Storage: bucket `catalog-images` **privado** (não tornar público)                                                          | Você                                 |
| 3.7 | Cadastrar o administrador (`catalog_admins`)                                                                               | Você                                 |
| 3.8 | Catálogo real: produtos, fotos, preços e **estoque real** (no TESTE é 10 provisório)                                       | Você + Cliente                       |

## Fase 4 — Credenciais e variáveis na Vercel de produção

Cada valor é colado pelo dono da conta direto na Vercel. `NEXT_PUBLIC_*` como tipo
Config.

| #    | Variável                                                                                  | Valor / origem                                         | Quem                            |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| 4.1  | `APP_ENV`                                                                                 | `production`                                           | Você                            |
| 4.2  | `APP_URL`                                                                                 | domínio final com `https://`                           | Você                            |
| 4.3  | `CATALOG_SOURCE`                                                                          | `supabase`                                             | Você                            |
| 4.4  | `INTEGRATION_MODE`                                                                        | `live`                                                 | Você                            |
| 4.5  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase de produção                                   | Você (Externo)                  |
| 4.6  | `MP_ACCESS_TOKEN`                                                                         | Access Token **de produção**                           | Cliente (Externo: Mercado Pago) |
| 4.7  | `MP_WEBHOOK_SECRET`                                                                       | assinatura secreta do webhook de produção              | Cliente (Externo)               |
| 4.8  | `MP_ENV`                                                                                  | **`live`**                                             | Você                            |
| 4.9  | `MP_EXPECTED_COLLECTOR_ID`                                                                | ID (user id) da conta que recebe                       | Cliente informa, Você cadastra  |
| 4.10 | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                     | Resend                                                 | Você (Externo)                  |
| 4.11 | `STORE_NOTIFY_EMAIL`                                                                      | e-mail da loja que recebe cópia dos pedidos (opcional) | Cliente informa                 |
| 4.12 | `CRON_SECRET`                                                                             | texto aleatório com 32+ caracteres                     | Você                            |
| 4.13 | `SENTRY_DSN`                                                                              | monitoramento de erros (opcional)                      | Você                            |
| 4.14 | Bling (`BLING_*`, `INTEGRATION_ENCRYPTION_KEY`)                                           | só se 1.3 = usar agora; os 4 juntos                    | Você + Cliente                  |
| 4.15 | Região das funções = região do Supabase (ex.: `gru1`)                                     | —                                                      | Você                            |

Conferência: `npm run check:production` com essas variáveis deve passar (ele não
mostra os valores).

## Fase 5 — Mercado Pago de produção

| #   | Tarefa                                                                                   | Quem              |
| --- | ---------------------------------------------------------------------------------------- | ----------------- |
| 5.1 | Webhook de produção para `https://<domínio>/api/webhooks/mercadopago`, evento Pagamentos | Cliente (Externo) |
| 5.2 | Aplicar as decisões 1.1 e 1.2 na conta (meios de pagamento, parcelas)                    | Cliente           |

## Fase 6 — Deploy e verificação

| #   | Tarefa                                                                                                                 | Quem                         |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 6.1 | Deploy em produção do mesmo código validado (`ec407a9` + commits só de docs/script)                                    | Você (Eu só com autorização) |
| 6.2 | Smoke test: loja, produto, 404 de produto inexistente, carrinho, cadastro/login, troca de senha, admin, upload de foto | Você ou Eu                   |
| 6.3 | Testes pendentes de `PRE_LAUNCH_TESTS.md`: Safari, Firefox, carga (no staging)                                         | Você + Eu                    |
| 6.4 | **Compra real de valor baixo + estorno**                                                                               | Você + Cliente               |
| 6.5 | E-mails de pedido chegam ao cliente e à loja                                                                           | Você                         |

## Fase 7 — Abertura

| #   | Tarefa                                                                                      | Quem |
| --- | ------------------------------------------------------------------------------------------- | ---- |
| 7.1 | Apontar o domínio (decisão 1.4), HTTPS ativo                                                | Você |
| 7.2 | Primeira semana: erros, webhooks, uso de imagens na Vercel (`PERF_IMAGES_2026-11-25.md` §7) | Você |

---

Melhorias abertas que **não bloqueiam** o go-live: ver `BUG_TRACKING.md` (P2/P3).
