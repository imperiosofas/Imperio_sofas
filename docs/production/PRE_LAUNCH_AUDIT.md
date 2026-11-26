# Pre-launch audit — Império Sofás (2026-11-26)

Escopo: preparar tudo o que é possível **sem** credenciais de produção e **sem**
decisões do cliente. Nenhuma ação foi feita em produção: sem deploy, sem DNS/domínio,
sem migração, sem credencial, sem pagamento real, sem mudança na landing.

Documentos desta pasta: `PRODUCTION_SETUP_RUNBOOK.md` (sequência de lançamento),
`PRODUCTION_ENV_TEMPLATE.md` (variáveis), `CATALOG_IMPORT_GUIDE.md`,
`ROLLBACK_PLAN.md`. Histórico da auditoria QA: `docs/audit/`.

## 1. Veredito

**Código pronto para produção, com uma condição:** a correção de e-mail de pagamento
tardio (§5) precisa ir ao staging (CI verde + smoke test) antes de virar a versão de
produção. **O lançamento depende de itens de conta, credenciais e decisões do cliente
(§11–§12)** — nenhum deles é código.

Bloqueadores de lançamento identificados nesta etapa (não existiam na documentação):

1. `commerce_settings.checkout_enabled` nasce **desligado** nas migrações: sem o passo
   de liberação (runbook §3.7), ninguém compra em produção.
2. Não existe um comando único para levar o catálogo do TESTE para a produção
   (`CATALOG_IMPORT_GUIDE.md` §2).
3. O estoque do TESTE (10 em tudo) é provisório.

## 2. Repositório e deploy (evidência)

| Item                                   | Resultado                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD                          | `staging` em `2a5ef00`, igual a `origin/staging`                                                                                                                                                                                                                                                      |
| Alterações pendentes antes desta etapa | nenhuma real (só diferenças de fim de linha do Windows)                                                                                                                                                                                                                                               |
| `origin/main`                          | `3289699`, 77 commits atrás, **ancestral** de `staging` → produção pode receber exatamente o commit validado por fast-forward, sem merge                                                                                                                                                              |
| Tags                                   | nenhuma                                                                                                                                                                                                                                                                                               |
| CI em `2a5ef00`                        | **quality** ✅ (build, typecheck, format, lint, testes) e **database** ✅ (banco recriado do zero com as 42 migrações + testes de RLS)                                                                                                                                                                |
| Deploy de staging em `2a5ef00`         | "Vercel – imperio-sofas: success" (status no GitHub)                                                                                                                                                                                                                                                  |
| Configuração da Vercel                 | **não inspecionada nesta etapa**: a extensão do Chrome estava desconectada. Conhecido de etapas anteriores: projeto `imperio-sofas`, time "Imperio Sofas" no **Hobby**, branch de produção do projeto = `staging` (é o site de teste), `.vercelignore` exclui `docs/`, `tests/`, `supabase/`, `.env*` |
| Discrepâncias doc × repositório        | `docs/production-blockers.md` (02/10) desatualizado → marcado; `GO_LIVE_CHECKLIST.md` dizia que os commits pós-`ec407a9` eram só docs → corrigido; `MP_ENV` documentado antes como `production` → o código exige `live` (corrigido na etapa anterior)                                                 |

## 3. Configuração de produção

- `.env.production.example` criado (sem valores; liberado no `.gitignore`).
- `PRODUCTION_ENV_TEMPLATE.md`: cada variável com formato, origem, dono, opcional ou
  dependente de decisão.
- `check:production`: exige só o que o código lê; aplica as regras de produção do
  próprio código (`INTEGRATION_MODE=live`, `MP_ENV=live`, `MP_EXPECTED_COLLECTOR_ID`,
  `CRON_SECRET` ≥ 32, `APP_URL` https, `CATALOG_SOURCE=supabase`); Bling só se
  configurado; **novo:** recusa token `TEST-` do Mercado Pago. Testado com valores
  fictícios: completo → passa; Bling pela metade, `MP_ENV=sandbox`, `CRON_SECRET`
  curto, sem collector → falha. Nunca imprime valores.
- Teste garante que o modelo lista todas as variáveis obrigatórias.

## 4. Supabase

| Item                          | Evidência                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrações                     | **42**, nomes e ordem válidos, sem versão duplicada (`npm run check:migrations`, agora também no CI)                                            |
| Reprodutibilidade             | job **database** do CI recria o banco do zero e roda os testes de RLS (verde)                                                                   |
| RLS                           | 32 de 32 tabelas; nenhuma migração desliga RLS                                                                                                  |
| Objetos                       | 84 funções, 26 policies, 18 triggers, 46 índices; RPCs críticas presentes (catálogo, carrinho, checkout, webhook, expiração, admin)             |
| Storage                       | `catalog-images` criado **privado** (10 MB, jpeg/png/webp); policies: leitura só de foto publicada, upload/remoção só admin                     |
| Job agendado                  | `expire-pending-orders` a cada 5 min (`pg_cron`, criado pela migração)                                                                          |
| Dados criados pelas migrações | fornecedores `VALE`/`MUNDIAL`, 12 cidades, retirada "Galpão Vale", regras de andar, `commerce_settings` (checkout **desligado**, janela 30 min) |
| Seed                          | `supabase/seed.sql` (5 produtos de desenvolvimento) **não deve** ir para produção — `db push` não aplica seed                                   |
| Admin                         | sem admin padrão; procedimento em `docs/admin-catalog.md`                                                                                       |
| Auth                          | configurações do painel listadas no runbook §3.5 (inclui "Require current password when updating")                                              |
| Diferença conhecida           | migrações `20261125120000/130000` aplicadas no TESTE pelo SQL Editor; não afeta produção nova                                                   |

Não verificado: comparação da configuração de logística editada no TESTE com o que as
migrações criam (tabelas acessíveis só por funções; o SQL Editor não estava
disponível). Conferência manual em `/admin/entregas` incluída no runbook.

## 5. Mercado Pago e Resend

**Mercado Pago (revisão de código):** assinatura HMAC conferida; pagamento sempre
consultado na API com a credencial da loja (corpo do webhook não é confiado); BRL;
conta recebedora (`collector_id`) conferida; valor conferido no banco; idempotência
por evento; aprovação nunca rebaixada; estorno não reabre pedido; deadlock de
webhooks simultâneos corrigido; preferência expira junto com a reserva. Pendente
(P3, já registrado como SEC2-03): sem limite de idade do timestamp da assinatura.

**Defeito corrigido nesta etapa:** o webhook enviava o e-mail de "pagamento aprovado"
só para o resultado `paid`; um pagamento tardio que ainda encontrou estoque
(`paid_late`) virava pedido pago **sem e-mail**. Agora envia para os dois; a chave de
idempotência do Resend impede duplicidade. Alteração de 1 linha em
`src/app/api/webhooks/mercadopago/route.ts`. **Validar no staging antes do
lançamento.**

**Resend:** envio "melhor esforço" (nunca bloqueia pedido), idempotente por pedido e
tipo, sem dados pessoais nos logs, cópia para a loja em pagamento e desistência.
E-mails de conta (confirmação, recuperação) são do Supabase Auth: templates em
`supabase/email-templates/`, enviados pelo SMTP configurado no painel.

## 6. Catálogo

- Modelo CSV + validador **dry-run** (`scripts/catalog/validate-catalog-csv.mjs`):
  preço (formato BR), estoque obrigatório (nunca inventado), categoria, medidas, slug,
  SKU, duplicidades, imagens (existência, formato real, 10 MB), produto
  tudo-ou-nada, relatório `.md` + `.json`.
- A **gravação** a partir do CSV não foi implementada (depende das decisões §12).
- Catálogo do TESTE não foi alterado.

## 7. Regressão final (build local com todas as alterações, banco TESTE)

| Verificação                                                                                                                      | Resultado                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Typecheck                                                                                                                        | OK                                                                                                             |
| Lint                                                                                                                             | 0 erros (2 avisos antigos de `<img>` na landing)                                                               |
| Formatação                                                                                                                       | OK (ignorando fim de linha do Windows; CI Linux confere)                                                       |
| Testes unitários                                                                                                                 | **169/169** (152 anteriores + 17 novos: 2 do `check:production`, 5 de migrações, 10 do validador de catálogo)  |
| Build de produção                                                                                                                | OK                                                                                                             |
| E2E QA (cadastro, login, conta, troca/recuperação de senha, carrinho, checkout, pagamento simulado, admin, upload, erros, links) | **92 PASS, 0 FAIL**; limpeza sem resíduo                                                                       |
| E2E do repositório (navegação, toque, catálogo, comércio, logística, export)                                                     | 39 PASS, 1 pulado (marcado no arquivo)                                                                         |
| Varredura de console/rede/overflow — 11 páginas × celular e desktop                                                              | sem erro de console, sem requisição falha, sem rolagem horizontal, sem imagem quebrada (exceto o 404 esperado) |
| `check:migrations`                                                                                                               | OK                                                                                                             |

Não executado nesta etapa: Safari, Firefox, carga, pagamento real, leitores de tela
(`docs/audit/PRE_LAUNCH_TESTS.md`); Lighthouse (números da etapa anterior em
`docs/audit/PERF_IMAGES_2026-11-25.md`).

## 8. Alterações feitas nesta etapa

| Arquivo                                                                                                                              | Tipo                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `src/app/api/webhooks/mercadopago/route.ts`                                                                                          | correção (e-mail em `paid_late`) — **roda na loja** |
| `scripts/check-production-ready.mjs`, `tests/check-production-ready.test.mjs`                                                        | verificação (recusa `TEST-`; modelo sincronizado)   |
| `scripts/verify-migrations.mjs`, `tests/verify-migrations.test.mjs`, `package.json` (`check:migrations`), `.github/workflows/ci.yml` | verificação offline das migrações                   |
| `scripts/catalog/validate-catalog-csv.mjs`, `tests/validate-catalog-csv.test.mjs`, `docs/production/catalog-import-template.csv`     | validador de catálogo (dry-run)                     |
| `.env.production.example`, `.gitignore`                                                                                              | modelo de variáveis                                 |
| `docs/production/*.md`, notas em `docs/audit/GO_LIVE_CHECKLIST.md` e `docs/production-blockers.md`                                   | documentação                                        |

## 9. Bloqueadores restantes

| Bloqueador                                                    | Tipo                         |
| ------------------------------------------------------------- | ---------------------------- |
| Validar a correção do webhook no staging (push + CI + smoke)  | ACESSO (autorização de push) |
| Vercel Pro + projeto de produção separado                     | ACESSO                       |
| Supabase de produção (projeto, migrações, Auth, SMTP, admin)  | ACESSO                       |
| Resend: domínio verificado + chave                            | ACESSO, CRED                 |
| Mercado Pago: credenciais e webhook de produção, collector ID | CLIENTE, CRED                |
| Catálogo real: caminho de importação + **estoque real**       | CLIENTE                      |
| Decisões comerciais (parcelas, boleto/janela de reserva)      | CLIENTE                      |
| Domínio: plano de corte e onde está o DNS                     | CLIENTE, ACESSO              |
| Testes Safari/Firefox/carga e compra real + estorno           | ACESSO, CRED                 |

## 10. O que o assistente pode fazer em seguida (com autorização)

- Push desta etapa para `staging` e acompanhar CI e deploy.
- Rodar a suíte E2E também no Firefox.
- Preparar e testar no TESTE um script de cópia de catálogo TESTE → produção (dry-run
  primeiro), se o cliente escolher esse caminho.
- Aplicar as migrações na produção **somente** com o seu acesso e autorização explícita
  no dia.

## 11. Ações necessárias de você

1. Autorizar o push desta etapa para `staging`.
2. Vercel: plano Pro no time que vai hospedar a loja; criar o projeto de produção
   (branch `main`, região `gru1`); alerta de gasto.
3. Supabase: criar o projeto de produção (São Paulo), backups; aplicar migrações
   (runbook §3.3) e configurar Auth/SMTP (§3.5).
4. Resend: verificar o domínio do remetente; gerar a chave.
5. Cadastrar as variáveis na Vercel (`PRODUCTION_ENV_TEMPLATE.md`) e rodar
   `npm run check:production`.
6. Combinar com o cliente os itens de §12 e a janela de lançamento.
7. Fazer a compra real de valor baixo + estorno junto com o cliente.

## 12. Perguntas para o cliente

1. **Mercado Pago**: a conta de produção está aprovada para receber? Quem vai gerar
   as credenciais de produção e configurar o webhook (pode ser numa chamada com você)?
   Qual é o user id da conta que recebe?
2. **Parcelamento**: em até quantas vezes, com ou sem juros?
3. **Boleto/Pix**: aceitar boleto? (a reserva do estoque hoje dura 30 min; o máximo
   configurável é 24 h, e boleto compensa em 1–3 dias úteis)
4. **Catálogo**: produção = mesmo catálogo do TESTE (63 produtos)? Os 10 rascunhos
   entram? As fotos estão aprovadas para uso comercial?
5. **Estoque real** de cada SKU no dia do lançamento.
6. **E-mails**: qual endereço remetente (ex.: `pedidos@imperiosofas.com.br`) e qual
   caixa recebe a cópia dos pedidos?
7. **Domínio**: a loja substitui a landing em `www.imperiosofas.com.br`? Onde está o
   DNS (Vercel ou outro registrador)? Melhor horário para o corte?
8. **Logística**: cidades atendidas, fornecedores, prazos e endereço de retirada
   continuam os do TESTE?
9. **Bling**: usar agora ou depois do lançamento?
