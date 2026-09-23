# Arquitetura — Império Sofás

## Status e escopo

Este documento registra a arquitetura incremental proposta para o e-commerce. O baseline funcional/histórico do repositório é uma landing page estática em Vite, React e TypeScript. O worktree atual já contém uma fundação parcial de Next.js 16, mas a migração e a adição das integrações comerciais continuam sendo incrementais e incompletas.

Não há credenciais externas homologadas neste momento. Portanto, este documento não considera Mercado Pago, Bling, Supabase, Resend ou domínio de produção como integrações ativas.

## Baseline atual

O repositório contém:

- `src/App.tsx` compondo uma página única institucional;
- seções de hero, diferenciais, catálogo, avaliações, localização, CTA e rodapé;
- produtos definidos em `src/data/products.ts`, com nomes, medidas, imagens e parcelas textuais;
- configuração de loja e WhatsApp em `src/config.ts`;
- assets locais de marca, loja e produtos;
- Vite, React, TypeScript, Tailwind, Framer Motion, Lenis, Swiper e Lucide;
- scripts de otimização de imagens.

No baseline original não havia rotas comerciais, banco, migrations, autenticação, carrinho, pedidos, estoque operacional, pagamentos, webhooks, jobs, painel administrativo, testes automatizados ou CI. No worktree atual há apenas a fundação Next/metadata e validação de ambiente; ainda não há rotas comerciais, banco, migrations, autenticação, carrinho, pedidos, estoque operacional, pagamentos, webhooks, jobs ou painel administrativo funcionais.

O worktree atual contém sinais de migração parcial, como scripts Next no `package.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts` e validação de ambiente em `src/lib/env/server.ts`. Esses arquivos estão fora do escopo desta atualização documental e não foram alterados.

O array de produtos é conteúdo de apresentação e não deve ser promovido diretamente a fonte de verdade de preço, SKU ou estoque.

## Arquitetura alvo

O alvo descrito nos documentos técnicos é um único aplicativo Next.js 16 com App Router, React, TypeScript strict, Tailwind, Supabase, Checkout Pro do Mercado Pago, Bling e Resend. A adoção dessa arquitetura é incremental; não deve haver uma reescrita silenciosa ou uma mistura indefinida de Vite e Next no mesmo runtime.

Princípios:

1. Server Components por padrão; Client Components somente para interação, carrinho, formulários, galeria e movimento.
2. Regras de preço, frete, reserva, autorização e transição de estados no servidor e no banco.
3. Integrações externas isoladas por adapters tipados, com modos `mock`, `sandbox` e `live`.
4. RLS e autorização de aplicação são camadas complementares; service role não é exposta ao navegador.
5. Efeitos externos assíncronos usam outbox, leases e reconciliação; não dependem da aba ou da memória do processo.
6. Vendas permanecem desabilitadas até que os bloqueios de produção estejam resolvidos.

## Estratégia de migração

1. Preservar a landing page Vite atual e seu deploy enquanto o novo aplicativo é desenvolvido em branch/preview.
2. Criar a fundação Next com layout, tokens, validação de ambiente, tratamento de erro, adapters e documentação.
3. Implementar primeiro o catálogo público read-only, sem checkout ou venda real.
4. Migrar carrinho, frete, conta, checkout, pagamento, operação e fiscal em incrementos separados.
5. Fazer a troca de produção somente após build, segurança, acessibilidade, restore/rollback e homologações necessárias.

O objetivo é manter cada etapa publicável ou desabilitável. Uma credencial ausente bloqueia a integração correspondente, mas não deve bloquear testes determinísticos nem o trabalho que não depende dela.

## Incrementos funcionais

### 0. Fundação

Next.js 16, estrutura de rotas, design system mínimo, env validation, adapters, CI e documentação operacional. Nenhuma venda real.

### 1. Catálogo público

Implementar `/loja` e `/produto/[slug]` com categorias, produtos, variantes, mídia, metadata, canonical, sitemap e filtro de rascunhos. O primeiro slice de banco deve conter apenas o necessário para catálogo. Os cinco modelos existentes entram como rascunhos; fixtures DEMO podem existir apenas em local/staging.

### 2. Carrinho e frete

Carrinho de convidado, favoritos, retirada, faixas de CEP e cotação server-side com token assinado. Carrinho não reserva estoque nem congela preço.

### 3. Conta do cliente

Cadastro, confirmação de e-mail, recuperação, endereços, merge seguro de carrinho e privacidade básica. Checkout continua separado.

### 4. Checkout e estoque

Pedido idempotente, snapshots, cotação recalculada no servidor, reserva transacional e adapter de pagamento mock. `sales_enabled` permanece falso.

### 5. Mercado Pago

Checkout Pro em sandbox, webhooks assinados, inbox/outbox, worker, reconciliação e reembolso supervisionado. Timeout ambíguo nunca gera preferência duplicada automaticamente.

### 6. Operação administrativa

Admin com role provisionada fora do cadastro público, TOTP/AAL2, produtos, estoque, pedidos, frete, auditoria e saúde das integrações.

### 7. Fiscal, LGPD e go-live

Bling com tokens protegidos e emissão supervisionada, documentos legais aprovados, exportação/exclusão com retenção, relatórios, backup/restore e checklist de ativação.

## Fronteiras de dados

O catálogo publicado pode ser público. Pedidos, endereços, CPF, pagamentos, documentos fiscais, roles, tokens, inbox, outbox e auditoria devem permanecer protegidos. Histórico financeiro, fiscal e de estoque não deve ser apagado por cascata de conta.

Preço deve ser armazenado em centavos inteiros, quantidades como inteiros e timestamps em UTC. O preço e o frete exibidos no navegador nunca são autoridade para fechamento de pedido.

## Integrações e operação

As interfaces previstas são `PaymentGateway`, `FiscalGateway`, `MailGateway` e `AddressLookup`. Cada adapter deve validar respostas externas e mapear estado desconhecido para revisão, não para sucesso.

Jobs devem ser persistidos e reivindicados por lease. Cron, retry e reconciliação precisam ser idempotentes. Vercel, Supabase e fornecedores só devem ser considerados homologados quando houver evidência registrada em `docs/progress.md`.

## Fora do baseline e fora do primeiro incremento

Checkout transparente, SMS, reconhecimento de dispositivo, estoque omnicanal, scrollytelling avançado, analytics de marketing, emissão fiscal automática sem supervisão e ativação de venda real não fazem parte do primeiro incremento.
