# QA_AUDIT_REPORT — Império Sofás (2026-11-25)

Auditoria completa de QA, segurança, UX/UI, responsividade, performance, banco e
acessibilidade do e-commerce, feita só no ambiente de TESTE
(`imperio-sofas-woad.vercel.app` + Supabase TESTE). A landing de produção
(`www.imperiosofas.com.br`) e o banco de produção não foram tocados. Nenhum segredo
aparece neste relatório.

Documentos ligados: `QA_TEST_PLAN.md` (como foi testado), `BUG_TRACKING.md` (todos
os achados com status), `SECURITY_AUDIT.md`.

## 1. Veredito

**Aprovado no TESTE/staging; ainda não liberado para produção.** Não há P0 nem
P1 aberto no código ou no ambiente de teste:

- QA-01 (senha atual na troca de senha) fechado no TESTE com "Require current
  password when updating" (4/4 testes, inclusive redefinição por e-mail).
- PERF-01 (imagens) fechado e validado no staging com rota de imagens em cache, sem
  tornar o bucket público (`PERF_IMAGES_2026-11-25.md`).

- QA-03 (HTTP 404 real para produto/categoria inexistente) corrigido em 2026-11-26.

A liberação para produção depende só de configuração e de itens externos, listados
em `GO_LIVE_CHECKLIST.md` (plano Vercel, Supabase de produção, credenciais do
Mercado Pago e do Resend, decisões comerciais). Relatório final:
`PRODUCTION_READINESS_2026-11-26.md`.

## 2. Números

| Frente                                                                              | Verificações                                               | Resultado                                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Funcional E2E (cenários A, B, D, E + varredura de links)                            | 92 verificações em 9 specs                                 | 89 PASS, 3 FAIL — todos QA-03 (P3, HTTP 200 em página "não encontrado")                                                               |
| Banco / concorrência (cenário C)                                                    | 21 testes + 15 rodadas de webhooks concorrentes            | Antes: 12 PASS / 6 FAIL (18 testes). Depois das 2 migrações: todos PASS, exceto C-18 parcial (P3); 0 deadlocks em 15 rodadas — ver §4 |
| Segurança defensiva                                                                 | 6 frentes + 208 verificações de autorização                | 0 desvios; 4 achados (1 P2 corrigido, 3 P3 abertos)                                                                                   |
| Acessibilidade (axe + teclado + zoom 200%)                                          | todas as páginas da loja, conta, checkout e admin          | 3 P1 corrigidos; P2/P3 restantes em `BUG_TRACKING.md`                                                                                 |
| Responsivo (320 → 1920 px, 9 larguras)                                              | todas as rotas principais                                  | sem quebra de layout; alvos de toque e teclado corrigidos                                                                             |
| Lighthouse mobile (site publicado; `/loja` depois de PERF-01: 79–83, LCP 3,1–3,2 s) | `/` 76 · `/loja` 69–73 · produto 81–86 · `/carrinho` 75–83 | PERF-01 é o principal fator                                                                                                           |

## 3. Corrigido nesta rodada

Pagamento e estoque (migrações `20261125120000_payment_and_inventory_hardening.sql`
e `20261125130000_payment_event_review_fixes.sql`, aplicadas no TESTE): DB2-01,
DB2-02, DB2-03, DB2-04, DB2-07 (deadlock de webhooks), DB2-08.

Código: SEC2-04, QA-01 (app + configuração do Supabase TESTE), QA-02, QA-04, QA-05, DB2-05 (UX-02/PERF-05), UX-01, UX-03,
UX-06, UX-07, UX-08, plural do admin, A11Y-01, A11Y-02 (adicionar ao carrinho),
A11Y-03, A11Y-04, A11Y-05 (nomes), RESP-01, RESP-02, RESP-03 ("ao lado"), PERF-02
(assinatura de imagens em lote), QA-07, QA-08, QA-09.

Uma revisão independente do diff (agente separado, só leitura) encontrou 2 P1, 3 P2 e
5 P3; todos os de código foram corrigidos e retestados (C-19 a C-21), e os demais
estão em `BUG_TRACKING.md`.

Nenhuma funcionalidade foi removida; a identidade visual foi mantida (só tons de
dourado escurecidos para atingir contraste).

## 4. Banco de dados e concorrência

Testes com usuários, produto e pedidos temporários, removidos ao final (resíduo 0;
pedidos 2/2, produtos 63/63, estoque inalterado).

| Teste                                                          | Antes | Depois                                                                                                                              |
| -------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| C-01 dois clientes pela última unidade                         | PASS  | PASS                                                                                                                                |
| C-02 / C-07 webhooks repetidos e concorrentes                  | PASS  | PASS; numa reexecução apareceu deadlock (DB2-07) → corrigido, 15 rodadas sem falha                                                  |
| C-03 aprovação com outro valor em pedido pago                  | FAIL  | PASS                                                                                                                                |
| C-04 duplo envio do checkout (mesma chave)                     | FAIL  | PASS                                                                                                                                |
| C-05 / C-06 20 alterações simultâneas no carrinho              | PASS  | PASS                                                                                                                                |
| C-08 expiração automática (pg_cron)                            | PASS  | PASS                                                                                                                                |
| C-09 / C-10 aprovação tardia com e sem estoque                 | PASS  | PASS                                                                                                                                |
| C-11 admin encerra pedido em revisão com pagamento aprovado    | FAIL  | PASS                                                                                                                                |
| C-12 / C-13 valor errado; encerramento concorrente pelo admin  | PASS  | PASS                                                                                                                                |
| C-14 valor errado em pedido cancelado                          | FAIL  | PASS                                                                                                                                |
| C-15 cancelamento × aprovação simultâneos                      | PASS  | PASS                                                                                                                                |
| C-16 2º pagamento aprovado em pedido já pago                   | FAIL  | PASS por desenho: pagamento extra registrado como "em análise", pedido com alerta e evento `duplicate_payment_received`             |
| C-17 estorno + encerramento                                    | PASS  | PASS                                                                                                                                |
| C-19 atualização posterior do mesmo pagamento com valor errado | —     | PASS (sem alerta falso de pagamento duplicado)                                                                                      |
| C-20 "aprovado" depois de o admin encerrar com estorno         | —     | PASS (pedido continua cancelado, estoque intacto)                                                                                   |
| C-21 contador corrompido: expiração marca uma vez e segue      | —     | PASS                                                                                                                                |
| C-18 `reserved` corrompido manualmente                         | FAIL  | Parcial: a expiração não trava mais; a aprovação desse pedido ainda falha. Cliente não consegue mais corromper o campo (DB2-02). P3 |

## 5. Não testado

- Pagamento real e credenciais de produção do Mercado Pago (proibido/fora do escopo).
  O fluxo de teste do Mercado Pago foi validado antes (pedido 1019 pago via webhook).
- Envio real de e-mails de pedido (não exercitado nesta rodada).
- Testes ofensivos, força bruta e carga.
- Navegadores Safari/Firefox reais (só Chromium via Playwright).

## 6. Regressão final (2026-11-26)

Build de produção local com todas as correções (inclui PERF-01 e QA-03), banco de
TESTE com as duas migrações e "Require current password when updating" ligado.

| Verificação                                                                               | Resultado                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Typecheck                                                                                 | OK                                                                 |
| Lint                                                                                      | 0 erros (2 avisos antigos de `<img>` na landing)                   |
| Testes unitários (`node --test`, 19 arquivos)                                             | 146/146 PASS                                                       |
| Build de produção                                                                         | OK                                                                 |
| E2E do repositório (`playwright.config.ts`)                                               | 39 PASS, 1 pulado (marcado no próprio arquivo)                     |
| E2E QA (`tests/e2e-qa`, cenários A, B, D, E + links)                                      | 9/9 specs; **92 PASS, 0 FAIL**                                     |
| Banco: concorrência e pagamentos (C-01 a C-21)                                            | 18/18 da suíte principal PASS                                      |
| Webhooks simultâneos do mesmo pedido                                                      | 10 rodadas, 0 deadlocks, estoque exato                             |
| Rota de imagens (publicado, rascunho, despublicado, inexistente, inválida, outro produto) | 11/11 PASS                                                         |
| Troca de senha / redefinição por e-mail                                                   | 4/4 PASS                                                           |
| 404 real (produto, categoria, produto excluído, rota inexistente)                         | PASS; páginas válidas continuam 200 com esqueleto de carregamento  |
| Teardown / resíduo no banco de TESTE                                                      | 0 (pedidos 2/2, produtos 63/63, 105 variações, estoque inalterado) |

Não executado: `playwright.navigation.config.ts` (exige um build separado em
`.next-nav-overflow-fix`); o comportamento que ele cobre (esqueleto na abertura
direta do produto) foi conferido no HTML da página. Foco após "Adicionar ao
carrinho" (A11Y-02) não foi conferido manualmente no navegador.
