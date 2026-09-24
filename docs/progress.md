# Progresso — Império Sofás

## Estado atual

**Baseline:** landing page Vite/React/TypeScript.

**Situação da migração:** fundação Next executável; catálogo read-only e schema Supabase implementados em etapas. O storefront pode consultar Supabase ou usar o adapter local apenas em desenvolvimento. O banco local ainda não foi iniciado porque Docker não está instalado neste ambiente. Autenticação, carrinho funcional, checkout e integrações seguem como próximos incrementos.

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

| Incremento                    | Estado                                 | Evidência/observação                                                                                                                                              |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundação Next                 | Executável                             | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/`                                                |
| Identidade e landing imersiva | Revisada para validação visual         | Hero editorial, três cenas sticky com fotos reais, movimento vinculado à rolagem e ritmo responsivo; aguarda feedback visual                                      |
| Navegação landing/loja        | Integrada para validação visual        | Cabeçalho compartilhado nas rotas públicas, atalhos para loja/categoria, links da narrativa e rota de sacola com status transparente; sem carrinho funcional      |
| Catálogo público persistente  | Implementado, validação local pendente | Migration, seed, RLS, RPC e adapter Supabase; Docker não instalado neste ambiente                                                                                 |
| Carrinho e frete              | Não iniciado                           | `/carrinho` apresenta estado informativo; não há itens, frete ou regras server-side                                                                               |
| Conta e autenticação          | Implementado; ativação pendente        | `/conta`: login, cadastro de cliente, confirmação/recuperação por token hash, sessão SSR e TOTP opt-in; faltam projeto, templates de e-mail, SMTP e validação E2E |
| Checkout e reserva            | Não iniciado                           | Não há pedidos, estoque ou transações                                                                                                                             |
| Mercado Pago                  | Bloqueado                              | Sem credenciais homologadas                                                                                                                                       |
| Admin e operação              | Não iniciado                           | Não há autorização, MFA ou painel                                                                                                                                 |
| Bling/NF-e                    | Bloqueado                              | Sem credenciais, parâmetros fiscais ou certificado homologado                                                                                                     |
| LGPD, relatórios e go-live    | Não iniciado/bloqueado                 | Dependem de dados, políticas e operação aprovados                                                                                                                 |

Na revisão visual de 23/09/2026, a seção de história deixou de usar o cartão de produto fixo no desktop e a lista estática no celular. As três cenas agora compartilham a mesma estrutura de tela cheia, com foto, texto e navegação contextual; a rolagem permanece nativa. Diferenciais e avaliações foram reorganizados para manter o ritmo editorial depois da narrativa. O filtro de ruído do hero e o blur do cabeçalho foram retirados para reduzir composição visual durante o scroll. O ajuste de escala das fotos usa CSS scroll-driven animation como aprimoramento progressivo; a estrutura sticky continua funcional quando esse recurso não existe.

## Próximo incremento recomendado

Com a identidade de conta pronta, seguir pela configuração do ambiente de autenticação e validar com contas de teste antes de criar o bootstrap administrativo:

1. configurar credenciais Supabase e SMTP, atualizar templates token hash e testar signup, confirmação, reset e TOTP;
2. definir provisionamento de roles, recuperação de admin e policies RLS/AAL2 antes de abrir qualquer operação administrativa;
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

## Autenticação de clientes — 23/09/2026

- Implementados `/conta` (entrar, cadastro de cliente, recuperação), confirmação SSR por token hash (`/auth/confirm`), callback genérico PKCE, conta autenticada, `/conta/redefinir-senha` e `/conta/seguranca` para configurar TOTP.
- Next.js 16 usa `proxy.ts` para renovar a sessão Supabase cookie-backed; as páginas privadas validam claims no servidor. O proxy não concede papel nem substitui autorização.
- Login consulta AAL/fatores após senha e bloqueia a continuação quando não é possível confirmar o estado MFA. Se TOTP estiver ativo, solicita o código de seis dígitos antes de continuar.
- Cadastro não define role. Admin, painel, papel, RLS administrativa e bootstrap continuam fora deste incremento.
- Variáveis Supabase não estão presentes no ambiente local; UI validada em modo não configurado. Confirmação SSR, envio real de e-mail e operações Auth/MFA aguardam configuração do projeto, templates token hash e SMTP.

### Refinamento visual desktop — 23/09/2026

- Cadastro em desktop (>=900px) usa campos em coluna única para evitar controles estreitos no painel dividido; o layout de duas colunas permanece restrito às telas intermediárias, sem alterar o mobile já validado.
- Painel de autenticação ampliado e proporção ajustada para dar mais presença à imagem editorial, com altura mínima ligeiramente reduzida.
- Typecheck, lint, formatação e build passaram após o ajuste; lint conserva três avisos preexistentes de `<img>` na landing.
