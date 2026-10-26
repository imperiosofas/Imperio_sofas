# Veredito final — Analytics e painel administrativo

**Data:** 16/10/2026  
**Checkout:** `integration/final-hardening` (`72a0ad0` + alterações locais preservadas)  
**Alvo remoto:** apenas Supabase TEST `qsafyqsskwbjnailgoev`  
**Veredito:** **INTEGRADO LOCALMENTE / APROVADO COM RESSALVAS**

**Atualização da homologação visual/XLSX:** 16/10/2026. A inspeção desktop não pôde ser feita: a política do navegador bloqueou a observação de `localhost:3105`, e não foi usado outro meio para contornar o bloqueio. Nenhuma captura desktop foi gerada nesta etapa. As capturas mobile da sessão anterior continuam no histórico da conversa.

As capturas anteriores do drawer, dashboard e tabelas aparecem inline no histórico, sem arquivos salvos no repositório. O arquivo XLSX real examinado foi `C:\Users\Thiago\Downloads\imperio-analytics-2026-10-15.xlsx`.

## Resultado executivo

A Fase 1 de Analytics foi integrada: há dashboard administrativo de estado atual do catálogo/estoque, navegação própria no admin e exportação XLSX. O dashboard usa uma agregação no servidor e não gera receita, conversão, pedidos, visitas ou eventos fictícios. O acompanhamento comportamental segue sem instrumentação até aprovação de privacidade/consentimento. Nesta homologação, a prontidão de publicação foi corrigida para ignorar variantes inativas, com migration aplicada somente ao Supabase TEST e regressões pgTAP passando.

A migration aditiva `20261015195848_admin_catalog_analytics_snapshot.sql` foi aplicada ao Supabase TEST e verificada. O estado atual lido é 7 categorias, 51 produtos ativos/publicados, 0 rascunhos, 71 variantes/linhas de inventário e 107 mídias. O bucket `catalog-images` continua privado. A homologação não alterou linhas comerciais nem de cliente.

O caminho não autenticado e a suíte E2E foram validados localmente (32/32). Após o proprietário autenticar manualmente, foram inspecionados o dashboard, o drawer mobile, as páginas de produtos/estoque/comportamento/relatórios e o filtro de categoria. O contraste do cabeçalho de Analytics no viewport mobile foi corrigido localmente, com uma regra escopada ao cabeçalho da feature.

O XLSX real contém 6 abas e 6 tabelas, com 51 produtos, 71 variantes e 7 categorias. No OOXML da aba `Produtos`, as células de atributos vazios usam `t="s"` e `<v>35</v>`: `35` é o índice da tabela de strings compartilhadas, cujo item de índice 35 é a string vazia. Não é o valor da célula nem índice de estilo (o arquivo tem estilos 0–17). A leitura anterior do Artifact Tool confundiu a referência de shared string com o conteúdo. Consulta somente leitura no Supabase TEST comparou as 71 variantes por SKU: 71/71 correspondências, sem diferenças em `color`, `fabric`, `width_mm`, `depth_mm` ou `height_mm`; os nulos e os valores preenchidos coincidem. Não há literal `35` nesses campos no banco. O corpo instalado de `admin_list_catalog_products` projeta esses campos diretamente de `product_variants`; a execução direta da RPC via conector SQL foi negada pelo guard administrativo (`forbidden`), sem tentativa de simular uma sessão. O gerador ExcelJS não foi alterado. Foi acrescentado teste de round-trip para garantir que campos nulos permaneçam vazios no XLSX. Nenhum dado comercial foi escrito ou alterado.

## Classificação solicitada

### CLOSED

- Contrato da Fase 1 limitado a snapshots atuais de catálogo e estoque; apresentação pública não expõe saldo operacional exato.
- A autorização do admin não depende de o item estar escondido no menu: layout, serviço, API e RPC mantêm verificação server-side de sessão/membership.
- `admin_get_analytics_snapshot(uuid)` está configurada como `SECURITY INVOKER`, usa `private.is_catalog_admin()`, revoga execução de `PUBLIC`/`anon` e concede a `authenticated`.
- Sem tracking comportamental, dados pessoais, busca livre, URLs assinadas ou caminhos de Storage no Analytics/XLSX.
- O teste de export cobre categoria inválida/duplicada (400), visitante (401), usuário não autorizado pelo guard (403) e arquivo real (200), além de `private, no-store`.
- Corrigido no XLSX o nome da categoria (em vez de UUID) no escopo exportado; timestamp agora informa explicitamente UTC.
- Corrigidos foco dourado de baixo contraste em superfícies claras, nome acessível genérico do drawer, alvos de navegação menores que 48 px e retorno de foco para botão que some após navegar pelo drawer.
- A advisory de `uuid` foi removida do grafo de produção: `exceljs@4.4.0` usa override limitado a `uuid@11.1.1`; `npm audit --omit=dev` encontrou 0 vulnerabilidades.

### INTEGRATED

- `/admin/analytics`: visão geral; páginas de produtos, estoque e comportamento; estados vazios/erro e filtro de categoria.
- `/admin/relatorios`: download server-side de XLSX, mantendo o filtro selecionado.
- AdminShell e navegação administrativa responsiva integram os destinos de Analytics/relatórios sem substituir os guards existentes.
- Migration SQL e teste pgTAP versionados localmente; a RPC foi aplicada e verificada somente no projeto Supabase TEST.
- Corrigido `admin_list_catalog_products`: a condição de prontidão agora exige `product_variants.is_active`, além dos requisitos oficiais já usados pelas regras de publicação. A migration remota é `20261015230054`; seu SQL local está em `supabase/migrations/20261015230054_admin_catalog_variant_activity_readiness.sql` e o conteúdo permaneceu idêntico ao aplicado.
- Regressão pgTAP para variante somente inativa, conjunto misto ativa/inativa, ativa sem inventário/requisitos e produto pronto; 8/8 passaram após a migration. A regressão falhou nos cenários de variante inativa antes da correção (red proof). Fixtures foram executados em transação e revertidos.
- Exportação com 6 planilhas — Resumo, Produtos, Estoque, Categorias, Comportamento e Metodologia —, dois gráficos com dados reais, escape de fórmula, limites e paginação sequencial.
- Regressão de serialização cobre `NULL` em cor, tecido e medidas, relendo o XLSX gerado e confirmando células vazias também na aba de estoque.
- Os testes do gerador verificam estruturalmente planilhas, células, filtros, formatos, fórmulas, headers, nomes de categorias, dois gráficos e barras de dados. Nesta homologação não foi gerado/baixado um XLSX real com sessão admin; portanto, essa evidência automatizada não substitui a conferência visual de um arquivo real.
- O arquivo explica que o resumo usa um snapshot, enquanto as páginas de produto/estoque são consultadas separadamente e podem refletir momentos concorrentes.
- Alterações preexistentes do checkout foram preservadas. Nenhum commit foi criado porque os arquivos necessários não podem ser separados com segurança do estado atual: `package.json` adiciona ExcelJS, mas também move ESLint/Prettier entre dependências runtime e dev; `package-lock.json` contém 1.214 inserções e 29 remoções incluindo essa reclassificação; a correção de variantes depende da migration de paginação `20261014145321_admin_catalog_server_pagination.sql`, ainda untracked; e `AdminShell.tsx` depende de `AdminNav.tsx`/CSS untracked. Há ainda outros arquivos staged, modificados e untracked, incluindo um rename staged preexistente. O índice e todos esses workstreams foram preservados; nenhum commit parcial não reproduzível foi criado.

### APPROVED_NOT_INTEGRATED

- Nenhuma alteração aprovada ficou pendente de integração. Revisões independentes de dados/SQL, serviço, shell, UI, export e revisão final aprovaram com as ressalvas registradas abaixo.

### BLOCKED_OWNER

- **Analytics comportamental:** depende de decisão do proprietário sobre base legal, texto de privacidade, consentimento opt-in/opt-out e retenção. Não foram criados eventos nem habilitado tracking.

### BLOCKED_ENVIRONMENT

- **Sidebar desktop:** a aba local informada pelo usuário não pôde ser observada porque a política do navegador bloqueou `localhost:3105`. Não foram tentadas superfícies alternativas, bypass nem automação de credenciais. QA visual desktop e capturas permanecem pendentes.
- **Execução autenticada da RPC:** a chamada `admin_list_catalog_products` pelo conector SQL retornou `forbidden`, pois não recebeu a sessão administrativa. A consulta SQL somente leitura e a projeção instalada da função foram verificadas; não foi simulada identidade administrativa.
- **Excel nativo:** não há Excel/LibreOffice disponível. O XLSX real foi aberto/renderizado com Artifact Tool e os PNGs incorporados foram extraídos do próprio arquivo para inspeção; compatibilidade visual em Excel/LibreOffice ainda depende de conferência manual.

### DEFERRED

- **`ANALYTICS_FASE_2` — PENDENTE:** receita, pedidos válidos, ticket médio, conversão, abandono, pagamento, margem, reembolso e frete aguardam pedidos, frete, checkout e pagamento implementados e homologados. Nenhum valor foi simulado.
- **Escala de exportação:** antes de o catálogo crescer substancialmente, criar uma projeção/RPC leve para o XLSX ou streaming, em vez de carregar campos descartados.
- **Commit local:** não criado. As dependências cruzadas e os manifests mistos descritos em `INTEGRATED` impedem um commit Analytics reproduzível sem misturar trabalho anterior. A migration de variantes também não é replayável isoladamente sem sua migration-base de paginação.

## Falha, risco potencial e melhoria

### Falha real

- A exportação inicialmente mostrava UUID no lugar do nome da categoria e não explicitava o fuso do timestamp. Corrigido e coberto por testes de regressão.
- Foco dourado sobre superfície clara tinha contraste medido de 1,39:1; o foco recebeu cor escura dedicada. Targets de navegação/loja foram elevados ao mínimo de 48 px e a navegação do drawer não devolve foco ao botão que desaparece após troca de rota.
- No viewport mobile, a regra global `header { background-color: #0d0d0d }` deixava escuro o cabeçalho de Analytics enquanto seu título permanecia escuro. Corrigido com `background-color: transparent` somente em `.pageHeader` de Analytics. Captura posterior confirmou título e descrição legíveis; `typecheck`, `lint`, Prettier focalizado e build passaram.
- `npm run format:check` global termina com erro em **90 arquivos** históricos/preexistentes. Não reformatei em massa. Prettier focalizado nos arquivos de código tocados passou; dois documentos históricos continuam fora do padrão.

### Riscos potenciais

- **P2 — custo de memória/rede do export em catálogos grandes:** a exportação limita-se a 20 páginas de 100 produtos, 20.000 variantes e 25 MiB; porém a RPC administrativa existente ainda transfere descrição e mídia antes de o parser descartá-las, e o limite final de bytes é verificado após gerar o XLSX em memória. Com os 51 produtos atuais os testes passaram; não é N+1 nem falha funcional atual, mas merece uma projeção específica/streaming antes de crescimento.
- **P3 — classificação HTTP acoplada ao Next.js:** 401/403 reconhecem os `digest` de `redirect()`/`notFound()`. O comportamento foi testado e falha fechado, mas mudança interna do Next pode converter uma negativa em 500; preferível no futuro um resultado de autorização explícito.
- **P3 — UUID de desenvolvimento:** `uuid@8.3.2` continua na árvore de desenvolvimento através de `@lhci/cli`; o override corrigido é restrito à árvore do ExcelJS/prod. O `npm audit --omit=dev` atual passou. A advisory [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) não é evidência de exploração neste fluxo; revisar separadamente as dependências de desenvolvimento.
- **Prontidão da lista de produtos — corrigida:** a listagem agora filtra variantes inativas na agregação de `sellable`; os quatro cenários de regressão pgTAP passaram. As 71 variantes comerciais atuais permaneceram intocadas.
- **Avisos não bloqueantes observados nos testes:** ESLint conserva 2 avisos antigos de `<img>`; o servidor de teste também emitiu avisos de LCP e um mismatch de hidratação no campo de e-mail da tela `/conta` (`caret-color`). Não foram introduzidos/corrigidos por Analytics.
- **Divergência XLSX `35` — falsa leitura, não falha real:** no XML, `t="s"` faz `<v>35</v>` apontar para o item 35 de `sharedStrings.xml`, que é vazio. Os estilos não usam índice 35. A comparação por SKU com o Supabase TEST confirmou 71/71 linhas e valores exatos, inclusive todos os `NULL`; a leitura anterior do Artifact Tool interpretou incorretamente o índice. Não há defeito confirmado no mapeamento nem no gerador ExcelJS, portanto o gerador permanece inalterado.

### Achado de dados, não falha dos cartões

- A projeção pública e `products.status` mostram 51/51 itens ativos/publicados, 0 drafts. O `applied_snapshot` do ledger legado ainda descreve o estado inicial da importação como `draft`; os registros de auditoria disponíveis não permitem atribuir com segurança ator ou operação que mudou esses status. O dashboard reflete a tabela atual corretamente. Nenhum status/preço/estoque/variante/publicação foi alterado nesta homologação.
- pgTAP remoto passou 63/63. Fixtures criados em transação foram revertidos e a releitura confirmou zero linhas de fixture; sequências PostgreSQL não são transacionais e podem ter lacunas de IDs, sem linhas comerciais/de cliente persistidas.

### Melhorias futuras, não bloqueadoras desta Fase 1

- Fazer a revisão visual do sidebar desktop em viewport desktop autenticado. O QA mobile atual confirmou drawer legível, hierarquia da página, filtros e tabelas roláveis horizontalmente.
- Conferir o XLSX no Excel/LibreOffice e decidir se os gráficos incorporados como imagens PNG devem futuramente ser substituídos por gráficos nativos editáveis.
- Tornar a RPC de listagem do relatório uma projeção estreita (sem descrição/mídia) e decidir estratégia de geração streaming para catálogo maior.
- Rever uso de `notFound()` como sinal de 403 e o advisory de UUID no grafo de desenvolvimento.
- Ativar métricas de comportamento somente depois da decisão formal de consentimento e retenção.

## Segurança, consultas e imagens

- O snapshot do dashboard usa uma RPC agregada: não há consulta por card/produto. A página não assina imagens nem faz hotlink.
- O serviço Analytics é server-only, valida formato dos dados e sanitiza mensagens de erro. Não usa `SUPABASE_SECRET_KEY` nem service-role.
- A inspeção do código Analytics/client não encontrou referências a variáveis privilegiadas; `.env.local` está ignorado pelo Git. Após o build, os chunks do cliente foram verificados sem imprimir conteúdo secreto e não continham padrões `sb_secret_*`, `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`.
- A RPC não alterou grants/RLS das tabelas de catálogo. A consulta autorizada ao TEST confirmou contagens; Security/Performance Advisors pós-migration retornaram os mesmos achados da linha de base, sem finding novo atribuído à feature.

## Evidência de validação

| Verificação                             | Resultado                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                     | PASS                                                                                                             |
| `npm run lint`                          | PASS — 0 erros, 2 avisos antigos de `<img>`                                                                      |
| `npm run format:check` global           | FAIL — 90 arquivos históricos/preexistentes; sem formatação em massa                                             |
| Prettier nos arquivos de código tocados | PASS                                                                                                             |
| Testes do serviço Analytics             | 14/14 PASS                                                                                                       |
| Testes XLSX/API                         | 14/14 PASS                                                                                                       |
| Testes focados de serviço + export      | 28/28 PASS, incluindo regressão de `NULL` no XLSX                                                                |
| E2E local completo                      | 32/32 PASS — executado antes do ajuste CSS mobile-only, sem mudança de lógica                                    |
| `npm run build`                         | PASS — rotas admin/API geradas                                                                                   |
| `npm audit --omit=dev`                  | PASS — 0 vulnerabilidades                                                                                        |
| `git diff --check`                      | PASS                                                                                                             |
| pgTAP Analytics no Supabase TEST        | 63/63 PASS em transação com `ROLLBACK`                                                                           |
| pgTAP variantes ativas no Supabase TEST | 8/8 PASS; red proof falhou antes e verde passou depois da migration                                              |
| Admin visual autenticado                | PARTIAL — QA mobile anterior; desktop bloqueado pela política de acesso ao `localhost:3105`; sem captura desktop |
| XLSX real pela rota autenticada         | PASS — arquivo real baixado, 6 abas/tabelas e totais do snapshot conferidos                                      |
| XLSX OOXML e valores                    | PASS — `35` é referência a string vazia; estilos 0–17; dados SQL vs XLSX 71/71 sem divergência                   |
| RPC administrativa reexecutada          | BLOCKED — conector SQL sem sessão admin retorna `forbidden`; projeção instalada e consulta fonte verificadas     |
| XLSX visual em Excel/LibreOffice        | NÃO VERIFICADO — sem visualizador nativo disponível                                                              |

## Limites da operação

`VERCEL_TOUCHED=NO` · `VERCEL_DEPLOYED=NO` · `VERCEL_ENV_CHANGED=NO`  
`PUSH=NO` · `SUPABASE_TARGET=TEST_ONLY` · `MFA_CHANGED=NO` · `CUSTOMER_ROWS_CHANGED=NO`  
`BUSINESS_ROWS_CHANGED=NO` · `PGTAP_FIXTURE_ROWS_REMAINING=0` · `SEQUENCE_GAPS_POSSIBLE=YES`

## Gates solicitados

```text
ADMIN_VISUAL_QA=PARTIAL_MOBILE_DESKTOP_BLOCKED_BROWSER_POLICY
SIDEBAR_DESKTOP=BLOCKED_BROWSER_POLICY_NO_CAPTURE
SIDEBAR_MOBILE=PASS_DRAWER_AUTHENTICATED
ANALYTICS_FILTER=PASS_SOFAS_14_PRODUCTS_32_VARIANTS
MOBILE_HEADER_CONTRAST=PASS_AFTER_SCOPED_FIX
ANALYTICS_FASE_2=PENDING_ORDERS_FREIGHT_CHECKOUT_PAYMENT
ANALYTICS_DATA_VALIDATED=PASS
PRODUCT_STATUS_RECONCILED=PASS_WITH_LEDGER_DISCREPANCY_DOCUMENTED
XLSX_EXPORT_VALIDATED=PASS_REAL_FILE_6_SHEETS_6_TABLES
XLSX_REAL_FILE=PASS
XLSX_VISUAL_QA=OOXML_CONFIRMED; NATIVE_EXCEL_NOT_AVAILABLE
XLSX_SOURCE_VALUES_REVIEW=PASS_71_OF_71_SQL_MATCH_NULLS_BLANK
XLSX_35_DIAGNOSIS=SHARED_STRING_INDEX_35_REFERENCES_EMPTY_STRING; ARTIFACT_TOOL_MISREAD
ADMIN_RPC_EXECUTION=BLOCKED_NO_ADMIN_SESSION_IN_SQL_CONNECTOR
ADMIN_SCREENSHOTS=DESKTOP_NOT_CAPTURED_BROWSER_POLICY_BLOCK
PGTAP_ANALYTICS=PASS_63_OF_63
PGTAP_VARIANT_ACTIVITY=PASS_8_OF_8
E2E=PASS_32_OF_32
TYPECHECK=PASS
LINT=PASS_0_ERRORS_2_PREEXISTING_WARNINGS
FORMAT=FAIL_90_PREEXISTING_FILES
BUILD=PASS
SECURITY_REVIEW=PASS_WITH_RESIDUAL_RISKS_DOCUMENTED
BUGS_FOUND=1_VARIANT_READINESS_1_MOBILE_ANALYTICS_HEADER; XLSX_35_WAS_FALSE_POSITIVE
BUGS_FIXED=1_VARIANT_READINESS_1_MOBILE_ANALYTICS_HEADER; XLSX_GENERATOR_UNCHANGED
FINAL_COMMIT=NONE_WORKTREE_PRESERVED
VERCEL_TOUCHED=NO
PUSHED=NO
DEPLOYED=NO
```
