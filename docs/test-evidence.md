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

| Verificação           | Resultado              | Evidência                                                                                |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Referências de design | Pesquisadas            | Westwing, Saccaro, Lider Interiores, Awwwards e Pinterest; fontes na conversa de entrega |
| Mobile 390 × 844      | Conferido no navegador | Menu recolhido, CTAs empilhados, capítulos verticais e sem overflow horizontal           |
| Desktop 1440 × 960    | Conferido no navegador | Navegação expandida, etapa sticky atualizada por capítulo e rolagem natural              |
| Movimento reduzido    | Implementado           | Hero e transições respeitam `prefers-reduced-motion`; sem captura forçada da rolagem     |

## Limitações conhecidas

- A landing page ainda usa `<img>` em alguns componentes; a migração para `next/image` fica para o refinamento do storefront.
- O catálogo público usa adapter Supabase ou local, conforme ambiente; migrations e testes pgTAP ainda aguardam execução local.
- Não há autenticação, carrinho, checkout, estoque ou admin.
- A fundação não deve ser descrita como e-commerce pronto para produção.
