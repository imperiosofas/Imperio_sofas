# Progresso — Império Sofás

## Estado atual

**Baseline:** landing page Vite/React/TypeScript.

**Situação da migração:** fundação Next executável; catálogo read-only e schema Supabase implementados em etapas. O storefront pode consultar Supabase ou usar o adapter local apenas em desenvolvimento. O banco local ainda não foi iniciado porque Docker não está instalado neste ambiente. Autenticação, carrinho, checkout e integrações seguem como próximos incrementos.

**Credenciais externas:** não há credenciais homologadas registradas para Supabase, Mercado Pago, Bling, Resend, Vercel ou domínio de produção.

**Escopo executado nesta atualização:** migration Supabase para categorias, produtos, variantes, inventário e mídia; RLS fechado por padrão; RPC público filtrado; bucket privado com URLs assinadas; seed idempotente dos cinco rascunhos; adapter remoto validado com Zod; CLI, testes pgTAP e CI SQL. Nenhuma integração externa ou venda real foi ativada.

## Evidências do baseline

- `package.json` usa Next.js 16.3.6, React 19 e scripts `dev`, `build`, `start`, `lint`, `format:check`, `typecheck` e `check:production`.
- `src/App.tsx` monta uma página institucional única.
- `src/data/products.ts` contém cinco produtos para apresentação.
- `src/config.ts` contém dados de loja e WhatsApp.
- O baseline original não possuía `src/app`, migrations, APIs comerciais, autenticação, testes automatizados ou workflows CI.
- A fundação atual está em `src/app`, `next.config.ts`, `next-env.d.ts`, `src/lib/env/server.ts`, `.github/` e `scripts/check-production-ready.mjs`; o catálogo read-only está em `src/features/catalog`, mas ainda não há checkout ou integração homologada.
- Existem assets locais de marca, loja e produtos, incluindo versões tratadas por IA e originais preservados.

## Estado por incremento

| Incremento                   | Estado                                 | Evidência/observação                                                                                               |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fundação Next                | Executável                             | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/` |
| Catálogo público persistente | Implementado, validação local pendente | Migration, seed, RLS, RPC e adapter Supabase; Docker não instalado neste ambiente                                  |
| Carrinho e frete             | Não iniciado                           | Não há rotas nem regras server-side                                                                                |
| Conta e autenticação         | Não iniciado                           | Não há Supabase Auth ou sessão                                                                                     |
| Checkout e reserva           | Não iniciado                           | Não há pedidos, estoque ou transações                                                                              |
| Mercado Pago                 | Bloqueado                              | Sem credenciais homologadas                                                                                        |
| Admin e operação             | Não iniciado                           | Não há autorização, MFA ou painel                                                                                  |
| Bling/NF-e                   | Bloqueado                              | Sem credenciais, parâmetros fiscais ou certificado homologado                                                      |
| LGPD, relatórios e go-live   | Não iniciado/bloqueado                 | Dependem de dados, políticas e operação aprovados                                                                  |

## Próximo incremento recomendado

Validar o primeiro slice persistente e iniciar conta/carrinho em paralelo:

1. instalar/iniciar Docker Desktop;
2. rodar `npx supabase start`, `npm run db:reset` e `npm run db:test`;
3. corrigir eventuais divergências SQL;
4. apontar o app ao Supabase local com `CATALOG_SOURCE=supabase`;
5. conferir catálogo no navegador;
6. manter vendas desabilitadas.

## Critérios de progresso

Cada incremento deve registrar:

- arquivos e migrations efetivamente alterados;
- comandos executados e resultado;
- testes determinísticos, sandbox ou produção autorizada, sem misturar evidências;
- bloqueios externos e responsável a definir;
- riscos de rollback e impacto no deploy atual.

Até que essas evidências existam, o projeto deve ser descrito como landing page Vite/React em migração planejada, não como e-commerce pronto ou homologado.
