# Relatório de QA (17/11/2026)

## Ambiente

1. **Primeira rodada:** o Supabase TEST (`qsafyqsskwbjnailgoev`) estava pausado (DNS NXDOMAIN). O site de teste dava 500 em `/loja` e tudo que dependia de banco ou login ficou sem testar.
2. **Segunda rodada (mesmo dia):** o projeto foi reativado pelo painel. Nesta rodada:
   - as migrations `20261105120000` e `20261117120000` foram aplicadas no TEST pelo editor SQL ("Success");
   - os testes de permissão rodaram ao vivo;
   - os fluxos com login rodaram com o **código novo em build de produção local** (`next start` em `127.0.0.1:3190`) ligado ao Supabase TEST.

   O site da Vercel **não foi atualizado** (sem push/deploy, a pedido).

Todo dado de teste foi criado com usuários temporários `audit-*@example.test` e apagado no fim: pedidos, usuários e admin temporário. Estoque e preço foram conferidos de volta ao valor original (Poltrona Josy: estoque 9, R$ 399,00). Contagem final: 0 usuários `audit-*` restantes.

## Comandos e resultados (antes × depois das correções)

| Verificação                                            | Antes                                  | Depois                                                                                                                   | Comando                                                                                       |
| ------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Typecheck                                              | OK                                     | OK                                                                                                                       | `npm run typecheck`                                                                           |
| Lint                                                   | 0 erros, 2 avisos (`<img>` da landing) | 0 erros, 2 avisos                                                                                                        | `npm run lint`                                                                                |
| Unitários                                              | 125/125                                | **127/127** (+`money.test.mjs`)                                                                                          | `node --test tests/*.test.mjs`                                                                |
| Unitários do admin de logística (fora do CI até agora) | não rodavam                            | **12/12** e incluídos no CI                                                                                              | `node --test src/features/admin/logistics/*.test.mjs`                                         |
| Build de produção                                      | OK                                     | OK                                                                                                                       | `npm run build`                                                                               |
| E2E Playwright do repositório (catálogo local)         | 38 ok, **1 falha**, 1 pulado           | **39 ok, 0 falha**, 1 pulado                                                                                             | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3174 npx playwright test --config playwright.config.ts` |
| Acessibilidade (axe) em `/`, `/loja`, `/conta`         | sem violações graves                   | sem violações graves                                                                                                     | incluído no E2E (`@a11y`)                                                                     |
| `npm audit --omit=dev`                                 | 1 crítico, 1 alto                      | **0**                                                                                                                    | `npm audit --omit=dev`                                                                        |
| Probe de RLS ao vivo (199 verificações, 8 cenários)    | 1 vazamento (user_id de avaliadores)   | **0 vazamentos**                                                                                                         | `node scripts/audit/probe-db-authz.cjs`                                                       |
| Fluxo logado do cliente (Playwright, 41 verificações)  | —                                      | **41/41** depois da correção do checkout                                                                                 | `scripts/audit/qa/logged-flow.spec.cjs`                                                       |
| Fluxo do admin (Playwright, 6 verificações)            | —                                      | **6/6**                                                                                                                  | `scripts/audit/qa/admin-flow.spec.cjs`                                                        |
| pgTAP (`supabase/tests`)                               | —                                      | **não executado** (precisa do Supabase local/Docker); as mesmas garantias foram checadas ao vivo pelo probe e pelas RPCs | `npm run db:test`                                                                             |

O teste pulado (`navigation-auth.spec.ts:328`) já vinha marcado como `skip` no próprio arquivo. Na rodada final da suíte do repositório, `touch navigation ... at 375x812` falhou uma vez porque arquivos foram editados durante a execução (recarga do servidor de desenvolvimento); rodado de novo, passou nas 6 larguras.

## Verificações no build de produção (local)

| Verificação                                                          | Resultado                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Headers em `/termos`                                                 | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS presentes |
| Headers em `/auth/confirm`                                           | mantém a CSP estrita e `no-referrer` da página intermediária                            |
| `POST /auth/confirm` com `Sec-Fetch-Site: cross-site`                | recusado (307 → `/conta?erro=confirmacao`)                                              |
| `/conta/redefinir-senha` sem cookie de recuperação                   | redireciona                                                                             |
| Login com cookie `Secure` em `http://127.0.0.1` e `http://localhost` | funciona (Chromium aceita em loopback)                                                  |

## Cenários funcionais

| Cenário                                                                | Resultado                         | Evidência                                                     |
| ---------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| A1 Home                                                                | PASSOU                            | 200, sem overflow em 360/390/768/1366/1920                    |
| A2 `/loja` e A3 categoria                                              | PASSOU depois de reativar o banco | `/loja` 200 local e no site de teste                          |
| A4 Página de produto (preço, fotos)                                    | PASSOU                            | `/produto/poltrona-josy`                                      |
| A5 Produto/pedido inexistente                                          | PASSOU                            | `/pedido/<uuid aleatório>` → não encontrado                   |
| A6 Filtros/ordenação                                                   | PASSOU                            | E2E `catalog-listing.spec`                                    |
| B Cadastro: e-mail inválido, senhas diferentes, senha curta            | PASSOU / CORRIGIDO                | `minLength=8` com dica                                        |
| B Login                                                                | PASSOU                            |                                                               |
| B Logout → página protegida                                            | PASSOU                            | `/conta/pedidos` → `/conta?next=...`                          |
| B Rotas protegidas sem login                                           | PASSOU                            | 21 rotas `/admin/**` → 307; `.xlsx` → 401                     |
| B Redirecionamento externo em `next`                                   | PASSOU                            | volta para o próprio site                                     |
| B Recuperação de senha por e-mail real                                 | NÃO EXECUTADO                     | exigiria enviar e-mail real                                   |
| C Adicionar ao carrinho                                                | PASSOU                            |                                                               |
| C Quantidade +1 e persistência após recarregar                         | PASSOU                            | quantidade 2                                                  |
| C Clique duplo em "diminuir"                                           | PASSOU                            | parou em 1 (não removeu nem foi a 0)                          |
| C Preço não enviado pelo navegador                                     | PASSOU                            | nenhum campo de preço no carrinho; total recalculado no banco |
| D Editar nome e telefone, persistência                                 | PASSOU                            |                                                               |
| E Cliente tentando `/admin/pedidos` e `.xlsx`                          | PASSOU                            | 404 e 401                                                     |
| E Admin vê desistência, registra estorno com reposição                 | PASSOU                            | status `refunded`, estoque 8 → 9, formulário some depois      |
| E Edição rápida de preço digitando "399.00"                            | PASSOU                            | gravou 39900 (antes do conserto gravaria 3.990.000)           |
| F Checkout sem aceitar termos                                          | PASSOU                            | continua no checkout                                          |
| F Pedido criado, dono correto, termos e consentimento gravados         | PASSOU                            |                                                               |
| F Pagamento simulado (mock) aprovado                                   | PASSOU                            | status `paid`                                                 |
| F Desistência com protocolo imediato                                   | PASSOU                            | banner com data/hora + gravado no banco                       |
| G Responsivo logado (carrinho, perfil, checkout, produto) × 5 larguras | PASSOU depois da correção         | ver QA-08                                                     |

## Falhas encontradas e situação

| Id    | Falha                                                                                                                                                                                | Severidade         | Situação                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| QA-01 | Loja/categorias quebradas no site de teste                                                                                                                                           | Crítico (ambiente) | **Resolvido** com a reativação do Supabase TEST                                             |
| QA-02 | `/api/cron/expire-orders` responde 503 (sem `CRON_SECRET`)                                                                                                                           | Médio              | Pendente (configuração)                                                                     |
| QA-03 | Subpáginas do admin perdem o `next=` ao pedir login                                                                                                                                  | Baixo              | Pendente                                                                                    |
| QA-04 | Indicador da barra inferior errado após "Voltar"                                                                                                                                     | Baixo/Médio        | **Corrigido**, teste passa                                                                  |
| QA-05 | Categoria/produto com erro respondem 200 (streaming do `loading.tsx`)                                                                                                                | Baixo              | Pendente                                                                                    |
| QA-06 | "Continuar para a loja" na tela de erro volta para a página quebrada                                                                                                                 | Baixo              | Pendente                                                                                    |
| QA-07 | Cadastro sem requisito de senha visível                                                                                                                                              | Baixo              | **Corrigido**                                                                               |
| QA-08 | **Checkout com rolagem horizontal no celular** (122 px a mais em 360 px, 92 px em 390 px, 4 px em 1366 px): o `<select>` do local de retirada com texto longo alargava a grade `1fr` | Médio              | **Corrigido** (`minmax(0, 1fr)` e `select` com `width: 100%`); reteste: 0 px nas 5 larguras |
| QA-09 | Console: 2 respostas 404 (o navegador pede `/favicon.ico`; o site declara `/favicon.png`)                                                                                            | Informativo        | Pendente                                                                                    |

## Como repetir

1. `node scripts/audit/probe-db-authz.cjs` — RLS ao vivo (lê `.env.local`, recusa rodar fora do projeto TEST, cria 2 usuários temporários e apaga só o que criou).
2. `npm run build && npx next start -p 3190`, depois `npx playwright test -c scripts/audit/qa/playwright.config.cjs` — fluxos do cliente e do admin (criam e apagam usuários temporários, devolvem estoque e preço).
