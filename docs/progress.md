# Progresso — Império Sofás

## Estado atual

**Baseline:** landing page Vite/React/TypeScript.

**Situação da migração:** Etapas 1 e 2 em execução/concluídas parcialmente. A landing page visual foi preservada como Client Component dentro de um App Router Next.js 16.3.6, e o catálogo público read-only já possui rotas e filtro de rascunhos. Banco, autenticação, checkout e integrações continuam sendo incrementos futuros.

**Credenciais externas:** não há credenciais homologadas registradas para Supabase, Mercado Pago, Bling, Resend, Vercel ou domínio de produção.

**Escopo executado nesta atualização:** migração inicial para Next.js 16.3.6, App Router, metadata, robots/sitemap, validação server-only de ambiente, `.env.example`, verificador estrutural de produção, CI, Dependabot, regras para agentes e documentação arquitetural. Também foram criadas as rotas `/loja`, `/loja/[categoria]` e `/produto/[slug]`, com filtro de rascunhos, além das telas imersivas de erro e 404. Nenhuma integração externa ou venda real foi ativada.

## Evidências do baseline

- `package.json` usa Next.js 16.3.6, React 19 e scripts `dev`, `build`, `start`, `lint`, `format:check`, `typecheck` e `check:production`.
- `src/App.tsx` monta uma página institucional única.
- `src/data/products.ts` contém cinco produtos para apresentação.
- `src/config.ts` contém dados de loja e WhatsApp.
- O baseline original não possuía `src/app`, migrations, APIs comerciais, autenticação, testes automatizados ou workflows CI.
- A fundação atual está em `src/app`, `next.config.ts`, `next-env.d.ts`, `src/lib/env/server.ts`, `.github/` e `scripts/check-production-ready.mjs`; o catálogo read-only está em `src/features/catalog`, mas ainda não há checkout ou integração homologada.
- Existem assets locais de marca, loja e produtos, incluindo versões tratadas por IA e originais preservados.

## Estado por incremento

| Incremento                   | Estado                 | Evidência/observação                                                                                               |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fundação Next                | Executável             | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/` |
| Catálogo público persistente | Parcial                | Rotas e contrato read-only prontos; fonte atual é um adapter local com cinco rascunhos e ainda não há Supabase     |
| Carrinho e frete             | Não iniciado           | Não há rotas nem regras server-side                                                                                |
| Conta e autenticação         | Não iniciado           | Não há Supabase Auth ou sessão                                                                                     |
| Checkout e reserva           | Não iniciado           | Não há pedidos, estoque ou transações                                                                              |
| Mercado Pago                 | Bloqueado              | Sem credenciais homologadas                                                                                        |
| Admin e operação             | Não iniciado           | Não há autorização, MFA ou painel                                                                                  |
| Bling/NF-e                   | Bloqueado              | Sem credenciais, parâmetros fiscais ou certificado homologado                                                      |
| LGPD, relatórios e go-live   | Não iniciado/bloqueado | Dependem de dados, políticas e operação aprovados                                                                  |

## Próximo incremento recomendado

Implementar o primeiro slice persistente do catálogo como próximo incremento:

1. preservar o deploy Vite atual;
2. criar o aplicativo Next em branch/preview;
3. definir o modelo mínimo de categoria, produto, variante e mídia;
4. importar os cinco modelos como rascunho;
5. criar `/loja` e `/produto/[slug]` sem expor rascunhos;
6. validar metadata, acessibilidade, build e testes básicos;
7. manter vendas desabilitadas.

## Critérios de progresso

Cada incremento deve registrar:

- arquivos e migrations efetivamente alterados;
- comandos executados e resultado;
- testes determinísticos, sandbox ou produção autorizada, sem misturar evidências;
- bloqueios externos e responsável a definir;
- riscos de rollback e impacto no deploy atual.

Até que essas evidências existam, o projeto deve ser descrito como landing page Vite/React em migração planejada, não como e-commerce pronto ou homologado.
