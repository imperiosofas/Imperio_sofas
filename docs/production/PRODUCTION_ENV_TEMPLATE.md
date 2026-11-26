# Variáveis de ambiente de produção

Modelo sem valores: `.env.production.example` (raiz do repositório). Este documento
diz **de onde vem cada valor, quem fornece e o formato**. Os valores reais são colados
pelo dono de cada conta **direto na Vercel** (Project → Settings → Environment
Variables → Production). Nunca por e-mail, chat ou commit.

Conferência: com as variáveis definidas, `npm run check:production` deve terminar com
"passou" (mostra só nomes, nunca valores). O teste
`tests/check-production-ready.test.mjs` garante que o modelo lista todas as
obrigatórias.

Legenda: **Obrig.** = o `check:production` bloqueia sem ela · **Quem**: Você
(responsável técnico), Cliente (Império Sofás), Externo (gerado no painel de um
serviço).

## Obrigatórias

| Variável                               | Formato                             | Origem                                                           | Quem              | Observação                                                                                         |
| -------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `APP_ENV`                              | `production`                        | fixo                                                             | Você              |                                                                                                    |
| `CATALOG_SOURCE`                       | `supabase`                          | fixo                                                             | Você              |                                                                                                    |
| `INTEGRATION_MODE`                     | `live`                              | fixo                                                             | Você              | `mock`/`sandbox` são recusados em produção                                                         |
| `APP_URL`                              | `https://dominio` (sem barra final) | domínio final                                                    | Você              | **Depende da decisão do domínio.** Usado em links de e-mail, retorno do pagamento e URLs canônicas |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`         | Supabase **produção** → Project Settings → API                   | Você (Externo)    | Pública por desenho (protegida por RLS)                                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...`                | idem                                                             | Você (Externo)    | Pública por desenho                                                                                |
| `SUPABASE_SECRET_KEY`                  | `sb_secret_...`                     | idem (Secret keys)                                               | Você (Externo)    | **Só servidor.** Webhook, e-mails de pedido, rota de expiração                                     |
| `MP_ACCESS_TOKEN`                      | `APP_USR-...`                       | Mercado Pago → Suas integrações → **Credenciais de produção**    | Cliente (Externo) | Nunca a credencial "de teste"                                                                      |
| `MP_WEBHOOK_SECRET`                    | texto                               | Mercado Pago → Webhooks (modo **produção**) → Assinatura secreta | Cliente (Externo) | Confere a assinatura de cada notificação                                                           |
| `MP_ENV`                               | `live`                              | fixo                                                             | Você              | Qualquer outro valor desliga o checkout em produção                                                |
| `MP_EXPECTED_COLLECTOR_ID`             | número                              | ID (user id) da conta MP que recebe                              | Cliente informa   | Pagamento para outra conta é recusado                                                              |
| `RESEND_API_KEY`                       | `re_...`                            | Resend → API Keys (permissão "Sending")                          | Você (Externo)    |                                                                                                    |
| `RESEND_FROM_EMAIL`                    | `Nome <endereco@dominio>`           | domínio verificado no Resend                                     | Você              | **Depende do domínio do remetente**                                                                |
| `CRON_SECRET`                          | 32+ caracteres aleatórios           | gerar (ex.: gerenciador de senhas)                               | Você              | Protege `/api/cron/expire-orders`                                                                  |

## Opcionais

| Variável                                                            | Quando usar                                                                                                            | Quem            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| `STORE_NOTIFY_EMAIL`                                                | E-mail da loja que recebe cópia dos pedidos. Sem ela, vai para o e-mail da empresa definido no código (aviso no check) | Cliente informa |
| `SENTRY_DSN`                                                        | Monitoramento de erros (aviso no check se ausente)                                                                     | Você            |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, `NEXT_PUBLIC_AUTH_APPLE_ENABLED` | Só `true` depois de configurar o provedor no Supabase Auth. Hoje desligados                                            | Você            |

## Integração opcional: Bling (ERP)

A loja **não usa o Bling hoje**. As quatro variáveis abaixo só são cobradas pelo
`check:production` se pelo menos uma estiver definida — e então todas são exigidas.

`BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI`,
`INTEGRATION_ENCRYPTION_KEY` — **dependem da decisão do cliente** de usar o Bling.

## Não definir em produção

| Variável                                 | Motivo                                                      |
| ---------------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_DISABLE_PASSWORD_EMAIL_MFA` | Atalho só de desenvolvimento; ignorado em build de produção |
| `QUOTE_SIGNING_SECRET`                   | Declarada no esquema, mas nenhum código a lê                |
| `INTEGRATION_KEY_VERSION`                | Só faria sentido com o Bling                                |

## Definidas pela própria Vercel

`VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — não cadastrar.

## Valores que dependem de decisão do cliente

- `APP_URL` e `RESEND_FROM_EMAIL` — domínio final e domínio do remetente.
- `MP_EXPECTED_COLLECTOR_ID`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` — conta Mercado
  Pago de produção do cliente.
- `STORE_NOTIFY_EMAIL` — qual caixa recebe os pedidos.
- Bling — usar ou não.
