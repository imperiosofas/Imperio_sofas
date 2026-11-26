# Revisão independente de pré-produção — Império Sofás (2026-11-26)

Papel: revisão crítica, como arquiteto externo. Base: estado verificado hoje no
repositório, no GitHub (público), no painel da Vercel (time e conta pessoal), no
painel do Supabase TESTE e em testes executados nesta sessão. O que não pude
conferir está marcado **NÃO VERIFICADO**. Nenhuma correção foi implementada nesta
etapa; este arquivo é a única alteração.

---

> **Correção (26/11, etapa 1 de segurança):** a primeira leitura da lista de variáveis da
> Vercel estava truncada. O staging **tem** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
> `APP_URL`, `CRON_SECRET`, `QUOTE_SIGNING_SECRET`, `SENTRY_DSN`,
> `SUPABASE_SERVICE_ROLE_KEY` e as variáveis do Bling (todas criadas em 23/09, Production
> e Preview). Os **valores não foram verificados** (a Vercel exige código por e-mail para
> revelar). A rota de cron responde 503, o que indica `CRON_SECRET` vazio ou curto. Os
> 7 `POSTGRES_*` foram removidos do staging nesta etapa. Detalhes:
> `SECURITY_STAGE1_REPORT.md`. Onde este documento diz que essas variáveis "não existem",
> leia "existem, valor não verificado"; T-03 continua válido (entrega de e-mail não
> homologada).

## 1. Resumo executivo

**O código está em boa forma; a operação ainda não existe.** A parte de software
(catálogo, carrinho, estoque com concorrência, pagamento por webhook, RLS) foi
testada com profundidade e se mostrou correta. O que falta para receber clientes
reais **não é código** — é infraestrutura paga, decisões comerciais, monitoramento e
processos de operação. Vários desses itens têm prazo de terceiros (aprovação do
Mercado Pago, verificação de domínio no Resend, DNS) e **não cabem em "lançar
amanhã"**. Recomendo tratar o lançamento como uma sequência de 1–2 semanas, com uma
**abertura controlada** (poucos clientes, catálogo reduzido) antes da divulgação.

Discordâncias com o plano atual, em ordem de importância:

1. **O repositório é público** (`github.com/imperiosofas/Imperio_sofas`, conferido
   anonimamente: HTTP 200, selo "Public"). Os relatórios de segurança — inclusive
   achados abertos — estão legíveis por qualquer pessoa. Nenhum segredo real foi
   encontrado no histórico (116 commits varridos), mas a decisão sobre visibilidade
   precisa ser tomada antes do lançamento.
2. **Não existe monitoramento.** `SENTRY_DSN` aparece na documentação, mas **não há
   SDK do Sentry nem `instrumentation.ts` no código** — a variável não faz nada. Sem
   alertas, um webhook quebrado ou um 500 no checkout só seria descoberto por
   reclamação de cliente.
3. **E-mails de pedido nunca foram entregues em ambiente hospedado.** O projeto de
   staging tem `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com **valor não verificado** (lista de variáveis
   da Vercel, conferida hoje); o código pula o envio em silêncio. A funcionalidade
   existe e tem testes unitários, mas a entrega real não foi homologada.
4. **Supabase em plano Free.** A organização está em "FREE" (painel). Para produção
   isso significa sem backup diário/PITR e projeto sujeito a pausa por inatividade.
   **Supabase Pro é pré-requisito, não opcional.**
5. **O frete com cotação manual é o maior risco comercial.** Toda entrega exige que a
   loja responda uma cotação antes do pagamento; 19 dos 53 produtos publicados
   (fornecedor MUNDIAL) **só** podem ser comprados assim. É um fluxo de conversão baixa
   e dependente de alguém atender rápido. Isso precisa ser uma decisão consciente do
   cliente, não um detalhe.
6. **Teste de carga pesado é custo desnecessário** para o porte da loja; um teste leve
   basta. Já **Safari/iPhone** é mais importante que Firefox e ainda não foi testado.

---

## 2. Estado real atual (verificado em 26/11)

| Item                         | Estado                                                                                                                                                                             | Evidência                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Branch `staging`             | `7e6e5d5`, = `origin/staging`, sem alterações pendentes                                                                                                                            | `git rev-parse`               |
| Branch `main`                | `3289699` (29/09), 79 commits atrás, ancestral de `staging`                                                                                                                        | `git rev-list`, `merge-base`  |
| CI em `7e6e5d5`              | quality ✅, database ✅ (banco do zero + testes RLS)                                                                                                                               | GitHub check-runs             |
| Deploy staging               | time "Imperio Sofas", projeto `imperio-sofas`, produção = `staging`, `imperio-sofas-woad.vercel.app`, **sucesso**                                                                  | painel Vercel + status GitHub |
| Projeto `imperio-sofas-z28b` | sem Git, sem domínio                                                                                                                                                               | painel Vercel                 |
| Landing                      | conta pessoal `thiagobettinramos-projects/imperio-sofas`, **Git desconectado hoje**, produção `90cbf52`, domínios `imperiosofas.com.br`→308→`www`; hash HTML idêntico à referência | painel + `curl` + SHA-256     |
| Planos                       | Vercel: **Hobby** (time e pessoal). Supabase: organização **FREE**                                                                                                                 | painéis                       |
| Supabase TESTE               | `qsafyqsskwbjnailgoev`; SMTP próprio **ligado** (Resend, `no-reply@imperiosofas.com.br`); "Require current password" ligado                                                        | painel                        |
| Supabase produção            | **não existe**                                                                                                                                                                     | —                             |
| Repositório                  | **público**                                                                                                                                                                        | GitHub anônimo                |
| Vercel 2FA                   | aviso "Enable 2FA" nas duas contas                                                                                                                                                 | painel                        |

**Variáveis do staging (só nomes, painel em 26/11):** `MP_WEBHOOK_SECRET`,
`MP_ACCESS_TOKEN`, `MP_EXPECTED_COLLECTOR_ID`, `MP_ENV`, `INTEGRATION_MODE` (Production
**e Preview**), `NEXT_PUBLIC_SUPABASE_*`, `CATALOG_SOURCE`, `APP_ENV`, e restos da
integração Supabase de 23/09: `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`,
`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`,
`POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`.
**Ausente:** `STORE_NOTIFY_EMAIL`. (Correção: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL` e
`CRON_SECRET` existem, com valor não verificado — ver a nota no início.)

---

## 3. Pontos fortes já validados (com evidência)

| Área                      | O que foi provado                                                                                                                                        | Evidência                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Banco                     | 42 migrações reproduzíveis do zero; 32/32 tabelas com RLS; bucket privado                                                                                | CI `database`; `npm run check:migrations`                                                                      |
| Estoque/concorrência      | última unidade, duplo envio, 20 alterações simultâneas no carrinho, expiração, aprovação tardia                                                          | `concurrency.cjs` C-01..C-21: 18/18 (26/11)                                                                    |
| Pagamento                 | assinatura HMAC, reconsulta na API, BRL, conta recebedora, valor no banco, idempotência, sem rebaixar aprovação, estorno não reabre pedido, sem deadlock | `src/app/api/webhooks/mercadopago/route.ts`; harness 19/19; migração `20261125130000`; 15 rodadas concorrentes |
| Fluxo ponta a ponta       | cadastro, login, carrinho, checkout, pagamento simulado, conta, admin, upload                                                                            | E2E QA 92/0; E2E repo 39/1 pulado                                                                              |
| Senha                     | troca exige senha atual no servidor; recuperação funciona                                                                                                | `pwd-setting.cjs` 4/4                                                                                          |
| Imagens                   | bucket privado + rota em cache; LCP `/loja` 6,8–7,2 s → 3,1–3,2 s (Lighthouse)                                                                           | `PERF_IMAGES_2026-11-25.md`                                                                                    |
| 404 real                  | produto/categoria inexistente → 404                                                                                                                      | `src/proxy.ts`, `src/lib/catalog-route-exists.ts`                                                              |
| Dependências de produção  | `npm audit --omit=dev`: **0** vulnerabilidades                                                                                                           | 26/11                                                                                                          |
| Segredos                  | nenhum segredo real no histórico; a única ocorrência é uma sentinela de teste                                                                            | varredura de 116 commits                                                                                       |
| Interruptor de emergência | `commerce_settings.checkout_enabled` bloqueia pedidos no banco                                                                                           | migração `20261028120000`, RPC `create_checkout_order`                                                         |

---

## 4. Pendências técnicas

| ID   | Prioridade | Pendência                                                                                                                                                                                                  | Evidência                                                        | Categoria                               | Preparável antes? |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | ----------------- |
| T-01 | **P1**     | **Sem monitoramento de erros/alertas.** Nenhum SDK (Sentry ou outro), sem verificação de disponibilidade, sem alerta de webhook falhando                                                                   | busca por `@sentry`, `instrumentation` → nada                    | Nós (código) + Você (conta)             | Sim               |
| T-02 | **P1**     | **Sem reconciliação de pagamento.** Se o webhook não chegar (URL errada, segredo trocado), o pedido expira e o pagamento fica "solto"; no admin não há "consultar pagamento" nem como marcar pago — só SQL | `fetchPayment` só é chamado pelo webhook; RPCs do admin listadas | Nós                                     | Sim               |
| T-03 | **P1**     | **E-mails de pedido nunca entregues em ambiente hospedado**                                                                                                                                                | staging sem `RESEND_*`                                           | Você (chave no staging) + Nós (teste)   | Sim               |
| T-04 | P2         | Cliente não recebe e-mail em "pronto para retirada", "saiu para entrega", cancelado, expirado, reembolsado — só `created`, `paid`, `withdrawal`                                                            | `OrderEmailKind` em `src/features/email/order-email-content.ts`  | Nós                                     | Sim               |
| T-05 | P2         | Reembolso é **manual no painel do Mercado Pago**; o admin só registra                                                                                                                                      | sem chamada a `/refunds` no código                               | Nós (se automatizar) / processo         | Sim               |
| T-06 | P2         | Cliente pode abrir 2º pedido com o 1º ainda pendente (QA-06) → risco de pagamento duplicado em pedidos diferentes, não detectado                                                                           | `BUG_TRACKING.md`                                                | Nós                                     | Sim               |
| T-07 | P2         | Sem rate limit no app além de cotação e conferência de senha; sem CAPTCHA no cadastro (bots criam contas e consomem cota de e-mail)                                                                        | busca `rateLimit/captcha`                                        | Nós + Você (Supabase Attack Protection) | Sim               |
| T-08 | P2         | Segurança P3 abertas: CSP sem `script-src`, cookie de sessão não HttpOnly, timestamp do webhook sem idade máxima                                                                                           | `SECURITY_AUDIT.md`                                              | Nós                                     | Sim               |
| T-09 | P2         | Dependências de desenvolvimento: 29 vulnerabilidades (14 altas) — não vão para o site, mas afetam CI/máquinas                                                                                              | `npm audit`                                                      | Nós                                     | Sim               |
| T-10 | P3         | `CRON_SECRET` ausente no staging → rota `/api/cron/expire-orders` responde 503. **Não afeta** a expiração (feita pelo `pg_cron`, C-08 PASS)                                                                | `curl` 503; migração `20261118120000`                            | Nós/Você                                | —                 |
| T-11 | P3         | `QUOTE_SIGNING_SECRET` declarado e não usado; restos Vite (`src/App.tsx`, `index.html`)                                                                                                                    | `src/lib/env/server.ts`                                          | Nós                                     | Sim               |
| T-12 | P2         | Documentação diz que `SENTRY_DSN` "monitora erros" — **incorreto** até T-01                                                                                                                                | `docs/production/PRODUCTION_ENV_TEMPLATE.md`                     | Nós                                     | Sim               |

---

## 5. Pendências comerciais do cliente

| ID   | Prioridade | Decisão                                                                                                                                                                                | Por que bloqueia                                                                |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| C-01 | **P0**     | **Modelo de frete**: manter cotação manual para toda entrega? Ou tabela por cidade/faixa (as 12 cidades já estão cadastradas)? Quem responde cotação, em quanto tempo, em que horário? | Sem isso, entrega não vende ou vende devagar; 19 produtos só vendem com cotação |
| C-02 | **P0**     | **Nota fiscal**: como as NF-e serão emitidas (ERP do cliente, Bling, contador)?                                                                                                        | Venda sem NF-e é irregular; o sistema não emite                                 |
| C-03 | **P0**     | **Conta Mercado Pago de produção** aprovada, credenciais, ID da conta recebedora                                                                                                       | Sem isso não há pagamento                                                       |
| C-04 | P1         | Meios de pagamento e parcelamento; **boleto e Pix** versus reserva de 30 min (máx. 24 h)                                                                                               | Pagamentos tardios viram "pago tardio" ou "em revisão" com estorno manual       |
| C-05 | P1         | **Estoque real** por SKU; quais produtos entram (53 publicados + 10 rascunhos no TESTE)                                                                                                | Estoque 10 é fictício                                                           |
| C-06 | P1         | Domínio: a loja substitui a landing ou fica em subdomínio (`loja.imperiosofas.com.br`)?                                                                                                | Define DNS, `APP_URL`, URLs do Supabase/MP                                      |
| C-07 | P1         | Atendimento pós-venda: canal oficial (WhatsApp/e-mail), prazo de resposta, quem opera o admin                                                                                          | Não há operador definido                                                        |
| C-08 | P1         | Repositório público: manter ou tornar privado (afeta plano da Vercel — ver I-02)                                                                                                       | Exposição de relatórios de segurança                                            |
| C-09 | P2         | Conta obrigatória para comprar (não há compra sem cadastro)                                                                                                                            | Conversão                                                                       |
| C-10 | P2         | Titularidade e cobrança das contas (Vercel, Supabase, Resend, MP, GitHub): em nome de quem?                                                                                            | Continuidade se a relação mudar                                                 |

---

## 6. Pendências de infraestrutura

| ID   | Prioridade | Pendência                                                                                                                                                                                                                  | Categoria      | Preparável?            |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------- |
| I-01 | **P0**     | **Supabase Pro** para produção (backup diário, PITR opcional, sem pausa)                                                                                                                                                   | Você           | Sim (criar dias antes) |
| I-02 | **P0**     | **Vercel Pro** no time que hospedará a loja (cota de imagens do Hobby acaba em dias; uso comercial no Hobby — confirmar nos Termos; repositório privado de organização no Hobby — **NÃO VERIFICADO**)                      | Você           | Sim                    |
| I-03 | **P1**     | **2FA** em Vercel (aviso no painel das duas contas), GitHub, Supabase, Mercado Pago, Resend                                                                                                                                | Você + Cliente | Sim                    |
| I-04 | **P1**     | **Produção sem as variáveis herdadas** da integração Supabase/Vercel: não recriar `SUPABASE_JWT_SECRET`, `POSTGRES_*` (o código não usa; o JWT secret permite forjar tokens de administrador). No staging, avaliar remoção | Você           | Sim                    |
| I-05 | P1         | Resend: domínio do remetente verificado para produção, limites do plano (**NÃO VERIFICADO**: plano e cota diária)                                                                                                          | Você           | Sim                    |
| I-06 | P1         | Monitoramento externo de disponibilidade (página inicial, `/loja`, webhook) e alertas por e-mail                                                                                                                           | Você/Nós       | Sim                    |
| I-07 | P1         | Proteção da branch `main` (PR obrigatório + CI verde) — **NÃO VERIFICADO** (API do GitHub em limite)                                                                                                                       | Você           | Sim                    |
| I-08 | P2         | Credenciais do Mercado Pago também em **Preview** no staging (qualquer branch as recebe)                                                                                                                                   | Você           | Sim                    |
| I-09 | P2         | Região das funções (`gru1`) junto do Supabase São Paulo                                                                                                                                                                    | Você           | Sim                    |
| I-10 | P2         | Site de teste `woad` público (sem proteção de deploy)                                                                                                                                                                      | Você (custo)   | —                      |
| I-11 | P2         | Manutenção programada do Supabase em **30/11, 10:00–12:00** — não lançar nessa janela                                                                                                                                      | —              | —                      |

---

## 7. Riscos e vulnerabilidades (o que ainda não estava no plano)

| Risco                                           | Impacto                                                                     | Mitigação                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Repositório público com relatórios de segurança | Atacante conhece pontos fracos e rotas admin                                | Tornar privado ou mover `docs/audit` sensíveis; corrigir SEC2-01..03 |
| Webhook falha silenciosamente                   | Cliente paga, pedido expira, ninguém percebe                                | T-01 + T-02 (alerta + reconciliação diária)                          |
| Supabase Free em produção                       | Pausa/sem backup = perda de pedidos                                         | I-01                                                                 |
| Conta admin comprometida (MFA não exigido)      | Alterar preços, cancelar pedidos                                            | Exigir TOTP para admins (o recurso existe, é opcional hoje)          |
| Bots no cadastro                                | Cota de e-mail do Resend/Supabase esgotada → clientes reais sem confirmação | CAPTCHA/Attack Protection do Supabase; rate limit                    |
| Cotação manual lenta                            | Carrinho abandonado; reserva expira                                         | C-01                                                                 |
| Boleto/Pix após 30 min                          | Estoque liberado, pagamento chega depois → revisão e estorno manual         | C-04 + ajustar janela/expiração da preferência                       |
| Dependência de uma pessoa                       | Só o responsável técnico sabe operar                                        | Runbook de operação para a loja (cotação, envio, estorno)            |
| JWT secret no ambiente                          | Vazamento = acesso total ao banco                                           | I-04                                                                 |
| Imagens: cache de 30 min × cota                 | Custo cresce com tráfego                                                    | Monitorar uso; já documentado                                        |

---

## 8. O que podemos executar imediatamente (sem cliente, sem credencial)

| Item                                                                                                                                 | Prioridade | Observação                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------ |
| T-02 Reconciliação: rotina diária que consulta no Mercado Pago os pedidos pendentes/expirados + botão "consultar pagamento" no admin | P1         | Testável com mock e no sandbox |
| T-01 Integração de monitoramento (Sentry ou equivalente gratuito) com DSN opcional; endpoint `/api/health`                           | P1         | Conta/DSN depois               |
| T-04 E-mails de status (retirada, entrega, cancelado, reembolso)                                                                     | P2         | Mesmo mecanismo idempotente    |
| T-06 Impedir 2º pedido com 1º pendente (ou reaproveitar o pendente)                                                                  | P2         | Regra simples no RPC           |
| T-08 CSP em modo Report-Only, idade máxima do timestamp do webhook                                                                   | P2         |                                |
| T-12 Corrigir a documentação de `SENTRY_DSN`                                                                                         | P2         |                                |
| Teste leve de carga (ex.: 20–50 usuários simultâneos por 5 min) no staging                                                           | P2         | Não precisa de ferramenta paga |
| E2E no Firefox (Playwright)                                                                                                          | P2         | Barato                         |
| Roteiro de operação da loja (como cotar, mudar status, registrar estorno, desligar checkout)                                         | P1         | Documento para o cliente       |

## 9. O que deve esperar

| Item                               | Esperar por                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Criar Supabase/Vercel de produção  | Decisão de plano e titularidade (C-10, I-01, I-02) — criar só perto do lançamento para não pagar à toa, mas **com 2–3 dias de folga** |
| Catálogo definitivo e importação   | C-05 (estoque real) e decisão de quais produtos entram                                                                                |
| Teste de carga pesado              | Não fazer — desproporcional ao porte                                                                                                  |
| Domínio                            | C-06                                                                                                                                  |
| Credenciais reais do Mercado Pago  | C-03                                                                                                                                  |
| Corrigir a rota de cron no staging | Baixo valor; o `pg_cron` já faz a expiração                                                                                           |

---

## 10. Sequência recomendada até o lançamento

**Semana 1 — decisões e contas (paralelo)**

1. Cliente: C-01 (frete), C-02 (NF-e), C-03 (Mercado Pago), C-04, C-06, C-07, C-08.
2. Você: 2FA em todas as contas (I-03); decidir titularidade (C-10); contratar
   Supabase Pro e Vercel Pro quando a data estiver firme.
3. Nós: T-02, T-01 (código), T-04, T-06, roteiro de operação; Firefox E2E; teste leve
   de carga.
4. Você: `RESEND_*` no staging → nós homologamos a entrega real dos e-mails (T-03).

**Semana 2 — produção em paralelo ao staging** 5. Criar Supabase Pro (São Paulo), aplicar migrações via CLI, Auth/SMTP, admin com MFA. 6. Criar projeto Vercel de produção (branch `main`, `gru1`), variáveis sem herança
(I-04), `npm run check:production`. 7. Avançar `main` para o commit validado (fast-forward) — seguro agora que a landing
não ouve mais o repositório. 8. Smoke test na URL `*.vercel.app` de produção; Safari/iPhone e Android reais. 9. Webhook de produção; **compra real + estorno** pelo cliente. 10. **Abertura controlada**: domínio ou subdomínio, checkout ligado, divulgação
restrita por alguns dias, monitorando alertas e webhooks diariamente. 11. Divulgação ampla quando 7 dias sem incidentes críticos.

---

## 11. Critérios objetivos para declarar "pronto para produção"

Todos precisam ser verdadeiros e com evidência:

1. Nenhum P0/P1 aberto nesta revisão.
2. Supabase de produção em plano com backup, 42 migrações aplicadas, `check:migrations`
   OK, RLS 32/32, bucket privado, `checkout_enabled` sob controle.
3. Vercel de produção em plano comercial, `npm run check:production` passando, sem
   variáveis herdadas desnecessárias.
4. Monitoramento ativo: erro no servidor gera alerta; disponibilidade checada a cada
   poucos minutos; alerta de webhook falhando ou pedido pago sem confirmação.
5. Reconciliação de pagamentos funcionando (testada em sandbox).
6. E-mails de conta e de pedido **entregues** em ambiente hospedado (com evidência de
   caixa de entrada).
7. Compra real de valor baixo + estorno concluídos pelo cliente, com webhook, e-mail e
   estoque corretos.
8. Safari (iPhone) e Chrome (Android) sem bloqueio no fluxo de compra.
9. Teste leve de carga sem erro 5xx e sem estoque inconsistente.
10. Decisões C-01 a C-07 registradas por escrito.
11. Roteiro de operação entregue ao cliente e um ensaio feito (cotação, envio, estorno,
    desligar checkout).
12. 2FA ativo em todas as contas críticas.
13. Plano de rollback ensaiado ao menos uma vez (desligar e religar o checkout; voltar
    um deploy).

---

## Anexo A — Avaliação crítica do plano proposto

| Pergunta                               | Resposta                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **O que está correto**                 | Separar Supabase e Vercel de produção; configurar Resend; revisar integrações; catálogo definitivo; não tocar a landing; runbook e rollback já escritos                                                                                                      |
| **O que falta**                        | Monitoramento/alertas (inexistente), reconciliação de pagamentos, homologação real de e-mail, Supabase Pro e backups, 2FA, visibilidade do repositório, NF-e, modelo de frete, titularidade das contas, roteiro de operação para a loja, abertura controlada |
| **Cedo demais**                        | Teste de carga pesado; catálogo definitivo antes do estoque real; corrigir o cron de staging (o `pg_cron` já resolve)                                                                                                                                        |
| **Deveria vir antes**                  | Decisões C-01..C-04 (prazos de terceiros); 2FA; e-mail real no staging; monitoramento; Safari antes de Firefox                                                                                                                                               |
| **Automatizável**                      | Reconciliação diária de pagamentos; smoke test pós-deploy (Playwright contra a URL de produção, só leitura); `check:production` e `check:migrations` no pipeline; verificação de disponibilidade; alerta de pedidos "em revisão"                             |
| **Custos desnecessários**              | Teste de carga em escala; ambientes customizados da Vercel (US$ 50/5); proteção de deploy paga só para o site de teste; manter o cache de imagens em 30 min se o tráfego crescer (avaliar 2 h)                                                               |
| **Riscos não considerados**            | Repositório público; Supabase Free; ausência total de monitoramento; e-mail nunca entregue; segredo JWT herdado; bots no cadastro; manutenção do Supabase em 30/11; dependência de uma pessoa                                                                |
| **Decisões a rever antes da produção** | (1) **Frete por cotação manual** — maior risco de conversão; (2) janela de 30 min × Pix/boleto; (3) MFA opcional para admins; (4) conta obrigatória; (5) Hobby em qualquer conta que sirva a loja                                                            |

## Anexo B — NÃO VERIFICADO

- Proteção da branch `main` e PRs abertos do Dependabot (API do GitHub em limite).
- Plano e cota do Resend; status de verificação do domínio no Resend.
- Para qual projeto Supabase apontam as variáveis `POSTGRES_*` / `SUPABASE_JWT_SECRET`
  do staging (valores não abertos).
- Desempenho em Android de entrada e Safari real; acessibilidade com leitor de tela.
- Capacidade sob carga.
- Status de aprovação da conta Mercado Pago de produção do cliente.
- Se o Hobby da Vercel permite repositório privado de organização e uso comercial
  (confirmar nos Termos).
- Texto da política de privacidade sobre exclusão de dados (não há função de excluir
  conta no app; o direito pode estar coberto por atendimento manual).
