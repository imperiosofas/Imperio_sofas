# Decisões arquiteturais — Império Sofás

Este arquivo registra decisões e decisões ainda abertas. Os documentos técnicos são a referência de intenção; o estado real do repositório continua sendo o baseline descrito abaixo.

## D-001 — Baseline preservado

**Status:** decidido.

O ponto de partida é a landing page Vite/React/TypeScript existente. Ela contém identidade visual e assets reaproveitáveis, mas não é uma base transacional. Nenhuma funcionalidade comercial deve ser inferida a partir do catálogo estático atual.

## D-002 — Migração incremental para Next.js 16

**Status:** decidido.

Next.js 16 é o alvo dos documentos. O worktree atual já contém uma fundação parcial dessa migração, mas ela ainda não constitui o e-commerce. A migração deve continuar em branch/preview, preservando o deploy atual até a substituição ser validada. Não misturar indefinidamente Vite e Next no mesmo runtime nem reescrever o código atual sem uma etapa de rollback.

## D-003 — Catálogo read-only como primeira feature

**Status:** decidido.

O primeiro incremento funcional será o catálogo público com `/loja` e `/produto/[slug]`, alimentado por um modelo de catálogo persistente e com rascunhos não publicados. Não incluir conta, checkout, Mercado Pago ou Bling nesse incremento.

## D-004 — Fonte comercial distinta da apresentação

**Status:** decidido.

`src/data/products.ts` permanece referência visual durante a migração, mas não será fonte operacional de preço, SKU ou estoque. O catálogo comercial deverá ter produto, variante, mídia, status e preço validados no servidor.

## D-005 — Supabase como camada de persistência proposta

**Status:** alvo aprovado, implantação pendente.

Os documentos propõem Supabase Postgres, Auth e Storage, com migrations, RLS, schema privado para dados sensíveis e RPCs transacionais. Isso ainda não está presente no repositório e não há projeto/credenciais externas homologadas registrados.

## D-006 — Checkout Pro

**Status:** decidido para a arquitetura alvo; não homologado.

O fluxo alvo usa Mercado Pago Checkout Pro hospedado, em vez de checkout transparente, para reduzir a superfície de pagamento. A implementação deve começar por adapter mock e sandbox. Nenhuma chamada live ou cobrança real está autorizada por estes documentos.

## D-007 — Consistência por reserva e idempotência

**Status:** decidido para a arquitetura alvo.

O checkout deve recalcular preço e frete no servidor, gravar pedido e reserva de forma transacional e usar chave de idempotência. Webhooks entram em inbox persistida; efeitos são processados por jobs com deduplicação, lease e reconciliação.

## D-008 — Fiscal supervisionado

**Status:** decidido para o MVP; homologação pendente.

O pagamento aprovado não implica emissão automática incondicional de NF-e. A integração Bling deve tratar OAuth, tokens protegidos, estados desconhecidos, rejeições e emissão supervisionada. A1, parâmetros fiscais e conta adequada ainda não estão disponíveis como evidência de produção.

## D-009 — Segurança administrativa

**Status:** decidido para a arquitetura alvo.

Admin não será criado por cadastro público. O acesso deve exigir role provisionada operacionalmente, e-mail verificado e TOTP/AAL2 para operações sensíveis. Não haverá bypass por e-mail ou reconhecimento de dispositivo no MVP.

## D-010 — Modos de integração

**Status:** decidido.

`mock`, `sandbox` e `live` são modos distintos. Produção não pode iniciar com mock, fixtures DEMO, tokens de teste ou bypass. Enquanto os bloqueios externos existirem, a aplicação deve permanecer com vendas desabilitadas.

## D-011 — Conteúdo e dados não homologados

**Status:** decidido.

Telefones, preços, estoque, cobertura, políticas, avaliações, condições de parcelamento e dados fiscais não serão escolhidos silenciosamente. Imagens tratadas por IA e o hero ilustrativo precisam de validação comercial para uso público.

## Decisões abertas

- Qual telefone e canal oficial devem aparecer no produto?
- Quem é a fonte mestre de preço, estoque e cadastro: aplicação, loja, Bling ou combinação formalmente definida?
- Qual domínio será canônico e qual estratégia de cutover substituirá a landing page atual?
- Quais preços à vista, variantes, quantidades vendáveis e condições de pagamento foram aprovados?
- Quais faixas de CEP, taxas, prazos, retirada e serviços especiais serão comercialmente válidos?
- Qual política de retenção e quais textos legais foram aprovados pela empresa/assessoria?
- Quem aprova o primeiro administrador, ajustes de estoque, reembolsos e emissão fiscal?
