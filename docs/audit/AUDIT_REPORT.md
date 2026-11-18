# Auditoria completa — Império Sofás (17/11/2026)

**Base:** branch `staging` em `f8b92db` (clonada em `P:\Codex\imperio-sofas-staging`; a pasta de trabalho antiga tinha sido apagada).
**Entrega:** correções em commit **local** — nada foi enviado ao GitHub nem à Vercel (push na `staging` faz deploy, e o pedido proibia deploy).
**Equipe:** 5 agentes de auditoria em paralelo (segurança, banco/RLS, QA, frontend+arquitetura, e-commerce/jurídico) + 1 revisão independente final das correções.

Documentos: [SECURITY_REPORT](SECURITY_REPORT.md) · [QA_REPORT](QA_REPORT.md) · [ARCHITECTURE_REPORT](ARCHITECTURE_REPORT.md) · [REMAINING_TASKS](REMAINING_TASKS.md)

## Situação geral

A base é sólida: RLS ligada nas 27 tabelas públicas, funções `SECURITY DEFINER` com `search_path=''`, preço/estoque/frete/total recalculados no banco, webhook com HMAC e deduplicação, idempotência no checkout, admin verificado no servidor em todas as páginas, actions e rotas. Nenhuma forma de um cliente virar admin foi encontrada.

Os problemas mais graves eram: **Next.js com CVE crítico**, **edição rápida de preço no admin gravando 100× o valor**, e lacunas legais do e-commerce (sem desistência pelo site, sem estorno no sistema, identificação do vendedor ausente em várias páginas).

**Testes ao vivo:** o Supabase TEST estava pausado na primeira rodada; foi reativado, as duas migrations pendentes foram aplicadas no TEST e rodaram ao vivo o probe de RLS (199 verificações, 0 acessos indevidos depois da migration) e os fluxos com login e de admin (47/47 verificações no navegador, com o código novo em build de produção local). O site da Vercel não foi atualizado.

## Números

|                                                                     |                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Achados únicos (após remover duplicados entre agentes)              | **85**                                                                                                       |
| Corrigidos nesta entrega (alguns parcialmente, ver tabela)          | **31**                                                                                                       |
| Críticos restantes                                                  | **0** (o Supabase TEST foi reativado)                                                                        |
| Altos restantes                                                     | **2**: e-mails transacionais (ECO-02, depende de Resend) e imagens sem otimização (FE-02, custo/performance) |
| Bugs introduzidos pelas próprias correções e pegos na revisão final | 7 (1 alto, 4 médios, 2 baixos) — todos corrigidos antes do commit                                            |

## Correções realizadas

| #   | Achado                                                                                        | Gravidade | O que foi feito                                                                                                                     | Arquivos                                                                                                  |
| --- | --------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Next 16.3.8 com RCE no otimizador de imagens (SVG), DoS em Server Actions, vazamento de cache | CRÍTICO   | Next/eslint-config-next 16.4.6                                                                                                      | `package.json`, lock                                                                                      |
| 2   | zod < 4.6.6 (DoS de memória)                                                                  | ALTO      | zod 4.6.7                                                                                                                           | idem                                                                                                      |
| 3   | ARC-01 edição rápida grava preço ×100 ("1299.90" → R$ 129.990,00)                             | ALTO      | Conversor único `parseBrlToCents` (inteiro, formatos BR) + testes                                                                   | `src/lib/money.ts`, `CatalogManagementCenter.tsx`, `admin/actions.ts`, `tests/money.test.mjs`             |
| 4   | ECO-01 sem desistência (art. 49 CDC / Dec. 7.962 art. 5º) pelo site                           | ALTO      | Botão "Desistir da compra" no pedido pago, protocolo com data/hora imediato, aviso no admin; texto da política atualizado           | migration `20261117120000`, `pedido/[id]/page.tsx`, `checkout/actions.ts`, `orders-data.ts`, `content.ts` |
| 5   | ECO-03 pedido pago não podia ser cancelado/estornado no sistema                               | ALTO      | "Registrar estorno" no admin (uma vez, opção de devolver ao estoque)                                                                | migration, `admin/pedidos/[id]/page.tsx`                                                                  |
| 6   | ECO-04 CNPJ/razão social/contato ausentes em checkout, pedido, conta e páginas legais         | ALTO      | Rodapé legal nos layouts dos grupos `(storefront)`, `(account)`, `(legal)`                                                          | `src/app/*/layout.tsx`                                                                                    |
| 7   | ECO-05 checkout sem prazo e sem variante                                                      | ALTO      | Prazo por fornecedor, largura do item e validade de 24 h da cotação no checkout (endereço completo e forma de pagamento: pendentes) | `checkout/page.tsx`                                                                                       |
| 8   | SEC-01 sem headers de segurança                                                               | MÉDIO     | CSP base, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS (sem sobrescrever a CSP estrita de `/auth/*`)         | `next.config.ts`                                                                                          |
| 9   | SEC-02 cookies de sessão sem `Secure`                                                         | MÉDIO     | `cookieOptions` com `secure` em produção nos 3 clientes                                                                             | `cookie-options.ts`, `server.ts`, `client.ts`, `proxy.ts`                                                 |
| 10  | SEC-03 login CSRF em `POST /auth/confirm` e `/auth/callback`                                  | MÉDIO     | Checagem Sec-Fetch-Site/Origin                                                                                                      | `src/lib/auth/same-origin.ts`, rotas                                                                      |
| 11  | SEC-05/QA-07 senha sem mínimo na interface                                                    | MÉDIO     | `minLength=8` + dica (política no Supabase: pendente)                                                                               | auth components                                                                                           |
| 12  | SEC-06/DB-02 `user_id` dos avaliadores visível a visitantes                                   | BAIXO     | Remove política pública e `select` do anon                                                                                          | migration                                                                                                 |
| 13  | SEC-07/ECO-21 pagamento sem aceite dos termos registrado                                      | BAIXO     | Pagamento exige `terms_accepted_at`; falha ao gravar o aceite é tratada                                                             | `payment-service.ts`, `checkout/actions.ts`                                                               |
| 14  | SEC-08 duas tentativas simultâneas criavam duas preferências                                  | BAIXO     | 1ª tentativa usa o id do pedido como chave                                                                                          | `payment-service.ts`                                                                                      |
| 15  | SEC-09 upload confiava no MIME do cliente                                                     | BAIXO     | Formato real lido dos bytes                                                                                                         | `admin/actions.ts`                                                                                        |
| 16  | SEC-11 Server Actions sem validação de tipo/UUID                                              | BAIXO     | Validação em favoritos, avaliações, carrinho, retry de pagamento                                                                    | `commerce/actions.ts`, `checkout/actions.ts`                                                              |
| 17  | SEC-13 admin validado só pelo JWT local                                                       | BAIXO     | `getUser()` adicional                                                                                                               | `admin-access.ts`                                                                                         |
| 18  | SEC-14/ARC-02 nome da chave secreta divergente                                                | INFO      | `SUPABASE_SECRET_KEY` em todo lugar                                                                                                 | `.env.example`, `env/server.ts`, `check-production-ready.mjs`                                             |
| 19  | SEC-19 redefinir senha sem senha atual com qualquer sessão                                    | BAIXO     | Página só abre com cookie HttpOnly ligado ao usuário, criado pelo link de recuperação (token_hash e PKCE)                           | `password-recovery.ts`, `auth/confirm`, `redefinir-senha/page.tsx`                                        |
| 20  | DB-01 pedidos `needs_review` prendiam estoque para sempre                                     | MÉDIO     | Admin encerra e libera estoque; exige confirmação de estorno se entrou dinheiro                                                     | migration, admin                                                                                          |
| 21  | DB-06 `customer_profiles` com DELETE/TRUNCATE padrão                                          | BAIXO     | Só select/insert/update                                                                                                             | migration                                                                                                 |
| 22  | DB-11 índices de FK ausentes                                                                  | INFO      | 2 índices                                                                                                                           | migration                                                                                                 |
| 23  | ECO-06 início dos 7 dias não informado                                                        | MÉDIO     | "contados do recebimento (ou retirada)" + frete devolvido                                                                           | `content.ts` (política de trocas)                                                                         |
| 24  | ECO-07 garantia sugeria só o fornecedor responsável                                           | MÉDIO     | Loja e fabricantes respondem (CDC) — política de trocas                                                                             | `content.ts`                                                                                              |
| 25  | ECO-09 validade da cotação não exibida                                                        | MÉDIO     | Exibida em "Minhas entregas" e no checkout                                                                                          | `MyLogisticsQuotes.tsx`, checkout                                                                         |
| 26  | ECO-16 cadastro sem aviso de privacidade                                                      | MÉDIO     | Aviso com link no cadastro                                                                                                          | `AuthAccountStage.tsx`                                                                                    |
| 27  | ECO-19 dados estruturados sempre "InStock"                                                    | MÉDIO     | Disponibilidade real                                                                                                                | `produto/[slug]/page.tsx`                                                                                 |
| 28  | ARC-03 testes do admin de logística fora do CI                                                | MÉDIO     | Incluídos no CI                                                                                                                     | `.github/workflows/ci.yml`                                                                                |
| 29  | FE-08 `public/robots.txt`/`sitemap.xml` antigos competindo com os gerados                     | BAIXO     | Removidos (os de `src/app` bloqueiam indexação fora de produção)                                                                    | `public/`                                                                                                 |
| 30  | QA-04 indicador da barra inferior errado após "Voltar" (teste falhando)                       | BAIXO     | Estado do toque limpo ao mudar de rota                                                                                              | `BottomNavigation.tsx`                                                                                    |
| 31  | QA-08 checkout com rolagem horizontal no celular (122 px em 360 px), achado no teste ao vivo  | MÉDIO     | Grade `minmax(0, 1fr)` e `select` com largura 100%; reteste 0 px nas 5 larguras                                                     | `checkout.module.css`                                                                                     |

Também: script de probe de RLS versionado em `scripts/audit/probe-db-authz.cjs` e testes pgTAP em `supabase/tests/audit_hardening.sql` (o probe rodou ao vivo; o pgTAP precisa do Supabase local/Docker). Os testes de navegador com login ficaram em `scripts/audit/qa/`.

## Revisão independente das correções (Fase 6)

Um agente revisou todo o diff. Encontrou e foi corrigido antes do commit:

- **ALTO** — encerrar pedido `needs_review` podia apagar o registro de um pagamento real (valor divergente fica como `in_process`). Agora exige confirmação explícita de estorno e preserva o registro.
- **MÉDIO** — headers globais sobrescreviam a CSP estrita da página de confirmação de e-mail → `/auth/*` excluído da CSP/Referrer globais (verificado com `curl` no build de produção).
- **MÉDIO** — recuperação de senha por link PKCE ficaria sem saída → cookie também no fluxo `code`.
- **MÉDIO** — falha ao gravar o aceite dos termos deixava um pedido impagável segurando estoque → agora devolve erro e o reenvio reaproveita o mesmo pedido.
- **MÉDIO** — formulário de estorno sumia quando o webhook já marcava `refunded` → aparece até o registro ser feito.
- **BAIXO** — cookie de recuperação não era ligado ao usuário → agora guarda e confere o id. Links legais duplicados no checkout → removidos.

Aceitos: chave de idempotência pelo id do pedido é segura no banco (confirmado); `same-origin` ainda aceita `Origin: null` sem Fetch Metadata (navegadores antigos) — risco baixo, registrado.

## Problemas ainda pendentes (resumo — detalhes em REMAINING_TASKS)

Bloqueiam o lançamento:

1. Aplicar as migrations `20261105120000` e `20261117120000` também no banco de produção (no TEST já foram aplicadas).
2. Rodar o pgTAP localmente (Docker) quando possível.
3. Mercado Pago: credenciais, sandbox, webhook real, parcelas/boleto.
4. E-mails transacionais de pedido (Resend + domínio).
5. Revisão jurídica e ajustes nos Termos do cliente (prazo "do pagamento", garantia, cancelamento, retirada).
6. Configurações do Supabase Auth (allowlist exata, senha, CAPTCHA, limites).
7. Agendar a expiração de pedidos (`CRON_SECRET` + cron ou `pg_cron`).
8. Supabase/Vercel de produção, `APP_ENV=production`, `APP_URL`, DNS.

## Prontidão para produção

**Não está pronto para produção.** O código ficou mais seguro e completo, mas os itens acima são impeditivos (pagamento real, e-mails transacionais, revisão jurídica, configurações de Auth/cron e ambiente de produção).

## Atualização de 18/11/2026

Verificado nos painéis (Supabase, Vercel, Resend, GitHub) e corrigido:

| Achado                                                                                                                                                  | Gravidade | O que foi feito                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`proxy.ts` nunca rodou**: o app fica em `src/app`, e o Next só lê o proxy em `src/`. A renovação de sessão no servidor nunca aconteceu desde outubro. | ALTO      | Movido para `src/proxy.ts`; o build agora lista "Proxy (Middleware)". Fluxos ao vivo (47 verificações) e E2E passam com ele ativo. |
| CI do GitHub vermelho em todos os commits da `staging` (formatação + migration que quebrava em banco novo)                                              | MÉDIO     | Corrigidos os dois pontos; confirmar no próximo push                                                                               |
| E-mails de pedido inexistentes (Decreto 7.962)                                                                                                          | ALTO      | Implementados (pedido, pagamento, desistência) via Resend, com idempotência; aguardam `RESEND_API_KEY` na Vercel                   |
| Expiração de pedidos não agendada                                                                                                                       | MÉDIO     | `pg_cron` a cada 5 min no TEST (migration `20261118120000`)                                                                        |
| Senha mínima 6 e troca de senha sem login recente (Supabase TEST)                                                                                       | MÉDIO     | Mínimo 8 e "Secure password change" ligados no painel                                                                              |
| 9 produtos sem estoque visíveis                                                                                                                         | —         | Ocultados no TEST (rascunho)                                                                                                       |
| Endereço do rodapé legal sem bairro/CEP                                                                                                                 | BAIXO     | Corrigido com os dados que já estavam no projeto                                                                                   |
| Subpáginas do admin perdiam o destino após login (QA-03)                                                                                                | BAIXO     | Corrigido (header `x-pathname` do proxy + allowlist das seções do admin, com teste)                                                |
| `/favicon.ico` 404 e link "Continuar para a loja" na tela de erro (QA-06/09)                                                                            | BAIXO     | Corrigidos                                                                                                                         |

Publicado na `staging` em 18/11 (deploy no site de teste). Testes ao vivo de cliente e admin no site publicado: 47/47.
