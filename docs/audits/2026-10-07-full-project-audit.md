# Império Sofás — Full Project Audit

Auditoria **somente de leitura dos dados de negócio**, realizada em 07/10/2026 (America/Sao_Paulo), sobre o checkout local indicado abaixo e o projeto Supabase conectado. Estado observado, não promessa de produção. Não houve alteração persistente de código, configuração, banco, Storage, produtos ou credenciais; este documento é o único arquivo de conteúdo do projeto criado. Build e Playwright geraram apenas artefatos temporários ignorados; `next-env.d.ts`, reescrito automaticamente pelo dev server, foi restaurado ao estado inicial. Vercel, deploy, carrinho novo, checkout, reativação de MFA e correções ficam fora de escopo. Nenhum segredo ou URL assinada é reproduzido aqui.

**Repositório:** `C:\Users\Thiago\Documents\Codex\2026-09-03\files-pasted-by-the-user-estou\outputs\imperio-sofas-vale`; branch `main`, já extensamente suja antes desta auditoria (arquivos modificados, dois removidos e muitos arquivos não rastreados). Todos foram preservados. Resultados remotos são um retrato pontual; a sessão admin real não foi usada para mutações de teste.

**Legenda:** `CONFIRMED ISSUE` = condição comprovada por código, check ou estado remoto; `POTENTIAL ISSUE` = caminho de falha comprovável, sem incidente observado; `BEST-PRACTICE IMPROVEMENT` = endurecimento/manutenção; `NOT AN ISSUE` = alerta investigado e descartado no escopo. Severidade mede prioridade neste projeto, não replica automaticamente a nota de um scanner.

## 1. Executive Summary

| Indicador | Valor |
| --------- | ----: |
| CRITICAL  |     0 |
| HIGH      |     3 |
| MEDIUM    |     9 |
| LOW       |     3 |
| INFO      |     0 |

| Eixo                 | Nota | Motivo                                                                                                                                              |
| -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security posture     | C    | Admin tem defesa em profundidade e secret não foi encontrada no bundle; versão do framework com advisories e proteção de senha vazada desabilitada. |
| Architecture health  | C    | Separação server/client e RPCs boas, mas landing mantém fonte comercial paralela e migration local/remota divergem.                                 |
| Code health          | B    | Tipagem, lint e build passam; há fluxo de importação com modo “dry-run” não estritamente inerte, corrida no carrinho e alguma duplicação.           |
| Performance health   | C    | PLP pagina e assina imagens em lote; admin lê tudo e a busca/facetas agregam conjunto completo. Sem benchmark de carga.                             |
| Documentation health | D    | README e documentos de progresso descrevem Vite, catálogo vazio e MFA obrigatório apesar do estado atual.                                           |
| Testing health       | D    | 29 E2E descobertos, 23 passam e 6 falham; pgTAP não pode rodar neste host; falta homologação de ações admin com sessão real.                        |

Os três pontos mais relevantes antes de ampliar o comércio são: dependências vulneráveis _com análise de aplicabilidade_, versionamento incorreto da última migration e confiabilidade do gate E2E. Nenhuma falha de autorização administrativa foi confirmada. Os riscos de consistência em Storage e concorrência no carrinho devem ser tratados antes de pedidos/checkout.

## 2. Current System Snapshot

- Stack instalada (`npm ls --depth=0`): Next 16.3.6/App Router, React 19.2.8, `@supabase/supabase-js` 2.117.1, `@supabase/ssr` 0.7.0, Framer Motion 13.2.0, GSAP 3.15.0, Lenis 1.3.26. Node requerido: 24 (`.github/workflows/ci.yml`).
- Rotas efetivamente construídas: `/`, `/loja`, `/loja/[categoria]`, `/produto/[slug]`, `/carrinho`, `/conta` e subrotas, `/admin` e produtos/avaliações, `/auth/callback`, `/auth/confirm`, `/api/cart/summary`.
- Supabase remoto read-only: **7 categorias, 51 produtos (todos `active`), 71 variantes, 107 linhas de mídia e 107 objetos** em `catalog-images`. Bucket `public=false`, limite 10 MB; 107 objetos somam ~12,24 MB, média ~114 KB, máximo ~290 KB. Esses números não provam aprovação comercial ou prontidão de checkout.
- O catálogo público lê RPCs filtradas; PLP usa `get_catalog_listing` paginado (12 por página) e assinatura de imagens em lote. PDP usa `get_catalog_product_detail`, memoizado por requisição (`react/cache`). Admin usa cliente SSR com chave publicável, sessão verificada e membership; não usa service role em runtime.
- Autenticação via Supabase Auth/SSR. MFA obrigatório foi desativado por decisão explícita do proprietário; a gestão TOTP opcional não é uma falha. Checkout, pedidos, pagamento, frete transacional e fiscal não estão implementados/homologados.

## 3. Security Audit

### SEC-001 — Proteção de senhas vazadas desligada

**Classe:** CONFIRMED ISSUE · **Severidade:** MEDIUM · **Confiança:** alta · **Área:** Auth/Supabase. **Evidência:** Security Advisor remoto retornou `auth_leaked_password_protection`/`WARN`, com estado disabled; [documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). **Problema/impacto:** novas senhas comprometidas podem ser aceitas, elevando risco de credential stuffing; não se confunde com a decisão de desligar MFA. **Cenário:** cadastro/troca de senha com senha conhecida em vazamentos. **Recomendação:** avaliar disponibilidade do recurso no plano e habilitar com teste de signup/reset; documentar a política. **Esforço:** baixo. **Risco da correção:** baixo/médio (possível mudança de UX em senha recusada).

### DEP-001 — Next.js instalado dentro de faixas afetadas por advisories

**Classe:** CONFIRMED ISSUE quanto à versão, POTENTIAL ISSUE quanto à exploração · **Severidade:** HIGH · **Confiança:** alta para versão/scan, média para exposição · **Área:** dependências/framework. **Evidência:** `npm ls` = Next 16.3.6; `npm audit --omit=dev` = 8 alertas high por pacote/cadeia, incluindo `next`; [advisory oficial de Image Optimization](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) informa correção em 16.3.8. **Nuance essencial:** esse SSRF específico requer `images.remotePatterns`, **não configurado** em `next.config.ts:3-10`; portanto não é prova de SSRF explorável aqui. Outros advisories têm pré-condições próprias (Draft Mode/cache components, self-hosting, dev MCP, rotas de metadata); não foram reproduzidos. **Impacto/cenário:** uma rota que satisfaça pré-condições de algum advisory pode ficar exposta; dependência vulnerável bloqueia revisão de segurança séria. **Recomendação:** revisar cada GHSA contra esta configuração e, em trabalho autorizado futuro, atualizar Next/lockfile para release corrigida com regressão; não aplicar `npm audit fix` cegamente. **Esforço:** médio. **Risco da correção:** médio (regressões framework).

### DB-001 — Histórico de migrations divergente entre disco e remoto

**Classe:** CONFIRMED ISSUE · **Severidade:** HIGH · **Confiança:** alta · **Área:** schema lifecycle. **Evidência:** último arquivo local é `supabase/migrations/20261007213113_catalog_publish_readiness_optional_dimensions.sql`; `list_migrations` remoto registra a mesma migration pelo nome como versão **20261007213800**. As 20 versões anteriores coincidem. **Impacto/cenário:** reset/push/reconciliação de schema em outro ambiente pode acusar migration remota ausente ou tentar reaplicar conteúdo; o estado de banco deixa de ser reproduzível sem intervenção. **Recomendação:** reconciliar o histórico por procedimento oficial, verificando conteúdo/checksum e ambiente antes de qualquer `migration repair`; nunca editar migration já aplicada às cegas. **Esforço:** baixo/médio. **Risco da correção:** alto se feito no projeto remoto errado. Nenhuma migration foi aplicada nesta auditoria.

### DB-002 — Remoção de mídia cruza transações sem reconciliação durável

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** alta para o caminho, sem falha observada · **Área:** Storage/DB. **Evidência:** `src/features/admin/actions.ts:413-448` deleta produto via RPC, depois remove paths no Storage; `:594-604` deleta `product_media` e ignora o erro de `storage.remove`. A RPC retorna paths após excluir linhas (`supabase/migrations/20261007213113_catalog_publish_readiness_optional_dimensions.sql:422-438`). **Impacto/cenário:** falha transitória de Storage após commit deixa objeto órfão; em remoção de imagem, a UI ainda informa sucesso. Sem linha de mídia/ledger, retry seguro fica difícil. **Recomendação:** outbox/ledger de limpeza com retries, operação idempotente e reconciliação; no mínimo tratar erro e registrar path sem expor URL assinada. **Esforço:** médio. **Risco da correção:** médio (ordem de exclusão e compatibilidade com RLS).

### Autorizações e falsos positivos investigados

- **NOT AN ISSUE — ações em massa admin sem proteção:** todas as Server Actions administrativas auditadas chamam `requireCatalogAdmin` na operação (`src/features/admin/actions.ts:53,190,221,256,317,348,381,413,451,480,563`), além do layout. `src/lib/supabase/admin-access.ts:7-24` valida claims e lê `catalog_admins`. O banco usa `private.is_catalog_admin()` com `auth.uid()`; as RPCs administrativas atuais são `SECURITY INVOKER`, repetem o guard e não concedem `EXECUTE` a `anon` (consulta remota `pg_proc`/`has_function_privilege`; `supabase/migrations/20261007213113_catalog_publish_readiness_optional_dimensions.sql:371-524`). Não foi realizado ataque autenticado com outra conta; conclusão é estrutural, não teste pentest.
- **NOT AN ISSUE — `SUPABASE_SECRET_KEY` no navegador:** existe apenas em `scripts/import-legacy-catalog.mjs:365-386,947`, fora de `src`; `.env.local` existe e é ignorado pelo Git (`git check-ignore`), não rastreado nem localizado nos commits examinados. Busca exata pelo valor em **78 arquivos** de `.next/static` recém-construídos: nenhum match. Este método não prova ausência em todo artefato histórico ou serviço externo; não imprime o valor. `SUPABASE_SERVICE_ROLE_KEY` aparece como declaração/placeholder em `.env.example`, `src/lib/env/server.ts` e validador estrutural, não como cliente runtime.
- **NOT AN ISSUE — bucket privado/publicação:** `catalog-images` é privado; policy pública de `storage.objects` só permite objeto associado a produto/categoria publicados e variante vendável (`private.is_public_catalog_media`). URLs assinadas de 15 minutos não tornam o bucket público. Links já emitidos têm TTL residual após despublicar; isto é comportamento de token, não evidência de acesso anônimo permanente.
- **NOT AN ISSUE — alertas genéricos do Security Advisor:** quatro tabelas `private.*` têm RLS ligado e zero policies intencionalmente (deny-by-default). Os avisos sobre `SECURITY DEFINER` público exigem inspeção de corpo: as RPCs de catálogo/reviews consultadas aplicam filtros de produto publicado; não se deve revogar `anon` dessas RPCs sem reprojetar a vitrine. Houve validação de grants, não apenas aceitação dos rótulos do advisor.
- **NOT AN ISSUE — open redirect/XSS óbvio:** destinos de auth passam por allowlist/regex de caminho local (`src/lib/auth-return-to.ts:1-28`); JSON-LD da PDP substitui `<` por `\\u003c` (`src/app/(storefront)/produto/[slug]/page.tsx:78-83`). Supabase usa chamadas parametrizadas, não concatenação de SQL do usuário. Ausência de token CSRF manual em Server Actions não é, por si só, vulnerabilidade demonstrada; origem/sessão e guards devem continuar testados.

## 4. Architecture Audit

### ARCH-001 — Landing mantém catálogo comercial paralelo ao persistente

**Classe:** CONFIRMED ISSUE · **Severidade:** MEDIUM · **Confiança:** alta · **Área:** fronteira de fontes de dados. **Evidência:** `src/sections/Catalog.tsx:5,69-113` importa cinco itens e textos de parcela de `src/data/products.ts:26-64`, enquanto a loja lê o catálogo Supabase de 51 produtos; o card monta mensagem de WhatsApp com o preço estático. **Impacto/cenário:** preço/medida/parcelamento da landing podem divergir de variante disponível na loja e a campanha não desliga quando item é arquivado. Berlim estático anuncia `2,50 m` e `12x R$339`, ao passo que o banco guarda variante de 2.500 mm com preço à vista de R$4.028,00; _não_ é possível inferir das duas cifras, isoladamente, se o parcelamento está errado. **Recomendação:** preservar layout da landing, mas alimentar nome/disponibilidade/preço/condições por uma projeção editorial vinculada ao catálogo com validação comercial; até lá deixar explícita a natureza consultiva dos valores. **Esforço:** médio. **Risco da correção:** médio (regressão visual e regras comerciais).

Arquitetura atual separa rotas, `features`, utilitários SSR e `sections`; `server-only` em repositórios/queries sensíveis é positivo. A rota PDP usa função memoizada (`src/features/commerce/data.ts:151-180`) tanto em metadata quanto em página. Não atribuir N+1 ao caminho principal da PLP: ele usa `createSignedUrls` em lote (`src/features/catalog/supabaseCatalogRepository.ts:101-145`). Há, porém, métodos de repositório antigos sem chamadores em rota atual (seção 9). O fallback local de catálogo é protegido contra uso explícito em `APP_ENV=staging|production` (`src/features/catalog/repository.ts`), mas a ausência de `APP_ENV` em ambiente novo seleciona `local`; operacionalmente a configuração precisa de gate claro antes de qualquer go-live.

## 5. Repository / Folder Structure Audit

```text
imperio-sofas-vale/
├─ src/app/             App Router: landing, loja/PDP, conta, admin, API/Auth
├─ src/features/        auth, account, admin, catalog, commerce
├─ src/sections/        landing, header, bottom nav
├─ src/lib/             env, Supabase SSR, links, money, motion
├─ src/data/            catálogo editorial estático legado
├─ supabase/migrations/ schema/RLS/RPCs; supabase/tests/ pgTAP
├─ scripts/             importação privilegiada e otimização de assets
├─ tests/e2e/           Playwright
├─ docs/                arquitetura, progresso, bloqueios, QA; audits/ (este relatório)
├─ public/              assets estáticos
└─ .github/workflows/   CI
```

Há sete diretórios `.next-*` de builds/dev **não rastreados e não ignorados** antes da auditoria, além de `.next` ignorado. São artefatos preexistentes; não foram apagados. Afetam `git status`/Knip (DX-001). `src/App.tsx` conserva a landing como composição; `src/app` é o runtime Next atual, não Vite. Várias migrations/features críticas ainda são não rastreadas: um clone do commit atual não reproduz este checkout nem a versão remota.

## 6. Documentation Audit

### DOC-001 — Runbook e progresso não refletem o sistema atual

**Classe:** CONFIRMED ISSUE · **Severidade:** MEDIUM · **Confiança:** alta · **Área:** documentação operacional. **Evidência:** `README.md:1-26,105-120` ainda declara Vite/`npm run preview`/`dist` e instrui atualizar preços em `src/data/products.ts`; `docs/progress.md:5-8,27-37,45-72` mistura 1 produto/0 produto remoto, carrinho ainda não iniciado e admin AAL2 obrigatório, apesar de 51 ativos, carrinho implementado e MFA desativado; `docs/admin-catalog.md` limita escopo a slice inicial. **Impacto/cenário:** operador novo usa comando errado ou toma decisão comercial com baseline obsoleto. **Recomendação:** criar “estado atual” curto e datado, mover história para changelog/arquivo, atualizar comandos Next e gates de comércio; marcar evidências antigas como históricas, sem apagá-las. **Esforço:** baixo/médio. **Risco da correção:** baixo, exceto se substituir história sem rastreabilidade.

`docs/production-blockers.md` e `docs/decisions.md` também têm trechos históricos, mas registram claramente a decisão atual de MFA opcional. `docs/test-evidence.md` é evidência de rodadas anteriores, não substitui a execução desta auditoria.

## 7. Code Quality Audit

### CODE-001 — Adição ao carrinho não é atômica

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** alta para a corrida, sem incidente observado · **Área:** concorrência/carrinho. **Evidência:** `src/features/commerce/actions.ts:122-147` lê `get_my_cart`, soma no processo Next e depois chama `setCartItem`; RPC `set_cart_item` faz upsert de quantidade absoluta (`supabase/migrations/20261006174118_commerce_interactions.sql`, função; definição remota consultada). **Impacto/cenário:** dois cliques/requisições simultâneas leem quantidade N e ambos gravam N+1, perdendo incremento. O limite 99/estoque é revalidado na RPC, mas não corrige perda de atualização. **Recomendação:** RPC atômica de incremento sob lock/UPSERT transacional; separar “set absoluto” de “incrementar”. **Esforço:** médio. **Risco da correção:** médio (semântica e estoque).

### CODE-002 — “Dry-run” do importador pode invocar RPC mutável

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** alta pelo fluxo estático · **Área:** tooling privilegiado. **Evidência:** `scripts/import-legacy-catalog.mjs:866-877` chama `callImport` na fase `all` **antes** do `if (applyMode)` e `:941-947`; `callImport` usa `import_legacy_catalog_product` (`:629-655`). A função SQL retorna idempotência se ledger existe, mas, sem ledger, segue para INSERT/UPDATE (`supabase/migrations/20261007174859_legacy_catalog_import.sql:141-159,161+`). **Impacto/cenário:** invocar `--phase=all --confirm-berlin-gate=ADMIN_VISIBLE` acreditando ser dry-run em ambiente onde o Berlim ainda não está no ledger pode produzir escrita ou tentar substituir fixture. Não foi executado nesta auditoria. **Recomendação:** dry-run estritamente SELECT-only; checar ledger/snapshot diretamente e invocar RPC apenas após flags de apply. **Esforço:** baixo/médio. **Risco da correção:** baixo se coberto por testes de CLI.

### CODE-003 — Indicador da bottom nav não apareceu em uma execução E2E

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** média (uma rodada) · **Área:** UI/motion mobile. **Evidência:** `tests/e2e/home-motion.spec.ts:37-49` recebeu `opacity:0` em vez de `1` após 5s; screenshot da falha mostra barra e labels mas não o círculo dourado. `src/sections/BottomNavigation.tsx:222-255,284-299` só exibe o indicador após medição de largura em RAF/ResizeObserver. **Impacto/cenário:** em hidratação/timing específico, item ativo perde destaque visual; não ficou provado que persiste em aparelho real. **Recomendação:** reproduzir isoladamente em produção/local com métricas de largura e resize, ajustar inicialização do indicador sem alterar o motion validado. **Esforço:** médio. **Risco da correção:** médio (animação/SSR).

Qualidade geral: Zod valida payloads de produto/admin, UUIDs e limites; RPCs implementam regras comerciais no banco. Erros de Storage e status de testes carecem de reconciliação. O lint tem apenas dois avisos de `<img>` (`src/components/StorePhoto.tsx:27`, `src/sections/Catalog.tsx:80`), ambos com assets locais/srcset; isso **não** prova LCP ruim nem exige conversão automática para `next/image`.

## 8. Duplication Report

| Arquivo A                                                 | Arquivo B                                                | Responsabilidade duplicada                                                    | Recomendação                                                              |
| --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/features/admin/actions.ts:43-51`                     | `src/features/admin/CatalogManagementCenter.tsx:110-114` | Parse de BRL/centavos em server e UI, com normalização ligeiramente diferente | Um parser puro testado, preservando validação no servidor.                |
| `src/features/admin/actions.ts:198-203`                   | `src/features/admin/actions.ts:462-467`                  | Slugificação de categoria repetida no mesmo módulo                            | Extrair helper pequeno e testar acentos/colisões.                         |
| `src/features/catalog/supabaseCatalogRepository.ts:73-99` | `src/features/commerce/data.ts:151-180`                  | Projeção/assinatura de mídia da PDP antiga e nova                             | Após confirmar chamadores, remover caminho antigo ou consolidar contrato. |
| `src/features/commerce/actions.ts:5-11`                   | `src/features/commerce/data.ts:73-78`                    | Obtenção de identidade Supabase em actions/data                               | Centralizar guard pequeno sem misturar cache de requisição e mutação.     |

**CODE-004 — duplicação/exports órfãos:** BEST-PRACTICE IMPROVEMENT · LOW · confiança média; esforço baixo/médio, risco baixo. Não é bug imediato; consolidar somente com testes, pois as fronteiras server/client são distintas.

## 9. Dead / Legacy Code Report

| Estado       | Item                                                                                                         | Motivo/evidência                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| KEEP         | Gestão TOTP opcional e migrations históricas MFA                                                             | Decisão do proprietário; não reativar, apagar fatores ou alterar migrations aplicadas.                            |
| KEEP         | `src/data/products.ts`                                                                                       | Ainda alimenta cinco cards da landing; legado **ativo**, não morto (ARCH-001).                                    |
| ARCHIVE      | Trechos históricos de `README.md`/`docs/progress.md`                                                         | Documentar como histórico ao atualizar estado atual; não excluir evidência.                                       |
| REMOVE_LATER | `getPublishedProducts`, `getPublishedProductBySlug` e `CatalogStatus`                                        | `knip` apontou exports sem uso; `rg` não achou chamadores de rota. Confirmar integração externa antes de excluir. |
| REMOVE_LATER | `localCatalogRepository` e `src/features/catalog/supabaseCatalogRepository.ts:listProducts/getProductBySlug` | Servem fallback/teste ou API antiga; não retirar antes de redesenhar contratos e suites.                          |
| UNKNOWN      | `scripts/optimize-*`, assets antigos e `supabase/functions/email-password-mfa`                               | Ferramentas/histórico podem ter valor operacional; não deletar baseado apenas no Knip.                            |

**DX-001 — artefatos de build poluem inventário:** BEST-PRACTICE IMPROVEMENT · LOW · confiança alta; sete `.next-*` não ignorados fizeram `knip` listar **600 arquivos “unused”**, principalmente bundles gerados. Esforço baixo, risco baixo: ajustar ignore/configuração Knip em tarefa futura, sem apagar diretórios preexistentes nesta auditoria.

## 10. Performance Audit

### PERF-001 — Admin busca o catálogo inteiro e pagina no browser

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** alta para arquitetura, sem benchmark de 1000+ itens · **Área:** backend/hydration. **Evidência:** `src/features/admin/catalog-data.ts:67-75` seleciona todos produtos com variantes/inventário/mídia sem `range`; `src/app/admin/produtos/page.tsx:17-43,62-75` assina uma miniatura para cada produto e envia todos ao componente client; `src/features/admin/CatalogManagementCenter.tsx:116-180` filtra/pagina localmente. A [documentação Supabase](https://supabase.com/docs/reference/javascript/using-modifiers-range) recomenda paginação, e a [referência da API](https://supabase.com/docs/reference/javascript/introduction) descreve limite padrão de 1000 linhas (configurável). **Impacto/cenário:** custo de SSR/RSC e assinatura cresce com o catálogo; após limite API, itens podem sumir silenciosamente da gestão. Com 51 produtos, não há evidência de degradação perceptível. **Recomendação:** filtro/contagem/paginação no servidor e assinar apenas mídias da página. **Esforço:** médio/alto. **Risco da correção:** médio (busca, seleção em massa e URL state).

### PERF-002 — Busca/facetas da PLP agregam conjunto completo

**Classe:** POTENTIAL ISSUE · **Severidade:** MEDIUM · **Confiança:** alta para plano lógico, sem `EXPLAIN ANALYZE`/carga · **Área:** Postgres. **Evidência:** `supabase/migrations/20261007213113_catalog_publish_readiness_optional_dimensions.sql:190-245` monta `sale` agrupando variantes vendáveis, aplica `position(lower(query) in lower(name/fabric/color/sku))`, janela `row_number` e facetas antes da página; índices atuais são sobretudo B-tree por categoria/status, variante ativa e mídia. **Impacto/cenário:** custo pode crescer com milhares de variantes ou busca livre; não é N+1 de rede nos 51 itens. **Recomendação:** medir `EXPLAIN (ANALYZE, BUFFERS)` em ambiente de teste representativo; avaliar `pg_trgm`/índices seletivos ou materialização apenas se medição justificar. Nova migration, nunca editar migration aplicada. **Esforço:** médio/alto. **Risco da correção:** médio (semântica de busca/facetas).

**Frontend/imagens:** a PLP retorna 12 produtos e assina paths com **uma** chamada `createSignedUrls` (`src/features/catalog/supabaseCatalogRepository.ts:101-145`); a PDP também assina em lote (`src/features/commerce/data.ts:151-180`). Portanto **N+1 ativo da PLP/PDP = não detectado**. O método legado `listProducts()` faria uma assinatura por imagem se voltar a ser chamado (`supabaseCatalogRepository.ts:73-85,157-169`), mas `rg` não encontrou chamador de rota atual. Imagens remotas são WebP pequenos em média; `unoptimized` em `CatalogProductGrid.tsx:32-49` evita o otimizador Next, porém não entrega tamanhos derivados por viewport. Priorizar métricas reais de LCP antes de mudar a arquitetura de URL privada. A execução E2E em dev emitiu alerta LCP de imagem acima da dobra; não é medida de campo.

**Motion/mobile:** `LandingScrollMotion` e bottom nav possuem listeners/observers e lógica adaptativa; `useEnhancedMotion` limita efeitos fortes em dispositivos. Não foi identificado leak comprovado na leitura; houve uma falha de visibilidade do indicador (CODE-003). `next/font` empacota fontes no build; não há evidência de fetch runtime de Google Fonts. Lighthouse/Core Web Vitals de produção não foram medidos; não inventar notas de LCP/CLS/INP.

## 11. Database & Supabase Audit

**Tabelas e RLS remotos:** `public.categories`, `products`, `product_variants`, `inventory`, `product_media`, `catalog_admins`, `customer_profiles`, `product_favorites`, `product_reviews`, `carts`, `cart_items` e quatro `private.*` relevantes estão com RLS **enabled**. Admin CRUD de catálogo exige `private.is_catalog_admin`; `catalog_admins` só revela a própria membership; perfis/favoritos/carrinhos aplicam ownership; avaliações publicadas têm SELECT público. `private.*` sem policy é deny-by-default para cliente. RLS não foi desligado. Não foi executada simulação de outro usuário nesta rodada.

**Grants/RPCs:** as cinco RPCs `admin_*` consultadas não são executáveis por `anon`, são `SECURITY INVOKER` e possuem guard SQL. RPCs públicas de catálogo/review são `SECURITY DEFINER`, `search_path=''` e devem continuar filtrando publicabilidade; o Advisor as marca genericamente, mas o corpo consultado de review aplica `status='published' AND product.status='active'`. RPCs pessoais exigem autenticação. `customer_profiles` conserva grants SQL amplos ao role `authenticated` (inclusive `TRUNCATE`/`TRIGGER` na consulta de grants), porém as rotas REST comuns não expõem TRUNCATE e as policies regem DML; registrar para redução de privilégio, **não** anunciar vazamento confirmado. As três policies permissivas SELECT de `product_reviews` acionam aviso de performance do Advisor; ganho de consolidação ainda não medido.

**Índices:** existem índices em `products(category_id,status)`, `product_variants(product_id,is_active)`, `product_media(product_id,position)`/`variant_id`/`storage_path`, `product_reviews(product_id,created_at)` parcial, cart item por variante e PKs. Não adicionar índices especulativos. Advisor de performance mostra dois índices “unused” (`catalog_admins_enabled_by_idx`, `email_mfa_verified_sessions_user_id_idx`), insuficiente para recomendar DROP com catálogo pequeno e MFA suspenso.

**Storage:** privado, policies admin para `products/<uuid>/<uuid>.<tipo>` e leitura pública condicionada à associação vendável; metadata de objetos confirma 107 uploads. Caveat de limpeza assíncrona em DB-002. Histórico local/remoto de migrations diverge em DB-001; outras versões observadas coincidem. Nenhuma query read-only alterou dados.

## 12. Test Coverage / Reliability Audit

### TEST-001 — Gate E2E falha e usa catálogo remoto mutável como fixture

**Classe:** CONFIRMED ISSUE · **Severidade:** HIGH · **Confiança:** alta · **Área:** testes/CI. **Evidência:** `npm run test:e2e -- --workers=2`: **23 passed, 6 failed** em ~3,1 min. `tests/e2e/catalog-listing.spec.ts:6-12,38-47,100-102` presume “1 modelo”, `max=500` vazio, largura `10000` e Berlim na primeira página; hoje há 51 produtos/28 checkboxes de largura, logo os seletores/expectativas não representam o catálogo real. `tests/e2e/commerce.spec.ts:52-54` procura grupo “Escolha a medida”, mas a UI atual usa “Escolha uma opção” (`ProductExperience.tsx:143-151`). Um teste de 18 navegações excede timeout 30s (`commerce.spec.ts:19-44`), sem prova de overflow; outro falha no indicador (CODE-003). `.github/workflows/ci.yml` roda banco/quality, **não** E2E. **Impacto/cenário:** falso vermelho/verde, regressão real não detectada e dependência de dados remotos mutáveis. **Recomendação:** fixtures isoladas e determinísticas, assertions exatas, test server com ambiente próprio, separar testes caros por viewport/timeout; incluir E2E estável em CI após isolamento. **Esforço:** médio/alto. **Risco da correção:** baixo/médio (pode expor defeitos reais ocultos).

**Inventário:** 29 Playwright em quatro arquivos; cinco SQL pgTAP em `supabase/tests`; sem suite unitária separada. Testes SQL usam transações/rollback e abrangem RLS/admin, catálogo, comércio e perfil. **PGTAP = BLOCKED_ENVIRONMENT:** `docker --version` não encontra Docker; `npm run db:test`/reset não foram executados. Nenhum teste autenticado de criação/edição/publicação/exclusão em massa do admin foi rodado nesta auditoria, pois isso alteraria dados reais. O código tem teste SQL de autorização, mas o fluxo browser→action→DB com conta não-admin/admin ainda requer ambiente isolado.

**Acessibilidade:** teste axe automatizado concluiu sem falha classificada como séria nos critérios da suíte; log diagnóstico apontou dois contrastes sérios em `/` antes do filtro/resultado final, pedindo reprodução manual. Não classificar como bug confirmado sem localizar nós/condições. `npm run typecheck`, `lint`, `format:check` e `build` passaram; lint com 2 warnings, não errors.

## 13. Dependency Audit

`npm audit --json` (árvore completa): **26 entradas** por pacote, 20 high, 4 moderate, 2 low; isso não significa 26 falhas exploráveis no app. `npm audit --omit=dev --json`: 8 high, 0 critical; inclui caminhos via `eslint-config-next` porque ESLint está em `dependencies`, não `devDependencies`. O pacote `next@16.3.6` tem múltiplos GHSA com pré-condições diferentes; a [falha de SSRF de imagens](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) não se aplica sem `images.remotePatterns`. Ver DEP-001.

**DEP-002 — Sharp abaixo da faixa corrigida, exposição específica não demonstrada:** POTENTIAL ISSUE · LOW · confiança alta na versão, baixa na explorabilidade. `sharp@0.35.4` é importado por `src/features/admin/actions.ts:7,510-523` e pelo importador; [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) afeta `<0.35.5` por librsvg. O upload admin aceita apenas JPEG/PNG/WebP e redecodifica, não SVG; não há reprodução da vulnerabilidade nesta rota. Reavaliar upgrade em trabalho futuro; esforço baixo, risco baixo/médio (processamento de imagem).

`knip` retornou código 1 com **600 falsos positivos gerados por `.next-*`**, mais alguns exports possivelmente mortos e `@knip/mcp`/`eslint-config-prettier` possivelmente desnecessários; sem configuração Knip, isto não autoriza remoção. ESLint/Prettier em `dependencies` aumentam footprint de instalação de produção potencial; mover só após validar pipeline. Nenhum pacote foi instalado/atualizado.

## 14. Positive Findings

- Admin guard em cada Server Action + RLS + guards SQL; IDs/status/valores validados, RPCs em vez de confiar só no layout.
- `SUPABASE_SECRET_KEY` segregada no script de migração, `.env.local` ignorado, nenhum match exato no bundle estático construído; nenhum uso `NEXT_PUBLIC_` da secret.
- Bucket privado e políticas de publicação detalhadas; upload usa Sharp, tamanho/pixels limitados, `upsert:false`, caminho aleatório e alt obrigatório.
- PLP paginada em 12 e URLs assinadas **em lote**; PDP com cache por requisição; imagens existentes relativamente pequenas.
- RLS habilitado em todas as tabelas de negócio listadas, ownership em perfil/favoritos/carrinho, RPCs pessoais autenticadas.
- Retorno de auth limitado a caminhos internos, JSON-LD escapado, headers `no-store` em callbacks/summary.
- Migrations e pgTAP versionados no checkout; CI de build/typecheck/lint/formatação/banco; 23 cenários E2E passaram nesta rodada.
- Sem checkout/pagamento live prematuro; documentação distingue bloqueios comerciais e preserva a decisão do proprietário sobre MFA.

## 15. Risk Matrix

| ID       | Severity | Area       | Finding                                        | Impact                     | Effort      |
| -------- | -------- | ---------- | ---------------------------------------------- | -------------------------- | ----------- |
| DEP-001  | HIGH     | Framework  | Next em faixas afetadas; exploração contextual | Segurança/regressão        | Médio       |
| DB-001   | HIGH     | Migrations | Versão local/remota divergente                 | Reprodutibilidade do banco | Baixo/médio |
| TEST-001 | HIGH     | E2E        | 6 falhas, fixtures frágeis, CI sem E2E         | Gate pouco confiável       | Médio/alto  |
| SEC-001  | MEDIUM   | Auth       | Senhas vazadas não bloqueadas                  | Credenciais fracas         | Baixo       |
| DB-002   | MEDIUM   | Storage    | Falta reconciliação pós-delete                 | Objetos órfãos             | Médio       |
| ARCH-001 | MEDIUM   | Catálogo   | Landing com dados comerciais paralelos         | Divergência de oferta      | Médio       |
| CODE-001 | MEDIUM   | Carrinho   | Incremento não atômico                         | Quantidade perdida         | Médio       |
| CODE-002 | MEDIUM   | Importador | Dry-run pode escrever                          | Mutação inesperada         | Baixo/médio |
| CODE-003 | MEDIUM   | Mobile nav | Indicador ausente em uma E2E                   | Estado ativo menos claro   | Médio       |
| DOC-001  | MEDIUM   | Docs       | Runbook/progresso desatualizados               | Operação equivocada        | Baixo/médio |
| PERF-001 | MEDIUM   | Admin      | Lista inteira em SSR/client                    | Escala/limite de linhas    | Médio/alto  |
| PERF-002 | MEDIUM   | DB busca   | Agregação/facetas antes da página              | Crescimento de latência    | Médio/alto  |
| CODE-004 | LOW      | Manutenção | Parse/slug/identidade duplicados               | Drift futuro               | Baixo/médio |
| DEP-002  | LOW      | Imagens    | Sharp advisory condicional                     | Exposição não demonstrada  | Baixo       |
| DX-001   | LOW      | Repo       | Builds não ignorados, Knip ruidoso             | Higiene/diagnóstico        | Baixo       |

## 16. Quick Wins

Não executar nesta auditoria. Após aprovação: (1) reconciliar README/estado atual (DOC-001); (2) ajustar expectativas/seletores E2E para fixtures controladas (TEST-001); (3) separar dry-run de RPC de escrita (CODE-002); (4) configurar ignore do Knip e artefatos `.next-*` **sem remover arquivos do usuário** (DX-001); (5) analisar disponibilidade da proteção de senhas vazadas (SEC-001). Atualização de dependências requer testes, não é autofix trivial.

## 17. Refactoring Candidates

Prioridade estrutural futura: catálogo editorial da landing vindo de uma projeção aprovada (ARCH-001); paginação/filtro admin no servidor (PERF-001); limpeza de Storage por outbox (DB-002); incremento atômico do carrinho (CODE-001); busca/facetas guiadas por `EXPLAIN` de dados representativos (PERF-002). Preservar estética da landing e os contratos de publicação. Evitar refatoração ampla antes de estabilizar testes.

## 18. Recommended Remediation Order

- **PHASE 0 — Critical Security:** No Critical findings.
- **PHASE 1 — High Security:** triagem GHSA por pré-condição e atualização testada do framework (DEP-001); proteção de senha vazada se recurso disponível (SEC-001).
- **PHASE 2 — Data/Authorization:** reconciliar versão da migration com procedimento seguro (DB-001); tornar dry-run realmente inerte (CODE-002); outbox de Storage e incremento transacional (DB-002, CODE-001). Não alterar autorização admin sem evidência de falha.
- **PHASE 3 — Performance:** medir e paginar admin, perfilar SQL da PLP, observar indicador mobile (PERF-001/002, CODE-003).
- **PHASE 4 — Architecture:** unificar fonte comercial da landing e isolar fixtures E2E (ARCH-001, TEST-001).
- **PHASE 5 — Cleanup/Documentation:** atualizar docs e tooling/duplicações (DOC-001, DX-001, CODE-004, DEP-002).

## 19. Files Requiring Attention

| Arquivo                                                                                                                   | Motivo                                           | IDs                       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------- |
| `package.json`, `package-lock.json`, `next.config.ts`                                                                     | Versões/triagem advisories; sem `remotePatterns` | DEP-001, DEP-002          |
| `supabase/migrations/20261007213113_catalog_publish_readiness_optional_dimensions.sql`                                    | Versão divergente; RPCs/listagem                 | DB-001, PERF-002          |
| `src/features/admin/actions.ts`                                                                                           | Limpeza de Storage; parser; Sharp                | DB-002, CODE-004, DEP-002 |
| `src/features/admin/catalog-data.ts`, `src/app/admin/produtos/page.tsx`, `src/features/admin/CatalogManagementCenter.tsx` | Carregamento integral/admin                      | PERF-001                  |
| `src/features/commerce/actions.ts`                                                                                        | Incremento de carrinho                           | CODE-001                  |
| `scripts/import-legacy-catalog.mjs`, `supabase/migrations/20261007174859_legacy_catalog_import.sql`                       | Dry-run/RPC privilegiada                         | CODE-002                  |
| `src/sections/BottomNavigation.tsx`, `tests/e2e/home-motion.spec.ts`                                                      | Inicialização do indicador                       | CODE-003                  |
| `src/sections/Catalog.tsx`, `src/data/products.ts`                                                                        | Fonte comercial paralela                         | ARCH-001                  |
| `README.md`, `docs/progress.md`, `docs/admin-catalog.md`                                                                  | Estado antigo                                    | DOC-001                   |
| `tests/e2e/catalog-listing.spec.ts`, `tests/e2e/commerce.spec.ts`, `playwright.config.ts`                                 | Fixtures/expectativas/timeouts                   | TEST-001                  |
| `.gitignore`                                                                                                              | Diretórios build não ignorados                   | DX-001                    |

## 20. Commands / Checks Executed

`git status --short --untracked-files=normal`, `git branch --show-current`, `git check-ignore .env.local`, `git ls-files`/`git log` direcionados a env; `rg`/`Get-Content` de código, migrations, docs e testes; verificação apenas booleana de presença da secret local e match exato em 78 arquivos `.next/static`; `npm ls ... --depth=0`; `npm run typecheck` **PASS**; `npm run lint` **PASS com 2 warnings**; `npm run format:check` **PASS**; `npm run build` **PASS**; `npm audit --json` **26 entradas**; `npm audit --omit=dev --json` **8 high**; `npx playwright test --list` **29 testes**; `npm run test:e2e -- --workers=2` **23 PASS / 6 FAIL**; `npm run knip` **inconclusivo por artefatos**; `docker --version` **não disponível**. Supabase MCP read-only: `list_migrations`, advisors security/performance, consultas `SELECT` a `pg_policies`, `pg_proc`, grants, bucket, contagens, metadata de objetos e índices. Consultadas documentação oficial Supabase e advisories GitHub. Nenhum comando de importação, DDL, DML, deploy, git commit ou push.

## 21. Checks Not Executed

- `npm run db:test`/pgTAP e `db:reset`: Docker não instalado no host; **PGTAP = BLOCKED_ENVIRONMENT**, não test failure. Não aplicar pgTAP ao banco remoto com dados reais.
- Teste autenticado de Server Actions admin, upload/remoção ou alteração de perfis: exigiria mutação de dados; proibido nesta auditoria. Autorizações foram inspecionadas em código/policies/grants.
- `EXPLAIN ANALYZE` com carga representativa, benchmark Web Vitals/Lighthouse em aparelho físico: tempo/dados de staging não disponíveis; nenhum número de LCP/CLS/INP inferido.
- Varredura forense de todos os commits/artefatos históricos e de sistemas externos para segredo: `git log` direcionado e bundle atual deram negativo no escopo; não é certificação absoluta de ausência de vazamento.
- Configuração operacional completa de Auth (rate limits/CAPTCHA/SMTP) no Dashboard: Security Advisor expôs apenas proteção de senha vazada; demais settings não foram homologados. Não afirmar que rate limiting externo está ausente.
- Vercel/deploy: expressamente fora do escopo do proprietário.

## 22. Final Verdict

| Gate                                    | Veredito    | Justificativa                                                                                                                        |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| PRODUCTION_SECURITY_READY               | NO          | Dependências em faixas afetadas, política de senha vazada e E2E/admin real ainda sem homologação; **não** por MFA desligado.         |
| PRODUCTION_ARCHITECTURE_READY           | CONDITIONAL | Fundação boa para catálogo local; histórico de migrations e fonte comercial da landing precisam convergir antes de operação robusta. |
| PRODUCTION_PERFORMANCE_READY            | CONDITIONAL | 51 itens não evidenciam lentidão; riscos de crescimento precisam de medição/paginação antes de escala.                               |
| MAJOR_REFACTOR_REQUIRED                 | NO          | Correções por fronteira/fluxo, não reescrita geral.                                                                                  |
| SECURITY_FIXES_REQUIRED_BEFORE_CHECKOUT | YES         | Triagem/atualização de dependências, proteção de senha e testes de autorização/concorrência antes de introduzir pedidos/pagamento.   |
| TECH_DEBT_LEVEL                         | HIGH        | Documentação e gate de testes desatualizados, migration divergente, fluxos duplicados.                                               |

O catálogo atual funciona como base de desenvolvimento, mas esta auditoria **não certifica produção comercial**. A prioridade é corrigir/verificar os achados sem perder a proteção já existente. MFA continua opcional por decisão do proprietário. Nenhuma correção foi aplicada.

```text
AUDIT_SUMMARY
CRITICAL=0
HIGH=3
MEDIUM=9
LOW=3
INFO=0
SECURITY_SCORE=C
ARCHITECTURE_SCORE=C
CODE_SCORE=B
PERFORMANCE_SCORE=C
DOCUMENTATION_SCORE=D
TEST_SCORE=D
SECRET_LEAK=NOT_DETECTED_IN_SCOPED_CHECKS
ADMIN_AUTHORIZATION=STRUCTURAL_PASS_NOT_PENTESTED
RLS=ENABLED_ON_RELEVANT_TABLES
STORAGE_SECURITY=PRIVATE_WITH_CONDITIONAL_PUBLIC_READ
DEPENDENCY_SECURITY=REVIEW_REQUIRED
CODE_DUPLICATION=LIMITED
DEAD_CODE=SOME_UNUSED_EXPORTS_AND_LEGACY_PATHS
N_PLUS_ONE=NO_ACTIVE_PLPPDP_NETWORK_N_PLUS_ONE_DETECTED
CLIENT_BUNDLE_RISK=NO_SECRET_MATCH_IN_78_STATIC_FILES
DATABASE_INDEX_RISK=MEASURE_AT_SCALE
MOBILE_PERFORMANCE_RISK=NOT_BENCHMARKED
PRODUCTION_SECURITY_READY=NO
PRODUCTION_ARCHITECTURE_READY=CONDITIONAL
PRODUCTION_PERFORMANCE_READY=CONDITIONAL
MAJOR_REFACTOR_REQUIRED=NO
SECURITY_FIXES_REQUIRED_BEFORE_CHECKOUT=YES
TECH_DEBT_LEVEL=HIGH
```
