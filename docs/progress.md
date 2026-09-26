# Progresso — Império Sofás

## Estado atual

**Baseline:** landing page Vite/React/TypeScript.

**Situação da migração:** fundação Next executável; migration inicial do catálogo aplicada ao projeto Supabase remoto `imperiosofas` (versão `20260924155912`). As cinco tabelas têm RLS; o bucket de imagens é privado. O banco local ainda não foi iniciado porque Docker não está instalado neste ambiente. A aplicação local ainda não tem suas variáveis Supabase e o seed comercial não foi aplicado. Carrinho funcional, checkout e integrações seguem como próximos incrementos.

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

| Incremento                    | Estado                                  | Evidência/observação                                                                                                                                              |
| ----------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundação Next                 | Executável                              | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/`                                                |
| Identidade e landing imersiva | Revisada para validação visual          | Hero editorial, três cenas sticky com fotos reais, movimento vinculado à rolagem e ritmo responsivo; aguarda feedback visual                                      |
| Navegação landing/loja        | Integrada para validação visual         | Cabeçalho desktop com Início/Loja/Conta, bottom navigation responsiva, atalhos para loja/categoria e rota de sacola informativa; sem carrinho funcional           |
| Catálogo público persistente  | Schema remoto aplicado; dados pendentes | Migration, RLS, RPC e bucket privado aplicados no projeto remoto; seed ainda não executado, sem produto vendável; Docker não instalado neste ambiente             |
| Carrinho e frete              | Não iniciado                            | `/carrinho` apresenta estado informativo; não há itens, frete ou regras server-side                                                                               |
| Conta e autenticação          | Implementado; ativação pendente         | `/conta`: login, cadastro de cliente, confirmação/recuperação por token hash, sessão SSR e TOTP opt-in; faltam projeto, templates de e-mail, SMTP e validação E2E |
| Checkout e reserva            | Não iniciado                            | Não há pedidos, estoque ou transações                                                                                                                             |
| Mercado Pago                  | Bloqueado                               | Sem credenciais homologadas                                                                                                                                       |
| Admin e operação              | Não iniciado                            | Não há autorização, MFA ou painel                                                                                                                                 |
| Bling/NF-e                    | Bloqueado                               | Sem credenciais, parâmetros fiscais ou certificado homologado                                                                                                     |
| LGPD, relatórios e go-live    | Não iniciado/bloqueado                  | Dependem de dados, políticas e operação aprovados                                                                                                                 |

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

### Refinamento de autenticação e primeiro schema remoto — 24/09/2026

- Login, cadastro e MFA agora compartilham o mesmo painel; uma cobertura visual curta oculta a troca de estado, com eixo responsivo e respeito a movimento reduzido. A página pode rolar em telas pequenas, e os campos de cadastro permanecem em coluna única.
- A entrada TOTP foi compartilhada com a tela de segurança, mantém os dígitos ao falhar e usa animação de sucesso apenas depois da confirmação do Supabase.
- Migration de catálogo aplicada ao projeto Supabase `imperiosofas`, ref `qsafyqsskwbjnailgoev`, versão registrada `20260924155912`; arquivo versionado renomeado para corresponder à versão remota.
- A aplicação ainda não está conectada em runtime: faltam variáveis locais e a configuração Auth/e-mail. A migration não publicou produtos nem inseriu seed; operações de checkout, administração e venda real continuam indisponíveis.
- Advisors remotos apontaram o aviso anterior em `public.rls_auto_enable`, alertas de execução autenticada para RPCs do catálogo (funções intencionais e filtradas) e recomendação informativa de índice em `product_media.variant_id`.
- RLS está habilitado sem policies nas tabelas do catálogo de propósito: papéis client não recebem acesso SQL direto; a vitrine usa somente as RPCs de leitura filtrada. QA manual em desktop `1234 × 712` conferiu login/cadastro, foco e rolagem; os viewports móveis ainda faltam neste ciclo.

### Refinamento visual de autenticação — 24/09/2026

- `/conta` removeu o kicker superior do formulário e os rótulos redundantes de login/cadastro; também removeu os dois textos pequenos que ocupavam o rodapé da foto.
- A composição desktop alterna por estado: login com formulário à esquerda e foto à direita; cadastro inverte os painéis. A cobertura animada existente foi preservada; a foto Berlim/Maximo faz crossfade leve junto da mudança.
- O painel usa fotos locais de produtos da mesma linguagem visual, overlay mais sutil e espaçamento sem altura mínima artificial no estágio do formulário. O foco automático não desloca/corta o cartão em desktop; a rolagem assistida continua restrita a viewports compactos.
- Fluxos, validações, sessão, confirmação, recuperação e MFA/TOTP Supabase não foram alterados.
- Typecheck, lint (0 erros; 3 avisos preexistentes de `<img>`), `format:check` e build passaram. QA visual manual da transição e das duas composições concluído em desktop `1234 × 712`.
- QA mobile `320–430 px` ainda pendente: esta sessão do navegador não disponibilizou controle de viewport/emulação de dispositivo. Não houve teste em aparelho físico nem submissão real aos fluxos Supabase.

### Ergonomia mobile de autenticação — 24/09/2026

- Removida também a faixa externa “Atendimento próximo, em cada etapa. Conheça a coleção” da rota `/conta`.
- No mobile, o painel de imagem ficou compacto (108 px) e sem slogan sobreposto; o formulário ganha prioridade vertical. A página usa `100dvh`, rolagem interna e safe-area insets para aproveitar melhor a tela e tolerar o teclado virtual.
- Inputs passaram a 52 px de altura e 16 px de fonte; labels/helpers ficaram maiores e mais espaçados; CTA, toggle de senha, links de alternância/recuperação e retorno foram ampliados para 48 px ou mais.
- Teclas móveis indicam avançar/ir; email mantém `type=email`, autocomplete e desativação de capitalização. O viewport declara `viewport-fit=cover` e `interactive-widget=resizes-content`, sem bloquear zoom do usuário.
- A lógica de autenticação não mudou. A sessão atual não dispõe de emulação de device/viewport; portanto os tamanhos `320`, `360`, `375`, `390` e `430 px`, teclado virtual e overflow horizontal precisam de validação visual em navegador emulado ou aparelho antes de serem considerados homologados.

### Estabilidade e motion no fluxo mobile — 24/09/2026

- Em `/conta`, login e cadastro agora compartilham uma stage fixa; cada formulário (incluindo seu link de alternância) ocupa a mesma camada absoluta. A stage tem `33rem` e a altura total do cartão não muda na troca. O painel visual compacto mantém 108 px.
- No breakpoint mobile, a troca de formulário percorre diagonal/vertical com `transform` e `opacity`, sincronizada à cobertura existente. As fotos Berlim e Maximo cruzam em direções opostas com deslocamento/escala sutis. A composição e o eixo da animação desktop não foram alterados.
- O foco pós-alternância vai ao título com `preventScroll`, sem abrir teclado nem reposicionar a página. Recuperação, confirmação, MFA, validações e chamadas Supabase seguem sem alterações; somente o par login/cadastro usa o modo sobreposto.
- As órbitas decorativas foram ocultadas somente no mobile; `body` deixa de impor `min-width:320px` apenas quando `/conta` está presente. Isso removeu a rolagem residual e o overflow horizontal em viewport de 320 px.
- No navegador com overrides de viewport, os ciclos login→cadastro→login foram executados em `320`, `360`, `375`, `390` e `430 px`: cartão manteve `853,98 px`, topo `65,59 px`, rolagem interna `0` e sem overflow horizontal. Inputs ficaram com `52 px`/`16 px`; CTA `52 px`; toggle/alternância `48 × 48 px`.
- O foco do e-mail foi testado nas mesmas larguras com viewport de altura reduzida para `420 px` (simulação de espaço após teclado): campo focado permaneceu visível, fonte de `16 px` e sem overflow. A sessão não oferece teclado virtual nativo; QA em aparelho real continua recomendável.
- Typecheck, lint, formatação e build executados após o ajuste final; lint mantém apenas os três avisos antigos de `<img>` em outros componentes. Interação desktop conferida em `1234 × 900`; layout segue as áreas `form visual`/`visual form` existentes.

### Navegação inferior global — 24/09/2026

- No mobile/tablet (até 1023 px), foi adicionada uma bottom navigation fixa e compacta para `/`, `/loja` e `/conta`, com ícones Lucide, indicador circular dourado compartilhado por `layoutId` do Framer Motion e movimento discreto do ícone/label ativo. Movimento reduzido é respeitado.
- O estado Loja cobre `/loja`, `/loja/*` e `/produto/*`; Conta cobre `/conta/*` e `/auth/*`; Início só corresponde à raiz. Os destinos usam `Link` do Next para navegação client-side.
- Em desktop (a partir de 1024 px), a barra inferior some e o header exibe Início, Loja e Conta. No mobile, o header de Conta fica oculto para preservar a composição de autenticação; o header público mantém marca e sacola, sem hamburger.
- Espaço inferior é reservado no documento; a barra respeita safe-area inferior e os links têm alvo visual de pelo menos 48 px. Autenticação, catálogo, Supabase e seções da landing não foram alterados.
- O vídeo local `p.mp4` não pôde ser aberto pelo browser devido à política de acesso a arquivos locais; o motion foi implementado conforme a descrição detalhada fornecida no pedido.
- QA no browser conectado: `/`, `/loja`, `/loja/sofas` e `/conta` renderizaram com navegação superior e seleção visual correta nos estados observados. `/produto/berlim` mostrou o 404 customizado (não há produto publicado no ambiente), mantendo o header global.
- `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; lint mantém três avisos antigos de `<img>`. Não foi possível emular o viewport no browser disponível (`agent-browser` ausente e browser conectado sem controle de viewport), então QA visual em 320–430 px e tablet permanece pendente apesar das regras CSS responsivas e safe-area implementadas.

### Auditoria responsiva, MFA e ferramentas locais — 24/09/2026

- A seleção entre header e bottom nav agora usa capacidade do ponteiro primário: mouse/trackpad mantém o header mesmo com viewport estreito; touch/coarse mantém bottom nav inclusive em tablet landscape. Indicador de desenvolvimento ocultado por `devIndicators: false` (opção oficial Next 16, sem esconder erros reais).
- Criado `getAccountAccess()` server-only: exige claims válidas e verifica AAL antes de renderizar conta, segurança ou redefinição; sessão AAL1 quando AAL2 é esperado entra no desafio TOTP antes da área protegida.
- Estado remoto comparado antes da migration: a migration inicial local coincidiu com a aplicada. Migration adicional `20260924194857_lock_internal_rls_event_trigger` aplicada pelo MCP Supabase; revoga execução pública de `public.rls_auto_enable()` e indexa `product_media.variant_id`. Sem reset nem alteração manual fora do histórico.
- Security Advisor após migration: o finding da função interna deixou de aparecer. Permanecem duas RPCs `SECURITY DEFINER` públicas do catálogo, filtradas para dados publicados/vendáveis e aprovadas como públicas deliberadas; RLS sem policies permanece fechado por desenho, com grants diretos revogados. Performance Advisor reporta índices ainda não usados em catálogo sem tráfego (incluindo o novo); não foram removidos.
- Ferramentas, variações de browser e resultados executados serão detalhados em `docs/tooling.md` e `docs/test-evidence.md`. MFA real, SMTP, CAPTCHA e sessão autenticada dependem de configuração/conta de teste; não se declaram homologados sem isso.
- Playwright E2E passou em 10/10 testes, incluindo bottom nav, produto e alternância de autenticação nas larguras `320`, `360`, `375`, `390` e `430 px`; axe não encontrou violações nos componentes de navegação/autenticação. O scan também sinalizou contraste na landing (6 nós) e loja (1 nó), fora deste escopo.
- `typecheck`, `format:check`, build e lint passaram; lint conserva somente três avisos antigos de `<img>`. Semgrep (74 regras), Gitleaks (código e 27 commits), Trivy (manifesto/dependências) não encontraram findings; `npm audit --omit=dev` reporta zero vulnerabilidades. `npm audit` completo aponta findings apenas no toolchain dev transitivo do Lighthouse CI (10: 7 high, 1 moderate, 2 low), sem mitigação forçada.
- Lighthouse completou a coleta local da landing, mas encerrou com `EPERM` ao apagar o perfil temporário do Chrome no Windows; não há baseline CI validada. Knip reporta possíveis arquivos/exports/deps sem uso, revisados e mantidos quando usados por scripts ou dependências dinâmicas. O scan DAST com ZAP não foi executado.

### Reconstrução home e dock — 26/09/2026

- Substituídos hero isolado e capítulos empilhados por uma única cena sticky com três momentos sobrepostos: apresentação, detalhe do Belize e transformação da mídia em coleção. `useScroll` e MotionValues controlam escala, deslocamento, recorte e opacidade; mobile tem percurso mais curto que desktop. Galeria da home integrada ao final da cena; demais seções preservadas.
- Dock reconstruído com uma única peça ativa transportando o ícone, concavidade SVG na mesma posição horizontal, mola amortecida e labels ligados à proximidade. Correção de inicialização encontrada no navegador; sem alterar roteamento/auth/dados da loja.
- Referências e gravações de scroll/navigation revisadas. Dimensões, métricas locais, ressalvas e evidências estão em `docs/test-evidence.md`. Aprovação estética pelo proprietário e teste em aparelhos físicos permanecem pendentes.
- Alterações anteriores de autenticação e outras áreas permanecem separadas deste escopo; esta rodada não configura serviços, migrações ou checkout.
