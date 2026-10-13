# Império Sofás — Performance & Navigation Latency Audit

**Data:** 13/10/2026 (America/Sao_Paulo)  
**Repositório:** `C:\Users\Thiago\Documents\Codex\2026-09-03\files-pasted-by-the-user-estou\outputs\imperio-sofas-vale`  
**Branch/HEAD:** `main` / `3289699` (`feat(auth): rebuild responsive login and signup experience`)  
**Escopo:** auditoria somente. Não houve alteração de aplicação, banco, Storage, catálogo, carrinho, MFA, dependências, Vercel, commit ou push. Nenhum valor de variável/segredo nem URL assinada foi incluído neste relatório.

## 1. Executive Summary

O site não é uniformemente lento. A landing estática responde rapidamente; a demora aparece sobretudo quando uma navegação precisa esperar o RSC dinâmico da loja/PDP e, no celular com rede limitada, quando as imagens privadas terminam de baixar. O clique costuma ficar sem feedback de carregamento até o novo conteúdo chegar.

| Classe                                         | Conclusão observada                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed lab bottleneck                       | PLP móvel: LCP 11,3 s em Fast 3G + CPU 4×; 10,2 s do LCP foram download da imagem. CLS 0,00.                                                                                                                            |
| Confirmed navigation latency                   | 10 trocas de ordenação: p50 0,91 s / p95 1,27 s até o conteúdo mudar. Navegação para categoria/PDP também refez a requisição completa após prefetch parcial.                                                            |
| Confirmed redundant work                       | `/api/cart/summary` foi solicitado duas vezes no carregamento e duas vezes a cada mudança de rota observada.                                                                                                            |
| Existing structural risk, no new runtime proof | Admin consulta todos os produtos e assina uma miniatura por produto; a PLP agrega no banco antes de paginar. São findings PERF-001/PERF-002 da auditoria de 07/10, não findings novos. Admin não foi medido com sessão. |
| Not confirmed                                  | Gargalo de SQL específico, N+1 de assinatura no catálogo, bloqueio da navegação pela animação, long task no perfil testado ou necessidade de cache público para imagens.                                                |

### Findings novos

- **LAT-001 — HIGH, confirmado em laboratório:** imagens da PLP dominam LCP e tempo de `load` em mobile limitado.
- **NAV-001 — MEDIUM, confirmado:** páginas dinâmicas sem boundary de carregamento; prefetch não entrega o conteúdo completo antes do clique.
- **AUTH-001 — LOW, confirmado:** duplicação do resumo do carrinho e trabalho de sessão associado.
- **NAV-002 — LOW, confirmado no código:** um link interno da tela de perfil ainda causa navegação de documento.
- **BUNDLE-001 — LOW, potencial:** Framer Motion está no shell global via bottom nav; custo de bytes não foi isolado. GSAP/Lenis não aparecem no shell de loja.
- **ENV-001 — MEDIUM operacional, confirmado:** `next start` sem `APP_ENV`/`CATALOG_SOURCE` cai no catálogo local vazio; foi necessário configurar variáveis apenas no processo de auditoria para medir Supabase.

## 2. Test Environment

- **Build medido:** `npm run build` com Next.js 16.3.6 / Turbopack; sucesso. Artefatos isolados em `.next-latency-audit-20261013` para não sobrescrever as árvores `.next*` preexistentes.
- **Runtime:** `npm run start`, `NODE_ENV=production`, `APP_ENV=staging`, `CATALOG_SOURCE=supabase`, porta `3102`. As duas últimas variáveis foram somente do processo; nenhum `.env*` foi editado. `next start` ficou pronto em 273 ms.
- **Segredos:** `.env.local` existe e `git check-ignore` confirmou que é ignorado. Foram consultados apenas nomes de chaves, nunca valores. Não foi feita busca por valor secreto no bundle nesta auditoria; a avaliação anterior de 07/10 já registrava a análise de bundle.
- **Desktop:** Playwright, 1366×768, sem throttling.
- **Mobile:** Chrome DevTools, 390×844, DPR 3, touch/coarse pointer, Fast 3G e CPU 4×. É um cenário sintético restrito, não dado de campo.
- **Banco:** tráfego de leitura com publishable/session/RLS. Nenhuma escrita ou mutação foi executada. MFA permaneceu OFF.
- **Sessão:** browser de auditoria sem login. Conta exibiu tela Entrar; não havia sessão admin disponível.
- **Medições frias:** uma primeira carga de `/loja` depois de iniciar o processo. Não reiniciei o servidor cinco vezes para fabricar amostras cold.
- **Medições quentes:** 10 GETs sequenciais por rota para TTFB; dez transições de ordenação por navegação client-side. Uma amostra para fluxo de filtro e paginação.

O estado Git já estava amplamente alterado antes da auditoria: `main`, 58 arquivos rastreados no diff (2.142 inserções/2.318 remoções), além de muitos arquivos e diretórios `.next*` não rastreados. Nada disso foi limpo ou substituído. O único arquivo de conteúdo novo é este relatório.

**História medida:** navegador → landing/PLP/PDP/conta → RSC/Server Components → proxy/sessão → RPCs Supabase + Storage privado → renderização dos cards e imagens.

## 3. Baseline Table

| Checagem               | Resultado     | Observação                                                                                                       |
| ---------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | PASS          | `tsc --noEmit`                                                                                                   |
| `npm run lint`         | PASS          | 0 erros; 2 warnings existentes de `<img>` em `src/components/StorePhoto.tsx:27` e `src/sections/Catalog.tsx:80`. |
| `npm run format:check` | PASS          | Todos os arquivos existentes no escopo do script passaram.                                                       |
| `npm run build`        | PASS          | Next 16.3.6 compilou, TypeScript passou, 8 páginas estáticas e rotas dinâmicas construídas.                      |
| E2E                    | NÃO EXECUTADO | Auditoria manual de navegação; gate E2E frágil já registrado em TEST-001.                                        |

O build adicionou temporariamente referências ao dist isolado em `tsconfig.json`/`next-env.d.ts`; as duas alterações geradas foram revertidas ao estado que já existia antes do build. Nenhum arquivo de aplicação foi alterado.

## 4. Navigation Timings

### GET do documento / SSR, desktop local, 10 amostras quentes

TTFB é o tempo do início do GET até os headers. Tamanho é média do corpo lido pelo cliente HTTP, não transferência comprimida.

| Rota                    |   n | TTFB p50 |     p95* |      min–max | Corpo médio |
| ----------------------- | --: | -------: | -------: | -----------: | ----------: |
| `/`                     |  10 |     3 ms |     4 ms |     2–119 ms |    80.437 B |
| `/loja`                 |  10 |   862 ms |   977 ms | 568–1.233 ms |    92.782 B |
| `/loja/sofas`           |  10 |   762 ms | 1.005 ms | 695–1.049 ms |    91.027 B |
| `/produto/sofa-detroit` |  10 |   563 ms |   750 ms |   520–759 ms |    37.785 B |

\* `n=10`; p95 por nearest-rank fica no máximo ou perto dele. Uma carga inicial de `/loja` após subir o servidor teve `responseStart=2.556 ms`; runtime pronto em 273 ms. Isso é primeira carga observada, não p95 cold.

### Navegações client-side observadas

| Fluxo                      | Viewport/perfil          |   n |        clique → URL/pushState | clique → primeira mudança de conteúdo | Evidência adicional                                                                      |
| -------------------------- | ------------------------ | --: | ----------------------------: | ------------------------------------: | ---------------------------------------------------------------------------------------- |
| Início → Loja              | Desktop                  |   1 |                      1.083 ms | sem boundary; conteúdo chegou com RSC | RSC 1.065 ms, 14,5 KB transferidos / 32,8 KB decodificados.                              |
| Início → Loja (bottom nav) | 390×844, Fast 3G, CPU 4× |   1 |                      1.580 ms |                              1.880 ms | RSC 1.388 ms, 14,5 KB transferidos / 32,8 KB decodificados.                              |
| Loja → categoria Sofás     | Desktop                  |   1 |                      1.156 ms |                              1.195 ms | RSC 1.129 ms, 13,9 KB / 31,9 KB.                                                         |
| Loja → PDP                 | Desktop                  |   1 |                        923 ms |                                     — | RSC completo no clique: 854 ms, 3,3 KB / 7,5 KB.                                         |
| Loja → Conta (bottom nav)  | 390×844, Fast 3G, CPU 4× |   1 |                      1.366 ms |                 página Entrar exibida | sem sessão; sem requests Auth diretos no browser.                                        |
| Ordenação PLP              | Desktop                  |  10 | **p50 901 ms / p95 1.254 ms** |         **p50 910 ms / p95 1.265 ms** | RSC observado em 7/10; p50 805 ms / p95 1.234 ms. Conteúdo e URL mudaram em todas as 10. |
| Filtro `min=1000`          | Desktop                  |   1 |                      1.231 ms |                              1.246 ms | URL aplicado; 12 cards na página; nenhuma escrita.                                       |
| Paginação Loja → página 2  | Desktop                  |   1 |                        879 ms |                                885 ms | RSC 870 ms, 12,2 KB / 26,4 KB.                                                           |

Nas transições por `<Link>` observadas, o mesmo documento permaneceu ativo e houve `history.pushState`; não vi reload completo nesses fluxos. Há, porém, um `<a href>` interno em Perfil → Segurança (`ProfileEditor.tsx:82`) que causa reload se usado. O `window.location.replace` após login (`AuthExperience.tsx:214`) é fluxo de autenticação intencional e não foi medido.

## 5. Network Breakdown

- **RSC:** PLP e suas páginas usam payloads completos de aproximadamente 12–14,5 KB transferidos (26–33 KB decodificados) para ordenação/paginação/categoria. O request é a parte dominante das transições client-side medidas.
- **Prefetch:** na landing apareceu prefetch de `/loja` de ~1,2 KB; o clique posterior solicitou ~14,5 KB e esperou ~1,1 s. Na PLP móvel, em 3 s foram observados 10 requests de rota para 6 PDPs distintas; ao abrir Detroit, houve um request anterior parcial (~1,3 KB) e um novo request completo no clique (~3,3 KB, 854 ms). Prefetch está ativo, mas só antecipa parte do trabalho.
- **Cart summary:** duas chamadas `/api/cart/summary` por montagem/rota foram observadas. Em navegação já aquecida, cada resposta local ficou em 5–15 ms, payload de 33 B; custo remoto adicional não isolado.
- **Requests Supabase no browser:** as imagens são baixadas de Storage privado usando signed URLs; a URL/token nunca é reproduzida. O RPC/RSC do catálogo ocorre no servidor, portanto não foi contado como request direto browser→PostgREST.
- **Reload completo:** nenhum nas transições Next testadas; um `<a>` interno em perfil foi confirmado no código.

## 6. Server Rendering / RSC

- `/` é estática no build; Loja, categoria, PDP, carrinho e rotas de conta/admin são dinâmicas (`force-dynamic` nas páginas citadas abaixo).
- `CatalogListingPage` executa categorias + listagem em `Promise.all`, depois resumos + favoritos em outro `Promise.all` (`src/features/catalog/CatalogListingPage.tsx:22-31`). O segundo estágio depende dos IDs do primeiro; não é um waterfall acidental.
- PDP reutiliza `getProductDetail` com `React.cache` entre metadata e página; depois consulta reviews/resumo/favoritos/review própria em paralelo (`src/app/(storefront)/produto/[slug]/page.tsx:14-37`, `src/features/commerce/data.ts:151-176`). A assinatura das imagens depende dos paths retornados e é sequencial por necessidade.
- Não foi encontrado `loading.tsx` sob `src/app`; não há boundary de loading de rota. Também não encontrei `<Suspense>` de rota. Portanto a navegação pode esperar o RSC antes de trocar a página, sem skeleton/feedback imediato.
- Não foi feita instrumentação persistente de duração por função/RPC para evitar mudança em código de auditoria.

## 7. Supabase / Database

- A leitura da PLP chama RPC de listagem paginada com tamanho 12 e outra RPC de categorias. A função de busca/facetas agrega antes da página conforme PERF-002 da auditoria geral de 07/10.
- O código atual assina os paths da página em lote com `createSignedUrls` (`src/features/catalog/supabaseCatalogRepository.ts:96-133`). PDP também agrupa seus paths (`src/features/commerce/data.ts:156-175`). **N+1 de assinatura no fluxo PLP/PDP não confirmado.** As muitas requisições de imagem abaixo são GETs dos objetos no browser, não uma chamada de assinatura por card.
- A consulta read-only aos logs Postgres no intervalo desta auditoria não encontrou linhas com `duration: ... ms` para as RPCs. Logo, não há medida confiável de tempo individual de `get_catalog_listing`, `get_catalog_product_detail` ou categorias. Não executei `EXPLAIN ANALYZE` nem criei índice.
- **SQL bottleneck:** não confirmado. Os TTFBs de rota incluem proxy, RPCs, assinatura e render; não se deve atribuir os 0,8–1,0 s ao SQL isoladamente.

## 8. Auth / Middleware

- `proxy.ts:8-30` instancia Supabase SSR e chama `auth.getClaims()` para cada request que passa pelo matcher (exclui assets estáticos/imagens). É defesa de sessão existente; não remover para ganhar velocidade.
- `getCommerceIdentity` chama `getClaims()` também no servidor e é memoizado por request com `React.cache` (`src/features/commerce/data.ts:68-78`). Isso evita chamadas repetidas dentro daquele render, mas não compartilha trabalho com o proxy.
- Conta/admin não puderam ser medidos com sessão autenticada. Admin requer claims e consulta membership (`src/lib/supabase/admin-access.ts:7-24`); a guarda não foi contornada.
- Não foi medido fluxo de login, edição de perfil, MFA ou ação de carrinho. Não foram enviados formulários de mutação.

## 9. Images / Signed URLs

No perfil móvel Fast 3G + CPU 4×, `/loja` apresentou 20 elementos `<img>`: 19 GETs de objetos `catalog-images` e um asset local. Tempos dos 19 requests de Storage (download do objeto, não geração da signed URL): **min 4,8 s / p50 9,9 s / p95 13,2 s / max 13,2 s**. `loadEventEnd=14,9 s`; `DOMContentLoaded=1,76 s`. O conteúdo textual está utilizável muito antes de todas as imagens.

Trace mobile:

- LCP 11.306 ms; TTFB 633 ms; load delay 482 ms; download da imagem LCP 10.169 ms; render delay 22 ms.
- CLS 0,00.
- Insight do Chrome `ImageDelivery`: economia estimada de LCP 2.050 ms e ~2,1 MB. É estimativa de laboratório, não garantia.
- Insight `Cache`: economia estimada de LCP 1.900 ms e ~2 MB. Não tornar bucket público; avaliar derivadas menores/cache compatível com signed URLs privados.

A grid mostra 12 produtos; algumas cartas incluem uma segunda imagem para hover (`CatalogProductGrid.tsx:28-43`). Em mobile, imagens adicionais próximas da viewport contribuem para download concorrente. Assinatura agrupada e privacidade do bucket estão corretas; não alterar esses controles sem teste de segurança.

## 10. Client Bundle / Hydration

- O bundle exato por rota não foi isolado com cache desabilitado. Uma captura do Resource Timing teve 13 chunks JS e `encodedBodySize` acumulado de ~296 KB, mas `transferSize=0` para eles (cache), portanto não é uma medição válida de bytes efetivamente transferidos.
- `BottomNavigation` usa Framer Motion e é montado no `src/app/layout.tsx:5,54`, inclusive onde o dock fica visualmente oculto em desktop. Isso confirma dependência client-side global; ganho real não medido (**BUNDLE-001, potencial**).
- GSAP/ScrollTrigger/Lenis são carregados com `import()` em `LandingScrollMotion.tsx:23-30,199-206`, componente importado apenas pela página `/` (`src/app/page.tsx:1-4`). Não encontrei evidência de vazamento desses pacotes para PLP/PDP/Conta/Admin.
- Um reload mobile sob CPU 4× teve **0 long tasks ≥50 ms** pela PerformanceObserver. Não há evidência de bloqueio prolongado da main thread nesse fluxo.

## 11. React Rendering

- PLP contém 12 cards por página; medição móvel contou 582 nós DOM. A grade e os filtros são client-side onde necessário.
- Existem versões de campos de filtro para sidebar e dialog responsivo no DOM; isso duplica controles, mas nenhum custo de render foi medido. Não recomendo `memo` generalizado.
- Não foi usado React Profiler; não há prova de rerender amplo como causa principal.

## 12. Navigation / Prefetch / Loading

- Navegação principal, categorias, cards e paginação usam `next/link`; não encontrei `prefetch={false}` ou chamadas manuais `router.prefetch` em `src`.
- Prefetch está ativo, mas para rotas `force-dynamic` sem loading boundary o request visto antes do clique foi parcial; o clique ainda aguardou RSC completo. **PREFETCH_INEFFECTIVE=YES (parcial, nos fluxos medidos).**
- Ordenação/filtros usam `useTransition` + `router.push`; a URL e o conteúdo mudam após o RSC, sem skeleton de rota. Não há timer/motion aguardado antes do `router.push`; não encontrei prova de que o motion da bottom nav bloqueie a navegação.
- `ProfileEditor.tsx:82` usa `<a href="/conta/seguranca#email">`; migrar para `<Link>` é candidato de melhoria, não foi testado com sessão.

## 13. Admin Performance

**Runtime: não medido; sem sessão admin.** A guarda funcionou sem ser contornada.

O finding anterior **PERF-001** continua válido no código atual: `listAdminProducts` seleciona produtos, variantes, estoque e mídia sem `.range()`/`.limit()` (`src/features/admin/catalog-data.ts:67-74`). `/admin/produtos` assina uma thumbnail de cada produto antes de enviar a lista inteira ao client (`src/app/admin/produtos/page.tsx:17-43`); `CatalogManagementCenter` filtra, ordena e pagina localmente (`src/features/admin/CatalogManagementCenter.tsx:168-230`). Com 51 produtos não há benchmark autenticado nesta rodada; não afirmar lentidão observada. O risco estrutural cresce com catálogo e limite de linhas.

Quick edit sem salvar, filtros de admin, busca e seleção em massa não foram exercitados por falta de sessão. Nenhum dado real foi alterado.

## 14. Store PLP Performance

- Supabase retornou 51 produtos; a página exibiu 12. Busca por preço e ordenação responderam sem erro.
- Rota quente: `/loja` TTFB p50 862 ms / p95 977 ms; categoria Sofás p50 762 ms / p95 1.005 ms.
- Ordenação n=10: conteúdo p50 910 ms / p95 1.265 ms. Filtro de preço n=1: 1.246 ms até mudança de conteúdo. Paginação n=1: 885 ms.
- Assinatura da imagem é batch; GET dos objetos é a maior parte do LCP no mobile limitado.
- PERF-002 (busca/facetas agrega antes de paginar) permanece **risco potencial**, sem `EXPLAIN`/teste com carga que demonstre gargalo SQL em 51 produtos.

## 15. PDP Performance

- Sofá Detroit abriu e mostrou variantes, estoque disponível, review e imagens. Navegação desktop p50 não estimável (n=1): 923 ms até URL, request RSC 854 ms.
- GET quente direto: p50 563 ms / p95 750 ms (n=10).
- A metadata e página compartilham a função de detalhe memoizada; detalhes/reviews/favoritos/review própria são paralelizados após o produto.
- A imagem segue bucket privado e assinatura em lote. Não medi tempo individual da RPC de detalhe no Postgres.
- Favoritar, adicionar ao carrinho, avaliações e compra não foram executados para não mutar dados reais.

## 16. Mobile Performance

390×844, DPR 3, toque, Fast 3G e CPU 4×:

- Início → Loja pelo dock: URL 1,58 s; primeira mudança de conteúdo 1,88 s.
- Loja → Conta pelo dock: URL 1,37 s; tela de login sem sessão. O documento manteve navegação App Router.
- PLP: LCP 11,31 s, CLS 0; `load` 14,88 s. 19 imagens privadas, p50 9,92 s / p95 13,18 s.
- 0 long tasks ≥50 ms na amostra observada. Isso aponta imagem/rede, não CPU/React, como principal causa desse LCP.

Esses números são lab sintético e não representam percentis de usuários reais/CrUX.

## 17. Confirmed Bottlenecks

### LAT-001 — Imagens dominam LCP mobile

- **Severity:** HIGH (laboratório); **Confidence:** alta para o perfil testado.
- **Flows:** `/loja` mobile.
- **Evidence:** LCP 11.306 ms; 10.169 ms no download LCP; 19 requests privados com p50 9.919 ms; insight estima 2,1 MB excedentes/2.050 ms recuperáveis.
- **Root cause:** volume/formato/concorrência de imagens na PLP sob banda baixa. Não é falha da assinatura nem motivo para abrir bucket.
- **Correction candidate:** derivadas menores para card, garantir prioridade apenas para imagens acima da dobra e evitar segunda imagem em coarse pointer; verificar cache seguro de signed media.
- **Expected gain:** até estimativa do Lighthouse, não promessa. **Effort:** médio. **Risk:** médio (crop/qualidade/cache privado). Pode ser paralelizado depois de baseline limpo.

### NAV-001 — RSC dinâmico sem feedback de rota

- **Severity:** MEDIUM; **Confidence:** alta.
- **Flows:** Home→Loja, Loja→categoria/PDP, filtros/ordenação/paginação.
- **Evidence:** 0,5–1,3 s em conteúdo/URL; requests RSC de 12–14,5 KB; `force-dynamic`; nenhum `loading.tsx`; prefetch parcial seguido por request completo.
- **Root cause:** página depende de SSR/RPC antes de renderizar o conteúdo da rota e não mostra boundary enquanto espera.
- **Correction candidate:** `loading.tsx`/Suspense com feedback coerente; manter segurança e testar prefetch por tipo de rota, não desligar globalmente sem before/after.
- **Expected gain:** reduz latência percebida, não necessariamente TTFB. **Effort:** baixo/médio. **Risk:** baixo/médio (estado de filtros/scroll).

### AUTH-001 — Resumo do carrinho solicitado em duplicidade

- **Severity:** LOW; **Confidence:** alta.
- **Evidence:** 2 chamadas por montagem e 2 em mudança de rota. `BottomNavigation.tsx:194-203` chama `refresh()` no mount e também após `onAuthStateChange`; o efeito depende de `pathname` (`:164-165`). `/api/cart/summary` é `no-store` e consulta identidade/carrinho (`src/app/api/cart/summary/route.ts:4-18`).
- **Impact:** request duplicada e sessão avaliada novamente; custo local medido 5–15 ms, ganho exato em sessão remota não medido.
- **Correction candidate:** deduplicar refresh inicial/`INITIAL_SESSION` e evitar recriar o fluxo por pathname, mantendo logout/atualização de quantidade.
- **Effort/risk:** baixo; risco de contador stale se listener for simplificado sem teste.

### NAV-002 — Link interno com `<a>` em vez de `<Link>`

- **Severity:** LOW; **Confidence:** alta no código.
- **Flow:** Conta Perfil → Segurança.
- **Evidence:** `src/features/account/ProfileEditor.tsx:82`.
- **Impact/correction:** reload de documento e novo trabalho de proxy; usar `<Link>` é candidato. Não medido por falta de sessão autenticada.

## 18. Suspected Bottlenecks

- **PERF-001 (reuso do finding 07/10):** admin busca lista completa e pagina/faz filtro no browser; 51 produtos não demonstram degradação. Sem runtime admin.
- **PERF-002 (reuso do finding 07/10):** busca/facetas SQL agregam antes da página; sem tempo individual ou plano representativo, não confirmado como latência real.
- **BUNDLE-001:** Framer Motion entra no shell de todas as rotas via BottomNavigation globalmente montada; custo exato por rota/cache não isolado. GSAP/Lenis são específicos da landing.
- **Proxy/session:** `getClaims` no proxy e novamente dentro do Server Component é duplicação de trabalho potencial quando há sessão; nenhuma guarda deve ser removida. O impacto remoto não foi isolado.

## 19. False Positives / Things That Are Fine

- Landing `/` é estática e teve TTFB quente p50 3 ms; não é a causa da lentidão de navegação no servidor.
- Transições normais testadas são SPA/Next Link; não há reload geral causado pelo header/dock.
- A PLP/PDP agrupa geração de signed URLs; não há N+1 de geração de URL comprovado.
- A bottom nav não aguarda sua animação antes de navegar; não foi causa identificada.
- CLS foi 0 no trace. Não há evidência de long task ≥50 ms na amostra mobile com CPU 4×.
- Bucket permanece privado; signed URL temporária não equivale a acesso público permanente.

## 20. Remediation Candidates

1. Imagem de card responsiva/menor, prioridade da imagem LCP e supressão da imagem secundária em touch; manter Storage privado.
2. Boundary de carregamento em Loja/categoria/PDP e estado visual imediato durante transição; validar back/forward e querystring.
3. Remover request duplicada do resumo, preserving membership/session/cart count.
4. Corrigir link interno de perfil para `next/link`.
5. PERF-001, quando autorizado: paginação/filtros server-side e assinaturas só da página atual, com sessão admin e before/after.
6. PERF-002: obter plano/medida SQL segura em ambiente de teste antes de qualquer índice ou reescrita.
7. Medir separadamente tamanho wire do bundle em contexto sem cache antes de decidir qualquer divisão de motion.

## 21. Expected Gain vs Risk Matrix

| Candidate                 | Ganho esperado                                                     | Esforço     | Risco de regressão/segurança                             | Antes/depois necessário                            |
| ------------------------- | ------------------------------------------------------------------ | ----------- | -------------------------------------------------------- | -------------------------------------------------- |
| Imagens card/LCP menores  | Maior provável; Lighthouse estima até 2,05 s LCP/2,1 MB no cenário | Médio       | Médio: qualidade/crop e exposição; manter bucket privado | Trace mobile idêntico + requests/bytes             |
| Loading boundary em rotas | Alto em latência percebida; não muda TTFB                          | Baixo/médio | Baixo/médio: layout/scroll/back                          | click→feedback e click→conteúdo                    |
| Deduplicar cart summary   | Reduz pela metade chamadas observadas                              | Baixo       | Baixo: atualização de estado/autenticação                | requests por rota e eventos auth                   |
| Perfil `<Link>`           | Evita reload pontual                                               | Baixo       | Baixo                                                    | document navigation e auth flow                    |
| Admin pagination          | Evita crescimento proporcional a todos os registros                | Médio/alto  | Médio: busca/ações em massa/URL                          | 51 produtos, bytes, signed paths, sessão admin     |
| SQL PLP                   | Desconhecido até medição                                           | Médio/alto  | Médio/alto                                               | EXPLAIN/latência em dados de teste representativos |

## 22. Recommended Order

1. **Não iniciar fan-out agora.** Primeiro preservar/revisar o estado Git sujo e criar um commit local de baseline somente depois de autorização do proprietário.
2. Revisar foundation DEP-001 (Next 16.3.6 tem advisories apontados pela auditoria geral); atualização é trabalho sequencial, não foi feita aqui.
3. Com base reproduzível, atacar LAT-001/NAV-001/AUTH-001 em branches separadas com medidas before/after idênticas.
4. Perfilar Admin autenticado; então tratar PERF-001.
5. Só atuar em SQL/perf PLP após plano/medição que confirme gargalo.
6. Reviewer read-only e security review nas áreas de Auth/Admin/RPC/Storage; integrar uma tarefa por vez.

## 23. Checks Not Executed

- Sessão admin, quick edit, busca/filtro admin ou assinatura de imagem admin em runtime.
- `/conta/perfil` e `/conta/seguranca` autenticados; login real.
- Mutação de carrinho, review, perfil, estoque, publicação ou produto real.
- `EXPLAIN ANALYZE`, medição isolada de RPC, trace do servidor/SQL, escrita temporária ou branch DB de benchmark.
- E2E, Playwright suite, navegador físico, Safari/iPhone, CrUX/field data e CPU/network sem throttle para mobile real.
- 5 amostras cold reiniciando processo por rota; apenas uma primeira carga de Loja foi coletada.
- Bundle JS transferido sem cache; Resource Timing retornou `transferSize=0` para chunks já armazenados.
- Vercel/deploy, commit/push, leitura de valores `.env`, busca de segredo pelo valor exato.

## 24. Final Verdict

O principal problema reproduzido é a experiência móvel da PLP: conteúdo textual aparece antes, mas as imagens atrasam LCP para 11,3 s sob Fast 3G/CPU 4×. Em desktop, a lentidão percebida vem do RSC dinâmico: rotas e filtros aguardam aproximadamente 0,8–1,2 s e não têm boundary de loading. A arquitetura tem segurança/privacidade que deve ser preservada; não há evidência para abrir Storage, remover `getClaims`, afrouxar RLS ou adicionar índice no chute.

**Esta auditoria está completa para a fase permitida; nenhuma implementação foi iniciada.** O fluxo multiagente continua bloqueado pelo baseline Git: `main` está amplamente suja e não há commit confiável novo. Nenhum commit pode ser criado sem autorização explícita.

```text
PERFORMANCE_AUDIT_SUMMARY

PROD_LOCAL_MEASURED=YES (NODE_ENV=production; APP_ENV=staging; CATALOG_SOURCE=supabase)
DEV_LOCAL_MEASURED=NO

HOME_TO_STORE_P50=1083ms desktop n=1; 1580ms mobile n=1
HOME_TO_STORE_P95=NOT_ENOUGH_SAMPLES
STORE_TO_CATEGORY_P50=1156ms n=1
STORE_TO_CATEGORY_P95=NOT_ENOUGH_SAMPLES
STORE_TO_PDP_P50=923ms n=1
STORE_TO_PDP_P95=NOT_ENOUGH_SAMPLES
BOTTOM_NAV_P50=1366ms Shop->Account mobile n=1; Home->Shop 1580ms n=1
BOTTOM_NAV_P95=NOT_ENOUGH_SAMPLES
ADMIN_LIST_P50=NOT_MEASURED_NO_ADMIN_SESSION
ADMIN_LIST_P95=NOT_MEASURED_NO_ADMIN_SESSION

FULL_PAGE_RELOADS_FOUND=1_INTERNAL_PROFILE_ANCHOR; 0 in tested primary nav flows; auth replace is intentional
PREFETCH_PROBLEMS_FOUND=YES (partial prefetch; complete RSC still requested on click)
MISSING_LOADING_BOUNDARIES=YES (no src/app/**/loading.tsx found)
AUTH_WATERFALLS_FOUND=YES (proxy + server claims; impact not isolated; preserve security)
QUERY_DUPLICATION_FOUND=YES (2 cart-summary requests per observed route; 2+1 auth checks structurally possible)
RSC_WATERFALLS_FOUND=NO accidental PLP/PDP waterfall confirmed; required dependency stages remain
SIGNED_URL_BOTTLENECK=IMAGE_DOWNLOAD_CONFIRMED; URL signing is batched, signing latency not isolated
HYDRATION_BOTTLENECK=NOT_CONFIRMED; 0 long tasks >=50ms in one mobile run
GLOBAL_MOTION_BUNDLE_LEAK=FRAMER_MOTION_IN_GLOBAL_BOTTOM_NAV; GSAP/LENIS landing-scoped
ADMIN_FULL_LOAD_CONFIRMED=YES_IN_CODE; runtime not measured (existing PERF-001)
PLP_SQL_BOTTLENECK_CONFIRMED=NO; individual SQL timing unavailable (existing PERF-002 remains potential)

TOP_ROOT_CAUSE_1=PLP mobile image delivery (LCP 11.306s; 10.169s image load)
TOP_ROOT_CAUSE_2=Dynamic RSC route response without loading boundary (sort p50 910ms / p95 1265ms to content)
TOP_ROOT_CAUSE_3=Partial route prefetch plus duplicate cart-summary requests

PERFORMANCE_FIX_REQUIRED=YES
SECURITY_MUST_REMAIN_INTACT=YES

COORDINATOR_READINESS
BASELINE_CLEAN=NO
BASELINE_COMMIT_REQUIRED=YES
FOUNDATION_READY=NO (Next 16.3.6 / DEP-001 not addressed)
PARALLEL_AGENTS_SAFE=NO
CONFLICT_MATRIX_READY=NO
AGENTS_PLANNED=FOUNDATION DEP-001; DB-001; TEST-001; CODE-001 cart atomicity; SEC-001 owner action; NAVIGATION; PERF-001 admin; PERF-002 PLP/DB
DEPENDENCY_ORDER=BASELINE COMMIT -> FOUNDATION -> parallel branches -> independent review/security review -> integration
OWNER_APPROVALS_REQUIRED=YES (authorize local baseline commit only after reviewing existing dirty changes; Dashboard/remote migration actions remain separately gated)

PERFORMANCE_AUDIT_COMPLETE=YES
APPLICATION_FILES_CHANGED=NO
REPORT=docs/audits/2026-10-13-performance-latency-audit.md
TOP_ROOT_CAUSE_1=Mobile image delivery
TOP_ROOT_CAUSE_2=Dynamic RSC without loading feedback
TOP_ROOT_CAUSE_3=Partial prefetch plus duplicate summary work
```
