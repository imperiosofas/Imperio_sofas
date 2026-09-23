# Progresso — Império Sofás

## Estado atual

**Baseline:** landing page Vite/React/TypeScript.

**Situação da migração:** Etapa 1 em execução. A landing page visual foi preservada como Client Component dentro de um App Router Next.js 16.3.6, com metadata, robots/sitemap, validação estrutural de ambiente, CI e scripts de qualidade. Banco, catálogo comercial, autenticação, checkout e integrações continuam sendo incrementos futuros.

**Credenciais externas:** não há credenciais homologadas registradas para Supabase, Mercado Pago, Bling, Resend, Vercel ou domínio de produção.

**Escopo executado nesta atualização:** migração inicial para Next.js 16.3.6, App Router, metadata, robots/sitemap, validação server-only de ambiente, `.env.example`, verificador estrutural de produção, CI, Dependabot, regras para agentes e documentação arquitetural. Nenhuma integração externa ou venda real foi ativada.

## Evidências do baseline

- `package.json` usa Next.js 16.3.6, React 19 e scripts `dev`, `build`, `start`, `lint`, `format:check`, `typecheck` e `check:production`.
- `src/App.tsx` monta uma página institucional única.
- `src/data/products.ts` contém cinco produtos para apresentação.
- `src/config.ts` contém dados de loja e WhatsApp.
- O baseline original não possuía `src/app`, migrations, APIs comerciais, autenticação, testes automatizados ou workflows CI.
- A fundação atual está em `src/app`, `next.config.ts`, `next-env.d.ts`, `src/lib/env/server.ts`, `.github/` e `scripts/check-production-ready.mjs`; isso ainda não representa catálogo, checkout ou integração homologada.
- Existem assets locais de marca, loja e produtos, incluindo versões tratadas por IA e originais preservados.

## Estado por incremento

| Incremento | Estado | Evidência/observação |
|---|---|---|
| Fundação Next | Executável | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/` |
| Catálogo público persistente | Não iniciado | Catálogo atual é estático e usa array TypeScript |
| Carrinho e frete | Não iniciado | Não há rotas nem regras server-side |
| Conta e autenticação | Não iniciado | Não há Supabase Auth ou sessão |
| Checkout e reserva | Não iniciado | Não há pedidos, estoque ou transações |
| Mercado Pago | Bloqueado | Sem credenciais homologadas |
| Admin e operação | Não iniciado | Não há autorização, MFA ou painel |
| Bling/NF-e | Bloqueado | Sem credenciais, parâmetros fiscais ou certificado homologado |
| LGPD, relatórios e go-live | Não iniciado/bloqueado | Dependem de dados, políticas e operação aprovados |

## Próximo incremento recomendado

Implementar o catálogo público read-only como próximo incremento:

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
