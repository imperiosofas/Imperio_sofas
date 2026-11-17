# Relatório de QA (17/11/2026)

## Bloqueio do ambiente

O Supabase TEST (`qsafyqsskwbjnailgoev.supabase.co`) não resolvia no DNS (NXDOMAIN, testado no DNS local, 8.8.8.8 e 1.1.1.1), provavelmente porque o projeto foi pausado. Consequências no site de teste (`imperio-sofas-woad.vercel.app`): `/loja` → HTTP 500, categorias e produtos mostram a tela de erro, login/cadastro/recuperação falham com `ERR_NAME_NOT_RESOLVED`. **Todo cenário que precisa de banco ou login ficou NÃO EXECUTADO** — não é falha do código, mas também não foi verificado.

## Comandos e resultados (antes × depois das correções)

| Verificação                                            | Antes                                  | Depois                                               | Comando                                                                                       |
| ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Typecheck                                              | OK                                     | OK                                                   | `npm run typecheck`                                                                           |
| Lint                                                   | 0 erros, 2 avisos (`<img>` da landing) | 0 erros, 2 avisos                                    | `npm run lint`                                                                                |
| Unitários                                              | 125/125                                | **127/127** (+`money.test.mjs`)                      | `node --test tests/*.test.mjs`                                                                |
| Unitários do admin de logística (fora do CI até agora) | não rodavam                            | **12/12** e incluídos no CI                          | `node --test src/features/admin/logistics/*.test.mjs`                                         |
| Build de produção                                      | OK                                     | OK                                                   | `npm run build`                                                                               |
| E2E Playwright (local, catálogo de teste)              | 38 ok, **1 falha**, 1 pulado           | **39 ok, 0 falha**, 1 pulado                         | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3174 npx playwright test --config playwright.config.ts` |
| Acessibilidade (axe) em `/`, `/loja`, `/conta`         | sem violações graves                   | sem violações graves                                 | incluído no E2E (`@a11y`)                                                                     |
| `npm audit --omit=dev`                                 | 1 crítico, 1 alto                      | **0**                                                | `npm audit --omit=dev`                                                                        |
| pgTAP (`supabase/tests`)                               | —                                      | **não executado** (precisa do Supabase local/Docker) | `npm run db:test`                                                                             |

O teste pulado (`navigation-auth.spec.ts:328`) já vinha marcado como `skip` no próprio arquivo.

Na rodada final, depois das correções da revisão independente, o teste `touch navigation and auth remain usable at 375x812` falhou uma vez porque arquivos foram editados durante a execução (o servidor de desenvolvimento recarregou no meio do teste). Rodado de novo sozinho, passou nas 6 larguras.

## Verificações manuais no build de produção (`next start`, local)

| Verificação                                               | Resultado                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Headers em `/termos`                                      | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS presentes |
| Headers em `/auth/confirm`                                | mantém a CSP estrita e `no-referrer` da página intermediária                            |
| `POST /auth/confirm` com `Sec-Fetch-Site: cross-site`     | recusado (307 → `/conta?erro=confirmacao`)                                              |
| `/conta/redefinir-senha` sem sessão/cookie de recuperação | redireciona (307)                                                                       |

## Cenários funcionais no site de teste

| Cenário                                                      | Resultado             | Observação                                                                                        |
| ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------- |
| A1 Home                                                      | PASSOU                | 200, sem erro de console, sem overflow em 360/390/768/1366/1920                                   |
| A2 `/loja` (busca, ordem, página 2)                          | FALHOU (ambiente)     | 500 — banco fora do ar                                                                            |
| A3 Categoria                                                 | FALHOU (ambiente)     | 200 com tela de erro                                                                              |
| A4 Página de produto                                         | NÃO EXECUTADO         | sem catálogo                                                                                      |
| A5 Produto/categoria inexistente                             | INCONCLUSIVO          | banco falha antes; rota inexistente comum → 404 correto                                           |
| A6 Filtros/ordenação                                         | PASSOU no E2E local   | `catalog-listing.spec`                                                                            |
| B Validação de cadastro (e-mail inválido, senhas diferentes) | PASSOU                |                                                                                                   |
| B Senha fraca                                                | CORRIGIDO             | campo sem mínimo → agora `minLength=8` com dica                                                   |
| B Rotas protegidas sem login                                 | PASSOU                | `/conta/*`, `/carrinho`, `/checkout`, `/pedido/<uuid>`, 21 rotas `/admin/**` → 307; `.xlsx` → 401 |
| B Redirecionamento externo em `next`                         | PASSOU                | volta para o próprio site                                                                         |
| B Login/logout/recuperação reais                             | NÃO EXECUTADO         | banco fora                                                                                        |
| C Carrinho                                                   | NÃO EXECUTADO         | precisa de login; servidor valida quantidade/preço (revisão de código)                            |
| D Conta                                                      | NÃO EXECUTADO         | precisa de login                                                                                  |
| E Admin sem login                                            | PASSOU                |                                                                                                   |
| E Admin como cliente / como admin                            | NÃO EXECUTADO ao vivo | autorização revisada no código e nas RPCs                                                         |
| F Pedidos / pedido de terceiros                              | NÃO EXECUTADO ao vivo | RLS revisada estaticamente                                                                        |
| G Responsivo (páginas sem login)                             | PASSOU                | sem overflow; barra inferior não cobre botões                                                     |
| G Responsivo logado (carrinho, conta, checkout)              | NÃO EXECUTADO         | precisa de login                                                                                  |

## Falhas encontradas e situação

| Id    | Falha                                                                     | Severidade         | Situação                                            |
| ----- | ------------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| QA-01 | Loja/categorias/produtos quebrados no site de teste                       | Crítico (ambiente) | **Pendente**: reativar o Supabase TEST              |
| QA-02 | `/api/cron/expire-orders` responde 503 (sem `CRON_SECRET`)                | Médio              | Pendente (configuração)                             |
| QA-03 | Subpáginas do admin perdem o `next=` ao pedir login                       | Baixo              | Pendente (registrado)                               |
| QA-04 | Indicador da barra inferior errado após "Voltar" (teste do repo falhando) | Baixo/Médio        | **Corrigido** (`BottomNavigation.tsx`), teste passa |
| QA-05 | Categoria/produto com erro respondem 200 (streaming do `loading.tsx`)     | Baixo              | Pendente (registrado)                               |
| QA-06 | "Continuar para a loja" na tela de erro volta para a página quebrada      | Baixo              | Pendente                                            |
| QA-07 | Cadastro sem requisito de senha visível                                   | Baixo              | **Corrigido**                                       |

## Como repetir os testes que dependem do banco

1. Reativar o Supabase TEST e aplicar as migrations pendentes (ver REMAINING_TASKS.md).
2. Probe de autorização: `node scripts/audit/probe-db-authz.cjs` (lê `.env.local`, recusa rodar fora do projeto TEST, cria 2 usuários temporários, testa os 8 cenários de RLS e apaga só o que criou; resultado em `%TEMP%/imperio-probe-results.json`).
3. QA logado: criar um cliente temporário pela Admin API, rodar C/D/E/F/G e apagar o usuário no final.
