# Evidências de testes

Este arquivo separa validações locais determinísticas de homologações externas. Nenhum item abaixo autoriza venda real ou emissão fiscal.

## Etapa 1 — Fundação

| Verificação                | Resultado            | Evidência                                                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Passou               | Instalação limpa validada antes do primeiro push                                                          |
| `npm run typecheck`        | Passou               | TypeScript sem erros                                                                                      |
| `npm run lint`             | Passou com avisos    | 0 erros; há avisos sobre migração futura para `next/image`                                                |
| `npm run format:check`     | Passou               | Fundação, catálogo e rotas de storefront verificados                                                      |
| `npm run build`            | Passou               | Next.js 16.3.6 gerou as rotas públicas, `/robots.txt` e `/sitemap.xml`                                    |
| `npm run check:production` | Passou em modo local | Check foi pulado porque `APP_ENV=local`; produção continua bloqueada                                      |
| CI                         | Configurado          | Workflow aplica migrations e executa pgTAP no Supabase local; build, typecheck, formato e lint em push/PR |
| Smoke HTTP                 | Passou               | `/` 200, `/loja` 200, `/loja/sofas` 200, produto em rascunho 404 e rota inexistente 404                   |

## Integrações externas

| Integração   | Evidência atual                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Supabase     | CLI e arquivos locais configurados; stack não iniciada porque Docker não está instalado; sem projeto/credencial externo homologado |
| Mercado Pago | Não configurado; nenhum pagamento ou webhook testado                                                                               |
| Bling/NF-e   | Não configurado; nenhuma emissão ou certificado testado                                                                            |
| Resend       | Não configurado; nenhum envio comercial testado                                                                                    |

## Catálogo persistente

| Verificação      | Resultado                               | Evidência                                                            |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Migration e seed | Criados; execução pendente              | `supabase/migrations/202609230001_catalog.sql` e `supabase/seed.sql` |
| RLS e RPC        | Testes pgTAP criados; execução pendente | `supabase/tests/catalog_public.sql`; exige Supabase local ativo      |
| Adapter Supabase | Implementado; sem conexão testada       | RPCs validadas com Zod; ambiente sem credenciais configuradas        |
| Seed comercial   | Criado                                  | Cinco produtos `draft`, preço nulo e inventário zero                 |

## Landing imersiva

| Verificação           | Resultado              | Evidência                                                                                                          |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Referências de design | Pesquisadas            | Westwing, Saccaro, Lider Interiores, Awwwards, Pinterest e [Bolia](https://www.bolia.com/en/sofas/)                |
| Mobile 390 × 844      | Conferido no navegador | Cenas de tela cheia, foto e texto legíveis, transição entre capítulos e sem overflow horizontal                    |
| Mobile 360 × 640      | Conferido no navegador | Cena sticky com CTA e progresso visíveis; largura do documento dentro do viewport                                  |
| Desktop 1440 × 900    | Conferido no navegador | Hero, abertura editorial, cena sticky fixada em `top: 0` e transição para o próximo sofá                           |
| Movimento por scroll  | Conferido no navegador | Imagem mudou de escala de 1,0449 para 1,03809 após rolagem; scroll nativo, sem Lenis                               |
| Movimento reduzido    | Implementado           | Animações por scroll só ativam com `prefers-reduced-motion: no-preference`                                         |
| Qualidade do build    | Passou                 | Typecheck, build, `format:check` e Prettier dos arquivos alterados; lint com 0 erros e 3 avisos antigos de `<img>` |

## Limitações conhecidas

- A landing page ainda usa `<img>` em alguns componentes; a migração para `next/image` fica para o refinamento do storefront.
- As animações CSS ligadas à rolagem são um aprimoramento progressivo. Em navegadores sem `animation-timeline`, as cenas sticky continuam, mas as fotos não mudam de escala. Ainda falta conferir em um iPhone/Android físico.
- Compatibilidade do efeito opcional consultada em [MDN `animation-timeline`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline).
- O catálogo público usa adapter Supabase ou local, conforme ambiente; migrations e testes pgTAP ainda aguardam execução local.
- Não há autenticação, carrinho, checkout, estoque ou admin.
- A fundação não deve ser descrita como e-commerce pronto para produção.

## Integração landing e loja

| Verificação               | Resultado              | Evidência                                                                                            |
| ------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Cabeçalho compartilhado   | Conferido no navegador | Landing, `/loja` e `/carrinho` usam a mesma marca, navegação responsiva, atalho de loja e sacola     |
| CTA de compra da landing  | Conferido no navegador | Hero e cenas dos sofás levam a `/loja/sofas`; destaque da coleção leva a `/loja`                     |
| Viewport mobile 390 × 844 | Conferido no navegador | Marca sem quebra, atalho da loja, ícone de sacola e menu permanecem visíveis                         |
| Sacola informativa        | Conferido no navegador | `/carrinho` explica que compras online estão em preparação e oferece rotas de retorno                |
| Limite comercial          | Mantido                | A sacola não simula itens, frete ou checkout; produtos em rascunho continuam fora da vitrine pública |

## Conta e autenticação — 23/09/2026

| Verificação                   | Resultado                 | Evidência                                                                                                                    |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`           | Passou                    | Fluxos Supabase browser/server, callbacks, páginas privadas e TOTP compilam sem erros                                        |
| `npm run lint`                | Passou com avisos antigos | 0 erros; permanecem apenas 3 avisos de `<img>` em componentes preexistentes da landing                                       |
| `npm run format:check`        | Passou                    | Script agora inclui `proxy.ts`, `src/index.css`, `src/lib/supabase` e `src/features/auth`                                    |
| `npm run build`               | Passou                    | Next.js 16 gerou `/conta`, confirmação, callback, recuperação e segurança; páginas com sessão foram mantidas dinâmicas       |
| UI sem configuração Supabase  | Conferida no navegador    | `/conta` mostra indisponibilidade explícita e desabilita o envio; sem login ou OTP de demonstração                           |
| Mobile 390 × 844              | Conferido visualmente     | Cabeçalho compacto, imagem editorial curta e formulário em coluna, sem overflow horizontal visível                           |
| Supabase/SMTP/token hash/TOTP | Pendente                  | `.env.local`, templates e credenciais homologadas ausentes; signup, e-mail, sessão e MFA não foram simulados como funcionais |
