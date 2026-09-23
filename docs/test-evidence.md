# Evidências de testes

Este arquivo separa validações locais determinísticas de homologações externas. Nenhum item abaixo autoriza venda real ou emissão fiscal.

## Etapa 1 — Fundação

| Verificação                | Resultado            | Evidência                                                                               |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `npm ci`                   | Passou               | Instalação limpa validada antes do primeiro push                                        |
| `npm run typecheck`        | Passou               | TypeScript sem erros                                                                    |
| `npm run lint`             | Passou com avisos    | 0 erros; há avisos sobre migração futura para `next/image`                              |
| `npm run format:check`     | Passou               | Fundação, catálogo e rotas de storefront verificados                                    |
| `npm run build`            | Passou               | Next.js 16.3.6 gerou as rotas públicas, `/robots.txt` e `/sitemap.xml`                  |
| `npm run check:production` | Passou em modo local | Check foi pulado porque `APP_ENV=local`; produção continua bloqueada                    |
| CI                         | Configurado          | Workflow executa `npm ci`, build e lint em push/PR                                      |
| Smoke HTTP                 | Passou               | `/` 200, `/loja` 200, `/loja/sofas` 200, produto em rascunho 404 e rota inexistente 404 |

## Integrações externas

| Integração   | Evidência atual                                         |
| ------------ | ------------------------------------------------------- |
| Supabase     | Não configurado; sem projeto/credencial homologado      |
| Mercado Pago | Não configurado; nenhum pagamento ou webhook testado    |
| Bling/NF-e   | Não configurado; nenhuma emissão ou certificado testado |
| Resend       | Não configurado; nenhum envio comercial testado         |

## Limitações conhecidas

- A landing page ainda usa `<img>` em alguns componentes; a migração para `next/image` fica para o refinamento do storefront.
- O catálogo público usa um adapter local transitório; não há migrations, RLS ou catálogo persistente.
- Não há autenticação, carrinho, checkout, estoque ou admin.
- A fundação não deve ser descrita como e-commerce pronto para produção.
