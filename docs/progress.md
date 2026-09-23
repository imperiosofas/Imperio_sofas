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

| Incremento                    | Estado                                 | Evidência/observação                                                                                               |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fundação Next                 | Executável                             | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/` |
| Identidade e landing imersiva | Implementada para revisão              | Hero editorial, narrativa por rolagem, apresentação de modelos e adaptação mobile-first; aguarda feedback visual   |
| Catálogo público persistente  | Implementado, validação local pendente | Migration, seed, RLS, RPC e adapter Supabase; Docker não instalado neste ambiente                                  |
| Carrinho e frete              | Não iniciado                           | Não há rotas nem regras server-side                                                                                |
| Conta e autenticação          | Não iniciado                           | Não há Supabase Auth ou sessão                                                                                     |
| Checkout e reserva            | Não iniciado                           | Não há pedidos, estoque ou transações                                                                              |
| Mercado Pago                  | Bloqueado                              | Sem credenciais homologadas                                                                                        |
| Admin e operação              | Não iniciado                           | Não há autorização, MFA ou painel                                                                                  |
| Bling/NF-e                    | Bloqueado                              | Sem credenciais, parâmetros fiscais ou certificado homologado                                                      |
| LGPD, relatórios e go-live    | Não iniciado/bloqueado                 | Dependem de dados, políticas e operação aprovados                                                                  |

## Próximo incremento recomendado

Após aprovar a direção visual, seguir pelo fluxo de administração de produtos antes de ampliar as telas públicas:

1. validar a landing e ajustar a identidade com o feedback do cliente;
2. definir acesso seguro e papéis da área administrativa;
3. construir cadastro/edição de produtos, variantes, fotos, preço, estoque e publicação;
4. ligar a vitrine aos itens que o administrador publicar;
5. validar migration, seed e RLS no Supabase local (`npx supabase start`, `npm run db:reset`, `npm run db:test`);
6. avançar para carrinho, frete, pedido e checkout; manter vendas reais desabilitadas até homologar integrações.

## Critérios de progresso

Cada incremento deve registrar:

- arquivos e migrations efetivamente alterados;
- comandos executados e resultado;
- testes determinísticos, sandbox ou produção autorizada, sem misturar evidências;
- bloqueios externos e responsável a definir;
- riscos de rollback e impacto no deploy atual.

Até que essas evidências existam, o projeto deve ser descrito como uma aplicação em migração incremental, não como e-commerce pronto ou homologado.
