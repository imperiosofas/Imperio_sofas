# QA_TEST_PLAN — Império Sofás (auditoria 2026-11-25)

Ambiente: site de TESTE (`staging` → imperio-sofas-woad.vercel.app), Supabase TESTE
(`qsafyqsskwbjnailgoev`), build de produção local em `http://localhost:3190` com
pagamento simulado (`mock`). Nenhum dado real de cliente foi usado; toda conta,
produto e pedido criados pelos testes são temporários e removidos no teardown.

## 1. Escopo e frentes

| Frente                         | Ferramenta                                                            | Onde está                                         |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------- |
| Funcional / E2E (cenários A–E) | Playwright                                                            | `tests/e2e-qa/*.qa.spec.cjs`                      |
| Regressão do repositório       | Playwright + `node --test`                                            | `tests/e2e/*.spec.ts`, `*.test.mjs`               |
| Segurança (defensiva)          | Scripts de autorização (RLS, RPC, rotas)                              | resultado em `SECURITY_AUDIT.md`                  |
| Banco / concorrência           | Scripts Node contra o Supabase TESTE (usuários e produto temporários) | resultado em `QA_AUDIT_REPORT.md` §4              |
| UX/UI + acessibilidade         | axe-core, navegação por teclado, zoom 200%                            | `BUG_TRACKING.md` (UX, A11Y)                      |
| Responsivo                     | Playwright 320, 360, 390, 414, 768, 1024, 1280, 1440, 1920 px         | `BUG_TRACKING.md` (RESP)                          |
| Performance                    | Lighthouse mobile (site publicado)                                    | `QA_AUDIT_REPORT.md` §2, `BUG_TRACKING.md` (PERF) |

## 2. Cenários E2E

**A — Cliente novo:** cadastro → confirmação → login → loja → filtro/busca → produto
→ favoritar → carrinho (quantidade, remover) → CEP/frete → checkout (termos) →
pagamento simulado aprovado → pedido "pago" em /conta/pedidos → estoque baixado.

**B — Cliente existente:** login → editar perfil → endereços → troca de senha (exige
senha atual) → pedido → pagamento recusado → nova tentativa → cancelamento pelo
cliente → estoque devolvido.

**C — Concorrência (banco):** dois clientes pela última unidade; duplo clique no
checkout com a mesma chave de idempotência; webhooks repetidos/fora de ordem;
aprovação tardia após expiração (com e sem estoque); valor divergente; pagamento
duplicado em pedido já pago; expiração automática (pg_cron); cancelamento × aprovação
simultâneos; resolução de pedido em revisão pelo admin.

**D — Admin:** login admin → criar produto (rascunho) → variante/estoque → publicar
→ editar → produto aparece na loja → pedidos → detalhe com eventos → relatórios →
exclusão do produto de teste (404 na loja).

**E — Falhas:** rede off durante ações do carrinho/favoritos; formulários inválidos;
sessão expirada; acesso a rotas de admin como cliente; IDs inexistentes; varredura de
links quebrados (logado e deslogado).

## 3. Como rodar

```
npm run typecheck ; npm run lint ; node --test $(git ls-files "*.test.mjs") ; npm run build
npx playwright test --config playwright.config.ts
npx playwright test -c tests/e2e-qa/playwright.config.cjs   # exige build local em :3190 apontando para o banco de TESTE
```

O `global-teardown` da suíte QA compara pedidos, produtos e estoque com o retrato
inicial e falha se algo ficar diferente.

## 4. Critérios de aprovação

- Nenhum P0/P1 aberto.
- Typecheck, lint (0 erros), testes unitários, build e as duas suítes E2E verdes,
  exceto falhas classificadas e documentadas como P3.
- Teardown limpo (nenhum resíduo no banco de TESTE).
- Itens que dependem de terceiros (Mercado Pago produção, Resend, decisão comercial)
  aparecem como **bloqueado externamente**, nunca como aprovados.
