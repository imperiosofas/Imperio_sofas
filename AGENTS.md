# Império Sofás — regras de trabalho

## Contexto

- O projeto está sendo migrado incrementalmente de Vite/React para Next.js 16 App Router.
- A landing page existente é um ativo preservado; mudanças de storefront não devem apagar conteúdo ou mídia sem motivo documentado.
- Textos de interface são pt-BR. Nomes de código, tabelas e serviços são em inglês.
- Dados comerciais, credenciais, preços finais, estoque e parâmetros fiscais não podem ser inventados.

## Fluxo obrigatório

1. Leia `docs/progress.md`, `docs/production-blockers.md` e as decisões relevantes antes de começar.
2. Faça mudanças pequenas, revisáveis e com testes proporcionais ao risco.
3. Mantenha fronteiras server/client explícitas. Segredos, pagamentos, fiscal e service keys nunca entram no bundle do navegador.
4. Rode `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` antes de concluir uma feature.
5. Atualize `docs/progress.md` e `docs/test-evidence.md` quando houver evidência nova.
6. Faça commit com mensagem explícita por feature. Nunca force-push nem use dados reais em local/staging.

## Segurança comercial

- Checkout recalcula preço, frete e estoque no servidor.
- Operações externas precisam de idempotência, reconciliação e estado ambíguo explícito.
- RLS e autorização devem ser verificadas na operação, não apenas em layout ou proxy.
- Produção só pode ser habilitada com credenciais, dados comerciais e homologações documentados.
