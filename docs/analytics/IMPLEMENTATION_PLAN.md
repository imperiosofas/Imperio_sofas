# Plano de implementação — Analytics e painel administrativo

Data do inventário: 15/10/2026  
Checkout: `integration/final-hardening`, HEAD `72a0ad0`  
Escopo: checkout local e projeto Supabase TEST `qsafyqsskwbjnailgoev` somente. Vercel, deploy, push, MFA e pagamentos permanecem fora.

## Estado encontrado

- O repositório correto é `C:\Users\Thiago\Documents\Codex\2026-09-03\files-pasted-by-the-user-estou\outputs\imperio-sofas-vale-final-hardening`; o diretório inicial da sessão (`Documents\ChatGPT\ecommerce`) contém apenas evidências/artefatos não rastreados e não é o app.
- O checkout já contém alterações locais de hardening e correção de runtime, inclusive mudanças em admin, catálogo, configuração e migrations. Nenhuma delas será descartada, globalmente formatada ou absorvida em commit de baseline por esta tarefa.
- Administração está protegida no layout e nas operações por `requireCatalogAdmin`; `private.is_catalog_admin()` e RLS são as fontes de autorização. MFA obrigatório está pausado por decisão do proprietário e não será alterado.
- Existem categorias, produtos, variantes, estoque e favoritos/carrinhos persistidos; não há implementação de pedidos, pagamento, frete transacional ou eventos first-party. A sidebar é `src/features/admin/AdminShell.tsx` e existem rotas de produtos, avaliações e limpeza de Storage.
- Não há rotas/docs/dependências de Analytics ou exportação XLSX. Não foi localizado mecanismo de consentimento de analytics nem política operacional de retenção/base legal para tracking comportamental.
- A fonte atual permite métricas de estado do catálogo/estoque e, após confirmação de acesso/consistência, totais de favoritos/carrinho. Não permite receita, vendas, conversão de compra, abandono transacional, margem, frete ou séries históricas de interesse.
- Tracking comportamental fica desligado e classificado `BLOCKED_OWNER` até que a política de privacidade/consentimento e retenção seja definida e a experiência de consentimento seja aprovada. Nenhum evento de navegação será coletado silenciosamente. As telas devem distinguir “Ainda sem dados” de zero comprovado.
- Linha de base remota lida antes de DDL: projeto `imperiosofas`, ref `qsafyqsskwbjnailgoev`, `ACTIVE_HEALTHY`; 26 migrations até `20261014145321`; 7 categorias, 51 produtos, 71 variantes, 71 linhas de inventário, 107 linhas de mídia; bucket `catalog-images` continua privado. Nenhuma linha de cliente foi lida. Docker não está instalado; Supabase CLI local é `2.117.0`.

## Contrato inicial de métricas

1. Métricas operacionais são snapshots consultados no servidor a partir do Supabase TEST; exatidão de estoque só aparece no admin.
2. O RPC de Analytics, se necessário após revisão, será `SECURITY INVOKER`, validará `private.is_catalog_admin()` e receberá `EXECUTE` apenas por `authenticated`; não usará service key nem claims de `user_metadata`.
3. Produtos/variantes/estoque são agregados na mesma chamada limitada; sem query por card, sem `COUNT(*)` em render de cliente e sem leitura de eventos inexistentes.
4. Snapshot atual não aceita filtros de período como se criassem histórico. Comparações só existem para métricas temporais que venham de fonte persistida válida.
5. Busca, PDP views, favoritos/cart events e comportamento sem consentimento apropriado: estado “Ainda sem dados”/“Medição pendente”; pedidos/receita: “Disponível após ativação de pedidos”.
6. XLSX reutiliza exatamente o contrato e filtros do backend; sanitiza formula injection e exclui PII, segredos e signed URLs.

## Propostas visuais consideradas

- **A — Editorial carvão:** navegação sólida carvão/navy, conteúdo ivory, tipografia editorial e acento dourado raro. Melhor continuidade com a marca e hierarquia visual desejada.
- **B — Operação clara:** navegação clara e painel ivory/cinza. Mais convencional, menos distinto e com menor contraste de identidade entre navegação e conteúdo.
- **C — Compacta utilitária:** sidebar estreita com ícones e muito conteúdo por viewport. Economiza espaço, mas enfraquece rótulos e acessibilidade em uso diário.

Escolha: **A**, por coerência com o pedido de varejo premium/editorial e por separar claramente navegação de trabalho. Não haverá sidebar colapsável nesta entrega inicial; evita tooltip/estado persistido e reduz risco de layout instável. Mobile/tablet usam drawer acessível, sem reutilizar a navegação do cliente.

## Ondas, gates e file ownership

| Onda                         | Trabalho                                                                        | Gate antes da integração                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0 — Inventário/contrato      | Este plano, matriz de conflitos, dicionário preliminar e confirmação de limites | Arquivos e APIs proprietários documentados; alterações locais preservadas                |
| 1 — Dados + serviços + shell | RPC/agregação e pgTAP; serviço/tipos server-only; sidebar separada              | Auth admin no RPC, contratos tipados, testes direcionados, sem tracking silencioso       |
| 2 — UI + export              | Dashboard e páginas analíticas; XLSX server-side com mesmos dados               | Estados vazios honestos, workbook válido, XLSX usa o mesmo backend, revisão independente |
| 3 — QA + segurança           | E2E, acessibilidade, tamanhos 360/390/768/1024/1440, revisão de RLS/privacidade | Sem regressão nas rotas admin/storefront; fixtures removidas; sem secretos no bundle     |
| 4 — Integração final         | Integrator revisa e integra somente mudanças aprovadas na branch local          | typecheck/lint/format tocado/build/E2E e veredito final; sem push/deploy                 |

Cada implementador trabalha em branch/worktree isolada. Revisores não editam a implementação revisada. A matriz detalhada e os arquivos compartilhados estão em `CONFLICT_MATRIX.md`.

## Validações

- Executar `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `git diff --check`, testes focados e E2E completo quando implementações estiverem integradas.
- Se `format:check` falhar nos arquivos históricos, comparar contra baseline limpo/escopo tocado; não formatar globalmente.
- pgTAP depende do ambiente local/Docker ou harness disponível. Falha de disponibilidade é `BLOCKED_ENVIRONMENT`, não `FAIL`.
- Toda escrita remota fica limitada ao Supabase TEST: confirmar project ref, inventariar migrations/tabelas e contagens antes, criar migração aditiva idempotente, registrar plano de rollback e checar estado pós-operação. Nunca resetar banco nem apagar dados de negócio.
- Supabase changelog consultado nesta sessão: nenhuma breaking change recente aplicável ao uso de RPC/Postgres/RLS proposto; o alerta de 12/10/2026 é somente sobre suites de cifras TLS 1.2 e não altera o desenho da aplicação ([changelog oficial](https://supabase.com/changelog.md)).
- Rollback da única RPC de snapshot, se a migração for aplicada ao TEST e a revisão/validação falhar: `DROP FUNCTION IF EXISTS public.admin_get_analytics_snapshot(uuid)`. A migração não deve gravar/alterar linhas existentes; primeiro verificar a assinatura exata gerada e executar apenas a reversão aditiva correspondente, sem reset.

## Limitações e dependências do proprietário

- **BLOCKED_OWNER — consentimento/privacidade:** aprovar base legal, texto/política, retenção, mecanismo de opt-in/opt-out e uso de busca/identificador pseudônimo antes de instrumentar comportamento.
- **DEFERRED — Analytics Fase 2:** métricas financeiras aguardam pedidos, checkout, pagamentos, reembolsos e frete persistidos e homologados.
- Se uma sessão administrativa autenticada ou uma ferramenta de teste não estiver disponível, registrar o teste como bloqueado, sem automatizar nem ler credenciais pessoais.
