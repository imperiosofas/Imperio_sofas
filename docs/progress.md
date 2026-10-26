# Progresso — Império Sofás

## Estado atual

**Baseline histórico:** landing page Vite/React/TypeScript; a aplicação atual usa Next.js 16 e mantém a landing em `/`.

**Situação da migração:** catálogo, administração, autenticação e interações de comércio estão versionados em migrations e aplicados ao Supabase remoto `imperiosofas`; banco local ainda não foi iniciado porque Docker não está instalado. Existe um produto publicado no catálogo remoto. O carrinho persistente foi implementado, mas checkout e venda real continuam desabilitados.

**Integrações:** Supabase Auth/schema estão conectados, mas fluxo ponta a ponta não homologado. Mercado Pago, Bling, envio de Auth via Resend, Vercel/domínio e produção comercial continuam sem homologação.

**Estado atual:** MFA/AAL2 administrativo temporariamente desativado por decisão do proprietário; o acesso permanece protegido por sessão e membership via guard server-side e RLS. Log privado de auditoria segue com RLS. Nenhum produto ou dado comercial de teste permaneceu no banco; nenhuma venda foi ativada.

## Evidências do baseline

- `package.json` usa Next.js 16.3.6, React 19 e scripts `dev`, `build`, `start`, `lint`, `format:check`, `typecheck` e `check:production`.
- `src/App.tsx` monta uma página institucional única.
- `src/data/products.ts` contém cinco produtos para apresentação.
- `src/config.ts` contém dados de loja e WhatsApp.
- O baseline original não possuía `src/app`, migrations, APIs comerciais, autenticação, testes automatizados ou workflows CI.
- A fundação atual está em `src/app`, `next.config.ts`, `next-env.d.ts`, `src/lib/env/server.ts`, `.github/` e `scripts/check-production-ready.mjs`; o catálogo read-only está em `src/features/catalog`, mas ainda não há checkout ou integração homologada.
- Existem assets locais de marca, loja e produtos, incluindo versões tratadas por IA e originais preservados.

## Estado por incremento

| Incremento                    | Estado                                | Evidência/observação                                                                                                                                    |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundação Next                 | Executável                            | `npm run typecheck`, `npm run lint`, `npm run format:check` e `npm run build` passaram; a LP foi preservada em `/`                                      |
| Identidade e landing imersiva | Revisada para validação visual        | Hero editorial, três cenas sticky com fotos reais, movimento vinculado à rolagem e ritmo responsivo; aguarda feedback visual                            |
| Navegação landing/loja        | Integrada para validação visual       | Cabeçalho desktop com Início/Loja/Conta, bottom navigation responsiva, atalhos para loja/categoria e rota de sacola informativa; sem carrinho funcional |
| Catálogo público persistente  | Implementado; não homologado          | Schema, RPCs, RLS e bucket privado; remoto está vazio de produtos/variantes/estoque/mídia; preço/SKU/estoque comercial precisam de confirmação          |
| Carrinho e frete              | Carrinho implementado; frete pendente | `/carrinho` persiste itens por usuário/variante, lê preço e disponibilidade do banco; sem checkout, reserva, frete ou pedido                            |
| Conta e autenticação          | Implementado; E2E parcial pendente    | Login/cadastro, confirmação/recuperação, sessão SSR e TOTP existem; envio de MFA por e-mail teve 403 e sessão Auth real segue pendente                  |
| Checkout e reserva            | Não iniciado                          | Não há pedidos, estoque ou transações                                                                                                                   |
| Mercado Pago                  | Bloqueado                             | Sem credenciais homologadas                                                                                                                             |
| Admin e operação              | Primeiro slice + Analytics Fase 1    | `/admin/produtos`, dashboard `/admin/analytics`, relatórios XLSX em `/admin/relatorios`; guards mantidos. Analytics de pedidos, receita e comportamento não está ativado. |
| Bling/NF-e                    | Bloqueado                             | Sem credenciais, parâmetros fiscais ou certificado homologado                                                                                           |
| LGPD, relatórios e go-live    | Não iniciado/bloqueado                | Dependem de dados, políticas e operação aprovados                                                                                                       |

Na revisão visual de 23/09/2026, a seção de história deixou de usar o cartão de produto fixo no desktop e a lista estática no celular. As três cenas agora compartilham a mesma estrutura de tela cheia, com foto, texto e navegação contextual; a rolagem permanece nativa. Diferenciais e avaliações foram reorganizados para manter o ritmo editorial depois da narrativa. O filtro de ruído do hero e o blur do cabeçalho foram retirados para reduzir composição visual durante o scroll. O ajuste de escala das fotos usa CSS scroll-driven animation como aprimoramento progressivo; a estrutura sticky continua funcional quando esse recurso não existe.

## Próximo incremento recomendado

Coletar dados comerciais confirmados por variante (preço final, SKU, medidas/cores disponíveis, estoque e condição de parcelamento) e aprovar as fotos para uso comercial. O administrador deve configurar/verificar TOTP; então executar a homologação do editor, upload Storage, rascunho, publicação, loja/PDP e despublicação com a conta real. **Não iniciar carrinho até todos os critérios da Fase 1 passarem.** Checkout, frete e pagamento permanecem fora deste incremento.

## Critérios de progresso

Cada incremento deve registrar:

- arquivos e migrations efetivamente alterados;
- comandos executados e resultado;
- testes determinísticos, sandbox ou produção autorizada, sem misturar evidências;
- bloqueios externos e responsável a definir;
- riscos de rollback e impacto no deploy atual.

Até que essas evidências existam, o projeto deve ser descrito como uma aplicação em migração incremental, não como e-commerce pronto ou homologado.

## Homologação de catálogo e gate do carrinho — 02/10/2026

- Auditoria remota confirmou 1 categoria ativa, 0 produtos, 0 variantes, 0 inventário, 0 mídias e 1 membership de administrador. `catalog-images` é privado. Não existe branch de staging.
- As oito migrations previamente existentes estavam alinhadas; foi aplicada e alinhada localmente a `20261002164104_restore_catalog_admin_aal2_and_audit_rls`.
- A migration restaurou AAL2 no helper RLS do admin e habilitou RLS em `private.catalog_admin_audit`. Um INSERT temporário feito como `authenticated`, com membership/AAL2 simulados, executou o trigger com RLS ligado; verificação interna encontrou o log e a transação foi revertida. Nenhum produto de teste permaneceu.
- `requireCatalogAdmin` agora exige assurance `aal2` antes de verificar membership. A sessão AAL1 é encaminhada ao desafio TOTP de `/conta`, preservando destino interno; cadastro de fator ainda depende de ação do administrador.
- As fotos originais e nomes de cinco modelos existem no projeto. Larguras e textos de parcela foram transcritos dos arquivos, mas o banco não tem preço à vista confirmado, SKU/variante aprovada nem estoque. Nenhum dado comercial foi inventado nem publicado.
- Gate Fase 1: `CREATE_PRODUCT`, `VARIANTS`, `PRICING`, `INVENTORY`, `MEDIA`, `DRAFT_VISIBILITY`, `PUBLISH`, `STOREFRONT`, `PDP`, `UNPUBLISH` e `ADMIN_SECURITY` seguem pendentes de homologação real. RLS/helper e auditoria foram corrigidos/verificados por teste transacional; login/TOTP e upload visual reais não foram executados.
- Fase 2 (carrinho) **não iniciada**, conforme gate obrigatório. `/carrinho` permanece página informativa; não há schema ou APIs de carrinho.
- Próximo passo necessário: proprietário confirmar os dados comerciais por variante e usar a conta admin para configurar/verificar TOTP e aprovar imagem comercial. Em seguida, executar a homologação de rascunho/publicação/despublicação antes de qualquer schema de carrinho.

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

### Refatoração visual em avaliação — landing, dock e autenticação — 25/09/2026

- A crítica visual do proprietário interrompeu a validação final. Landing com scroll e bottom nav são a prioridade desta rodada; somente a interface da autenticação foi testada no cenário local sem configuração, e sua estética ainda não foi aprovada. Não houve commit, push ou deploy deste incremento.
- Landing: cena fotográfica única entre hero e Belize/Berlim/Dallas; imagens reais locais; capítulos sticky para manter texto/produto juntos; revelação horizontal vinculada ao scroll substitui crossfade com dupla exposição. No mobile, foto do hero foi reenquadrada, segundo CTA retirado do primeiro viewport e conteúdo elevado acima do dock. Movimento reduzido mantém fotos estáticas legíveis.
- Dock: bead e concavidade continuam ligados ao mesmo MotionValue, com placa mais estreita (máximo 352 px), 70 px de altura, borda/brilho reduzidos e label ativo de 12 px. Ativo por rota mantém Loja nos produtos.
- Botão de contato flutuante não sobrepõe a experiência móvel; contato permanece nos cards de produto e nas seções de atendimento. No desktop, ícone flutuante aparece após a narrativa.
- Pesquisa adicional registrada em `docs/design-research.md`, com Pinterest, Maiden Home, Awwwards e documentação oficial Motion. O Pinterest ofereceu referência visual por resultado indexado, mas o pin completo não foi acessível; nenhuma imagem externa foi incorporada.
- Próxima decisão visual: revisão do proprietário da landing e dock em dispositivo real. O ajuste de autenticação, a configuração Supabase runtime, venda/checkout e publicação não estão concluídos por esta rodada.

### Reconstrução home e dock — 26/09/2026

- Substituídos hero isolado e capítulos empilhados por uma única cena sticky com três momentos sobrepostos: apresentação, detalhe do Belize e transformação da mídia em coleção. `useScroll` e MotionValues controlam escala, deslocamento, recorte e opacidade; mobile tem percurso mais curto que desktop. Galeria da home integrada ao final da cena; demais seções preservadas.
- Dock reconstruído com uma única peça ativa transportando o ícone, concavidade SVG na mesma posição horizontal, mola amortecida e labels ligados à proximidade. Correção de inicialização encontrada no navegador; sem alterar roteamento/auth/dados da loja.
- Referências e gravações de scroll/navigation revisadas. Dimensões, métricas locais, ressalvas e evidências estão em `docs/test-evidence.md`. Aprovação estética pelo proprietário e teste em aparelhos físicos permanecem pendentes.
- Alterações anteriores de autenticação e outras áreas permanecem separadas deste escopo; esta rodada não configura serviços, migrações ou checkout.

### Motion entre cenas, dock edge-to-edge e carrinho protegido — 26/09/2026

- Landing: a cena sticky principal permanece como narrativa de hero, produto e coleção. As seções de diferenciais, avaliações, localização e CTA agora entram com `useScroll`/`useTransform`, um push curto e overlap vertical discreto; não foram adicionadas novas cenas sticky extensas. `prefers-reduced-motion` remove esse movimento macro.
- Navegação: quatro destinos em ordem (Início, Loja, Carrinho, Conta); o dock usa um único bead/notch animado compartilhado. Em telas touch menores que 1200 px ocupa a borda de ponta a ponta, sem margens externas, com safe-area interna e feedback de toque. Desktop com mouse/trackpad continua no header mesmo ao reduzir a janela.
- Acesso: `/carrinho` é dinâmico e protegido no servidor por `getClaims()` e assurance MFA. Sessão ausente retorna a `/conta?next=/carrinho`; MFA pendente apresenta challenge antes da rota. Após login, confirmação de e-mail e MFA, o destino seguro permite voltar ao carrinho. Destinos são allowlisted, não URLs arbitrárias. A área `/conta` mantém o gate atual. Carrinho/checkout continuam apenas informativos; pagamento não foi implementado.
- Verificações executadas: TypeScript, lint, format check, build e Playwright 15/15 no primeiro passe; lint manteve 2 avisos preexistentes de `<img>`. A suíte foi refinada depois para testar mouse em janela estreita versus tablet touch; esse último refinamento requer uma nova execução de navegador.
- Limites: sem credenciais/usuário Supabase de teste, não foi possível confirmar login real, challenge MFA e retorno com sessão. A tentativa de inspeção visual no navegador foi bloqueada pela política da superfície e não foi repetida por outro meio. Logo, movimento visual/performance desta rodada e aprovação estética estão pendentes; não fazer commit/push até reteste visual e aprovação.

### Restauração da landing histórica — 28/09/2026

- Fonte de restauração confirmada no Git: `a15bf70d02442bd5e555ca43f74d5446dd497a04`; a adaptação inicial Next `802083468186a99513d6f9777041e0256ef92992` contém a mesma implementação de apresentação. A mudança de narrativa atual começa em `7310b669c6d2ea4ce5a06a5428402ac3a7efcf90`.
- Escopo: recuperar a landing original e seus efeitos/assets históricos; manter Next.js, rotas da loja, autenticação, Supabase, carrinho, MFA e bottom navigation. O checkout já estava com alterações locais antes desta tarefa; foram preservadas. Nenhum commit ou push foi autorizado.
- Implementação: Hero, diferenciais, carrossel, avaliações, localização e CTA voltaram à sequência histórica; Lenis, parallax e Reveal também foram restaurados. O header desktop e o dock atuais foram mantidos para continuar oferecendo acesso às rotas do e-commerce. A imagem do Hero usa as mesmas variantes locais via `next/image`/`picture`.
- Gates estáticos finais: `typecheck`, `lint`, `format:check` e `build` passaram. Lint mantém os dois avisos anteriores de `<img>` em StorePhoto e Catalog.
- Playwright: 15/16 passaram no passe completo; o teste restante foi corrigido para emular toque por viewport e passou isoladamente (1/1), junto das capturas e do scroll aos capítulos. Não foi executada uma segunda suíte completa unificada.
- Capturas locais Chromium: 390×8347 e 1440×6354 px, com lazy images carregadas e capítulos percorridos antes da captura. A evidência histórica de produção registrada anteriormente era 390×8302 e 1440×6003; o desktop local ainda difere em altura e requer comparação direta antes de declarar fidelidade visual total.
- O navegador do app recusou abrir o endereço local por política da superfície e a porta 3100 já estava ocupada; nenhum processo existente foi encerrado. Assim, a comparação visual lado a lado com produção e a revisão de console em navegador permanecem pendentes. Knip e `rg` confirmaram que `FloatingContact.tsx` não tem referências externas; mesmo assim, a remoção do arquivo rastreado foi bloqueada pela proteção de edição, então ele foi preservado.

### Motion e scrollytelling da landing — 28/09/2026

- O Hero recebeu entrada de H1 por palavras e um scrub curto da imagem, overlay e copy. Em touch, o scroll continua nativo e a seção inteira não fica pinada; o pin desktop só é ativado com ponteiro fino, preferência por motion habilitada e altura de viewport suficiente.
- A coleção preserva produtos, preços, links e imagens otimizadas. Swiper foi removido; mobile/tablet usam trilho de scroll-snap nativo, e desktop largo usa ScrollTrigger para pin e deslocamento horizontal. Controles de teclado setas aparecem no breakpoint intermediário.
- Motion fica separado por função: Framer Motion para microinterações/reveals já existentes e contato, GSAP/ScrollTrigger para narrativa e galeria, Lenis apenas no desktop com ticker GSAP compartilhado. Chunks GSAP/Lenis são dinâmicos; nenhuma sequência de quadros foi fabricada porque não há assets adequados.
- O botão flutuante de WhatsApp agora tem atração curta no desktop e pulso de brilho espaçado em touch; a posição existente sobre a bottom nav e safe-area foi mantida. `prefers-reduced-motion` desativa scrub, pin, Lenis e pulso; os controles do carrossel passam a rolar sem animação nessa preferência.
- `typecheck`, `lint`, `format:check` e `build` passaram. Lint mantém 2 avisos de `<img>` em `StorePhoto.tsx` e `Catalog.tsx`, sem erros.
- A suíte Playwright recebeu cobertura para 320, 360, 375, 390, 430 e 768 px e scroll nativo da galeria. Ela não foi executada nesta rodada: o acesso do browser local já havia sido negado pela política da superfície, sem contornar por outra ferramenta. Logo, gravação visual, console, medição de FPS/Lighthouse e aprovação estética final permanecem pendentes.
- Nenhum commit, push ou deploy foi feito. O servidor existente na porta 3100 não foi encerrado.

### Refatoração visual de autenticação — 28/09/2026

- `/conta` agora usa um único palco responsivo sem fotografia: narrativa verde profunda e formulário marfim conectados por sobreposição/curva, com tipografia editorial e detalhes leves em CSS. O painel não tem altura fixa e termina conforme o estado ativo.
- Login/cadastro ficam no mesmo stage. Uma lâmina verde mascarada atravessa verticalmente no mobile e diagonalmente no desktop; título, formulários, superfície e campos mudam em conjunto. A altura maior é reservada apenas durante a animação e liberada após o estado assentar, sem animar `height`.
- Formulário preserva a máquina de estados Supabase/MFA e validações existentes. Inputs seguem 54 px e 16 px; CTA 56 px; toggle e links têm alvo de 48 px. Branding permanece também em tablets touch largos. `prefers-reduced-motion` reduz os deslocamentos e o stagger.
- Cobertura Playwright atualizada para alternância repetida em 320×700, 360×800, 375×812, 390×844, 414×896, 430×932 e desktop 1366×768/1440×900. Inclui geometria do stage, alvos de toque, overflow e ausência de mídia raster/vídeo/canvas. O navegador/Playwright não foi executado nesta sessão; teclado virtual e transição visual real seguem pendentes de validação manual.
- `typecheck`, `format:check` e `build` passaram. `lint` passou sem erros, mantendo dois avisos existentes de `<img>` em `StorePhoto.tsx` e `Catalog.tsx`. Login Supabase/MFA real não foi exercitado por falta de credenciais de teste.
- Sem commit, push ou deploy. A aprovação estética do proprietário e inspeção visual nos viewports de referência continuam pendentes.

### Redesenho progressivo de autenticação — 28/09/2026

- Esta implementação substitui a composição anterior com painel verde/foto, que foi rejeitada. `/conta` agora usa um AuthShell marinho/marfim/dourado sem fotografia; o marinho primário `#00091b` foi amostrado do logo oficial. No desktop permanece a navegação superior; em touch continua o dock atual, com reserva de espaço inferior global e safe areas.
- O login e cadastro revelam primeiro o e-mail e só depois exibem senha/confirmar senha. Entrar ↔ Criar conta usa indicador Framer Motion compartilhado; mudança de etapa combina deslocamento curto e recorte, com variante reduzida para `prefers-reduced-motion`. Nome foi retirado porque `full_name` só era gravado como metadata sem consumidor; não foi criado onboarding redundante.
- Inputs têm 54 px e 16 px, senha tem alvo de 48 px, CTAs 56 px e ações inline ao menos 44 px. E-mail permanece disponível em campo `username` readonly junto à senha para password managers; o documento rola naturalmente com teclado/viewport reduzido.
- Google/Apple estão implementados via `signInWithOAuth`, callback SSR/PKCE e `next` allowlisted. Os botões são ocultos por padrão: `GOOGLE_OAUTH_STATUS = WAITING_FOR_PROVIDER_CONFIGURATION`; `APPLE_OAUTH_STATUS = WAITING_FOR_APPLE_DEVELOPER_CONFIGURATION`. Foram incorporados somente assets oficiais; nenhuma chave foi criada ou copiada. Setup e linking estão em `docs/auth-provider-setup.md`.
- Recuperação, confirmação por e-mail, submissão anti-dupla e MFA/TOTP existentes foram mantidos no mesmo shell. Callback OAuth recebe mensagem genérica e `no-store`/`no-referrer`; callback de e-mail e gates server-side continuam protegidos.
- A suíte E2E foi atualizada para login/cadastro progressivos, dimensões mobile 320–430 px, tablet 768×1024 e desktop 1366×768/1440×900, foco do próximo campo, alvos táteis, troca de modo, overflow e retorno seguro. O browser/Playwright e OAuth real não foram executados nesta sessão; teclado virtual de aparelho e aprovação visual ainda estão pendentes.
- Não foi feito commit, push ou deploy, preservando a instrução vigente de não enviar ao Git.

### Reconstrução visual de login/cadastro — 29/09/2026

- `/conta` foi recomposta em mobile-first conforme a direção aprovada: fundo navy/preto com arcos dourados discretos, marca centralizada, seletor Entrar/Criar conta em trilho escuro, indicador Motion compartilhado e cartão marfim. Não há fotografia, verde, tela dividida ou altura fixa; a composição se ancora no topo em touch e cresce naturalmente para permitir rolagem com teclado.
- Login e cadastro mantêm fluxo progressivo: primeiro e-mail; depois senha e, no cadastro, confirmação. Botões OAuth só aparecem com provider habilitado; CTA dourado, inputs de 54 px/16 px, toggle de senha de 48 px, links com hit-area confortável. A redefinição de senha agora compartilha o mesmo sistema visual e também não impõe comprimento mínimo não confirmado.
- E-mail é aparado e normalizado em minúsculas antes de qualquer chamada; a primeira etapa só valida formato, sem consultar existência. O cadastro redireciona quando o Supabase devolve uma sessão e mostra estado genérico de confirmação quando não há sessão. Login genérico, PKCE, cookies SSR, confirmação, recovery, `next` allowlisted e challenge TOTP permanecem preservados. Nenhuma alteração de banco/migration era necessária.
- Configuração local Supabase ausente; policy de senha, rate limits, CAPTCHA e SMTP remotos não puderam ser confirmados pelo MCP. Google e Apple continuam `WAITING_FOR_EXTERNAL_CONFIGURATION` e flags false; nenhuma credencial foi inventada.
- Playwright Chromium: 18/19 passaram na suíte completa; os testes de mobile (320, 360, 375, 390, 414, 430), tablet, desktop e axe de `/conta` passaram. O único caso restante era um locator genérico encontrando o anunciador do Next; o seletor foi corrigido e o teste isolado passou 1/1. A suíte completa não foi repetida após essa correção. Axe: sem violações em `/conta`; dois findings de contraste na landing permanecem fora do escopo.
- TypeScript, lint, `format:check` e build passaram. Lint mantém dois avisos antigos de `<img>` fora do escopo. O build usou `.next-auth-build` para não interferir no dev server; as entradas temporárias que o Next adicionou ao `tsconfig.json`/`next-env.d.ts` foram removidas após o build. O foco agora é aplicado no término da animação da etapa, em vez de um timer que podia correr antes da montagem do input.
- `GET /conta` respondeu HTTP 200 no servidor local da porta 3100. A política do browser do Codex bloqueou a inspeção visual da origem localhost; não foi contornada por outra superfície. O teclado virtual de aparelho e os estados reais de envio/SMTP/OAuth/MFA não foram homologados.

### Primeiro slice do administrativo de catálogo — 01/10/2026

- Implementado `/admin/produtos`: lista operacional com busca e filtros, criação/ativação de categorias, ficha de produto, múltiplas variações, SKU/preço/medidas/estoque, upload de imagens privadas, otimização para WebP, texto alternativo e estados rascunho/publicado/arquivado. `/admin` redireciona para a lista; não foi adicionado dashboard com números artificiais.
- Cada página e Server Action exige sessão, membership em `public.catalog_admins` e sessão MFA atual em AAL2. As policies RLS repetem membership + AAL2 e o RPC de gravação é SECURITY INVOKER/transacional. Triggers no banco protegem publicação, desativação de categorias e remoção da última imagem. Bucket continua privado; auditoria registra somente ator/operação/entidade/hora.
- Migrações `20261001165948_admin_catalog_management`, `20261001170058_index_catalog_admin_enabled_by` e `20261001170945_guard_catalog_publication_invariants` aplicadas ao Supabase remoto e alinhadas localmente; projeto continua sem categorias/produtos e sem administrador provisionado.
- A conta confirmada indicada pelo proprietário foi provisionada em `public.catalog_admins` em 02/10/2026. Consulta remota confirmou exatamente uma membership ativa, correspondente à conta autorizada. A sessão administrativa e o fluxo visual autenticado ainda precisam de validação com login e com o requisito MFA/AAL vigente.
- Não foi feito commit, push ou deploy; a árvore já continha mudanças independentes da landing/autenticação e elas foram preservadas.

### Segundo fator por e-mail no login — 01/10/2026

- O login por senha passou a solicitar um código de seis dígitos por e-mail via Supabase Edge Function e Resend; Google OAuth continua sem essa etapa. Cadastro, confirmação de e-mail, recuperação e MFA TOTP nativo permanecem no fluxo existente.
- A migration cria desafios e sessões verificadas em schema privado, com código armazenado como HMAC, validade de cinco minutos, até cinco tentativas, intervalo de reenvio de 60 segundos e cinco envios por hora. As rotas de conta/admin consultam a sessão verificada; nenhuma claim `aal` é forjada. Admin continua exigindo MFA existente ou a verificação por e-mail para sessão de senha, além de membership explícita.
- O proprietário confirmou que cadastrou os secrets `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no projeto Supabase; seus valores não foram lidos nem exibidos. As migrations e a Edge Function já foram publicadas no projeto remoto.
- `npm run typecheck`, `npm run format:check` e build de produção passaram. `npm run lint` passou com dois avisos antigos de `<img>`; o ESLint agora ignora os diretórios Next `.next-*`, inclusive previews locais. A Edge Function usa o contexto oficial `@supabase/server`; validação com runtime Deno e pgTAP não foram executados porque Deno/Docker não estão disponíveis.
- Migration `20261001200845_password_email_mfa_sessions` e Edge Function `email-password-mfa` estão aplicadas/ativas no projeto `imperiosofas`, com `verify_jwt=true`. Foi aplicada também `20261001201156_email_mfa_session_fk_indexes`, cobrindo os dois índices de chave estrangeira recomendados pelo Performance Advisor; nomes locais alinhados às versões remotas.
- Verificações remotas confirmaram tabelas, índices e bloqueio do RPC de emissão para `anon`. Ainda falta teste ponta a ponta de login por senha, recebimento do OTP, validação e acesso à conta. Nenhum e-mail de teste foi enviado nesta sessão.
- Diagnóstico posterior encontrou resposta HTTP 403 do Resend. A interface foi corrigida para não prender `busy` sob React Strict Mode, distinguir envio de verificação, permitir cancelar o envio automático e aplicar timeout de 15 s. A Edge Function foi atualizada para v2 com diagnóstico categorizado sem logar corpo bruto, destinatário, segredo ou OTP; a próxima tentativa ainda é necessária para identificar a categoria exata e confirmar entrega.
- Nenhum commit, push ou deploy foi feito; a árvore contém mudanças locais anteriores e independentes.

### Provisionamento da única conta admin — 02/10/2026

- Conferido no Supabase que o e-mail indicado pertence a uma conta existente, confirmada e ainda não provisionada.
- Inserida a membership dessa conta em `public.catalog_admins`; verificação posterior confirmou que o total de administradores ativos é exatamente um.
- O painel operacional de catálogo já existia em `/admin/produtos`; não foi criado um dashboard de métricas nem alterada a implementação do painel nesta operação.
- Nenhuma migration ou alteração de RLS foi necessária para atribuir a membership. O requisito MFA/AAL já existente permanece inalterado.

### Pausa local do OTP por e-mail — 02/10/2026

- Criado `NEXT_PUBLIC_DISABLE_PASSWORD_EMAIL_MFA=true` em `.env.development.local`, arquivo ignorado pelo Git. O bypass é condicionado também a `NODE_ENV=development`; não opera em produção.
- Login por senha local segue direto para a conta. A verificação nativa TOTP/AAL2 continua habilitada, e as proteções do admin, Supabase remoto, migrations e políticas RLS não foram alteradas.
- Build, typecheck, lint e Prettier nos arquivos de código alterados passaram. Não foi possível iniciar outro `next dev` na porta 3100 porque o lock de `.next` já estava em uso; reinicie o processo Next atualmente aberto para carregar a variável.
- Nenhum commit, push ou deploy foi realizado.

### Atalho administrativo na conta — 02/10/2026

- `/conta` consulta a membership de `catalog_admins` no servidor e só mostra o atalho `/admin` quando RLS retorna a membership própria. A rota, o layout e as Server Actions do admin continuam com guards independentes.
- O requisito MFA/AAL2 das políticas do catálogo foi mantido. Sessão sem o segundo fator continua encaminhada para segurança; remover essa exigência requer mudança coordenada nas políticas RLS, não apenas ocultar o redirecionamento.
- Auditoria do scanner: `your-publishable-key` não aparece em `src`; foi encontrado somente em chunks/source maps de desenvolvimento gerados. Nas capturas o detector mostra um placeholder, não o valor de uma credencial. A chave `sb_publishable_*` é pública por definição; service-role/secret keys não devem ir ao cliente.
- Build de produção isolado e typecheck passaram; lint passou com dois avisos preexistentes de `<img>`. `format:check` aponta formatação preexistente em `docs/production-blockers.md` e `docs/test-evidence.md`. A inspeção visual não foi executada porque o navegador bloqueou localhost nesta sessão.
- Nenhum commit, push, deploy ou alteração remota do Supabase foi feito.

## Desativação temporária de MFA administrativo — 02/10/2026

- Login por senha e OAuth seguem da sessão válida para o destino interno seguro sem código e sem challenge automático. Conta, redefinição de senha e carrinho não verificam MFA/AAL.
- `/admin` e ações administrativas continuam exigindo usuário autenticado e membership explícita; RLS usa a mesma membership e continua negando `anon` e usuários comuns.
- A gestão TOTP permanece opcional em `/conta/seguranca`, conforme decisão do proprietário. Fatores existentes não foram removidos; MFA não será reativado sem solicitação explícita.
- A migration `20261002175919_disable_mandatory_admin_mfa` remove o teste de `aal2` do helper administrativo sem alterar migrations anteriores ou abrir permissões.
- A migration `20261002175919_disable_mandatory_admin_mfa` foi aplicada ao projeto Supabase `qsafyqsskwbjnailgoev`; a definição remota e a lista de migrations foram verificadas.
- A migration `20261002181355_disable_email_mfa_rpc` revogou execução das RPCs cliente de status MFA por e-mail, preservando as tabelas e os dados históricos.
- Edge Function `email-password-mfa` publicada como versão 3 com `verify_jwt=true`; preflight `OPTIONS` é mantido e chamadas respondem `410 email_mfa_disabled` sem enviar ou verificar códigos.
- Simulação SQL remota confirmou membership explícita válida em AAL1, usuário sem membership negado mesmo em AAL2 e privilégios do helper ausentes para `anon`.
- Evidências de testes desta mudança estão em `docs/test-evidence.md`; sessão real do proprietário segue pendente.

## Fluxo de imagem e publicação do produto — 05/10/2026

- A seção Imagens agora aparece também em `/admin/produtos/novo`, explica que o rascunho precisa ser salvo primeiro e o salvamento inicial retorna ao editor ancorado nessa seção. O upload continua restrito à conta administradora, bucket privado e produto persistido.
- Publicar não aparece no cadastro inicial e fica desabilitado no editor enquanto categoria, variação vendável ou imagem com texto alternativo não estiverem persistidos. Erros de validação e do RPC aparecem no formulário sem redirecionar nem apagar os campos; o upload informa progresso e falha na própria seção.
- Homologação real no `localhost:3101` com `CATALOG_SOURCE=supabase`: rascunho criado; SKU, preço e estoque persistiram; imagem WebP e texto alternativo foram enviados, exibidos por URL assinada e permaneceram após F5; a publicação apareceu em `/loja`, `/loja/sofas` e PDP; a despublicação removeu o item dessas rotas.
- Dois produtos TEST foram usados apenas para o fluxo e a validação de erro. Ambos foram removidos; consulta final retornou zero produto, variação, estoque, mídia, objeto Storage e auditoria relacionados. Carrinho, MFA, Vercel e schema não foram alterados. Evidências detalhadas em `docs/test-evidence.md`.

## PLP da loja — 06/10/2026

- `/loja` e `/loja/[categoria]` agora compartilham uma PLP compacta com busca por nome, preço, largura multisseleção, ordenação real e paginação de 12 itens. Estado na URL; mobile usa `<dialog>` modal nativo para filtros e ordenação. Desktop exibe sidebar, mobile grade de duas colunas.
- A RPC pública `get_catalog_listing` aplicada no Supabase (`20261006044127`) retorna somente produtos ativos com variantes vendáveis e estoque positivo, preço mínimo consistente, total e facets reais de largura. A página assina imagens do resultado paginado em lote no bucket privado.
- Cor e tecido permanecem fora dos filtros: são texto livre sem taxonomia validada. Não há filtro de disponibilidade separado porque a projeção pública já mostra somente produtos com estoque vendável.
- Testes de navegador e SQL em `docs/test-evidence.md`. Nenhum produto TEST persistiu; o produto que já existia no projeto foi preservado. Nenhum commit, push ou deploy nesta tarefa.

## Loja, PDP e interações de comércio — 06/10/2026

- PLP ganhou card com fotografia dominante e favorito independente do link, avaliações agregadas reais, filtros em accordions, sort por opções e tratamento editorial para catálogo com apenas um produto. A busca/filtros/paginação continuam server-side; a landing `/` foi preservada.
- PDP usa todas as mídias disponíveis do produto, preço e dimensões da variante selecionada, quantidade limitada ao saldo, favoritos, avaliações reais, Product JSON-LD sem rating fictício e ação de carrinho autenticada. O bucket de mídia permanece privado; URLs assinadas são geradas em lote.
- Migrations `20261006174118_commerce_interactions`, `20261006174821_review_admin_read`, `20261006180256_customer_favorite_listing`, `20261006180540_guard_hidden_review_removal` e `20261006181727_search_public_variant_attributes` foram aplicadas ao projeto Supabase. Favoritos, avaliações e carrinho possuem RLS. A busca cobre nome, cor e tecido de variantes vendáveis (sem SKU). A moderação fica em `/admin/avaliacoes` e favoritos do cliente em `/conta/favoritos`.
- O carrinho persiste quantidade por variante e consulta preço/estoque no servidor; não reserva estoque. Frete, checkout, pagamento e pedido continuam fora do escopo e indisponíveis.
- O produto remoto atual tem `width_mm = 10000` e `fabric = "10000"`. O editor confirma que largura está em milímetros; a apresentação de 10,00 m é conversão fiel do valor salvo, não bug de unidade no frontend. Exige correção dos dados comerciais pelo administrador; nenhuma medida foi inventada ou alterada silenciosamente.
- Testes transacionais com rollback e inspeção visual local estão detalhados em `docs/test-evidence.md`. Não houve alterações na Vercel, em MFA, nem push ao Git.

## Importação do catálogo legado — etapa Berlim, 07/10/2026

- Fonte auditada novamente: 7 categorias, 51 produtos, 35 variantes explícitas e 107 imagens; 11 produtos sem dimensões. O importador idempotente e a migration remota/local `20261007174859_legacy_catalog_import` usam credencial somente server-side e bucket privado.
- O único fixture do Berlim foi substituído pelo real como DRAFT, com quatro variantes/preços, SKUs técnicos, estoque 10/alerta 5, sem dimensões inventadas e uma imagem WebP privada assinada. O storefront local confirma rascunho ausente da PLP/categoria e PDP 404. Referências existentes de carrinho/avaliação foram preservadas.
- Homologação pausada antes do lote de 50: o navegador de teste não tinha sessão administrativa e `/admin/produtos` redirecionou para login; `ADMIN_VISIBLE` ainda não passou. Nenhum dos outros produtos ou categorias foi criado. Evidências e validação em `docs/test-evidence.md`.
- Typecheck, lint, formatação e build passaram; lint tem dois avisos conhecidos de `<img>`. Sem deploy, alterações de Vercel/MFA/carrinho, commit ou push.

### Continuação: medidas e lote completo — 07/10/2026

- `ADMIN_VISIBLE = PASS`: admin autenticado exibiu largura 2900, 2100, 2300 e 2500 mm nos SKUs correspondentes após reload.
- A fonte do Berlim traz quatro medidas nos rótulos das variantes; importador corrigido para normalizar rótulos escalares de sofá por variante (m/cm/mm → mm), sem depender da ordem ou preço. Berlim atualizado; profundidade/altura permaneceram nulas. A dimensão adicional do fallback legado (abertura/fechado) não foi usada porque não consta na API atual.
- Os outros 50 produtos foram importados. Segunda execução: todos idempotentes e verificados; nenhum duplicado.
- Estado remoto: 7 categorias, 51 rascunhos, 0 publicados, 71 variantes/estoques, 107 mídias/objetos privados, sem órfãos ou duplicidades.
- `typecheck`, `lint`, `format:check` e `build` passaram. Apenas 2 avisos existentes de `<img>`. Vercel/deploy, MFA e carrinho continuam intocados; sem commit/push.

## Workstream navegação e feedback de conta — 13/10/2026

- Adicionados `loading.tsx` específicos para categoria, PDP e editor admin de produto. O fallback é skeleton acessível e responsivo; no admin permanece dentro do `AdminShell`, sem contornar nem substituir os guards existentes.
- `BottomNavigation` agora consulta o resumo do carrinho na montagem, em login e em `cart:changed`, não em cada mudança de rota. Requisições concorrentes/obsoletas não sobrescrevem contagem mais nova; logout zera a contagem. O link de alteração de e-mail em `ProfileEditor` usa `next/link` e mantém o fragmento `#email`.
- Navegação touch 390×844 com resposta da API interceptada localmente: uma consulta inicial; zero consultas adicionais em Loja, filtro `?sort=price_asc`, Conta e Voltar; contagem do badge preservada. Evento `cart:changed` provocou exatamente uma consulta e atualizou o badge. Nenhuma chamada remota ou escrita foi feita.
- Métrica de desenvolvimento sem ganho alegado: baseline aquecido feedback/content 101/416 ms; após a mudança duas amostras 153/870 e 203/935 ms. A variância e o overhead/compilação do servidor de desenvolvimento impedem concluir melhoria de latência; comparação e harness estão em `docs/remediation/agents/navigation-performance.md`.
- `npm ci` não bloqueia: Next 16.3.8 instalado e validado por `npm ls next --depth=0`; nenhuma instalação continua ativa. Testes `tests/e2e/**` não foram editados nem executados (workstream TEST-001).
- Typecheck, lint, `format:check` e build completos passaram; lint mantém dois avisos preexistentes de `<img>`. Sem migration, comércio, `CatalogProductGrid.tsx`, commit, push, merge, deploy ou agente adicional.

## Fundação de Analytics e dashboard administrativo — 15/10/2026

- Integração local em `integration/final-hardening`: dashboard `/admin/analytics`, seções de produtos/estoque/comportamento, rota `/admin/relatorios`, navegação administrativa responsiva e exportação XLSX. A landing e a navegação pública não foram alteradas neste workstream.
- Snapshot atual do catálogo vem de uma RPC agregada `SECURITY INVOKER`, autorizada por `private.is_catalog_admin()`; execução `PUBLIC`/`anon` revogada e `authenticated` concedida. A migration `20261015195848_admin_catalog_analytics_snapshot` foi aplicada somente ao Supabase TEST. Nenhuma linha de cliente foi consultada ou alterada; os contadores de negócio permaneceram estáveis.
- Reconciliação em 15/10: o banco TEST está com 7 categorias e 51 produtos ativos/publicados (0 rascunhos); o snapshot no ledger legado ainda registra o estado de importação original como draft. A auditoria disponível não permite atribuir com segurança o ator ou a ação que mudou o status. A homologação não alterou status, preço, estoque, variante ou publicação. Os cartões refletem estado atual; não inferem vendas, receita ou conversão. Tracking comportamental segue ausente e depende de decisão de privacidade/consentimento.
- XLSX administrativo gera Resumo, Produtos, Estoque, Categorias, Comportamento e Metodologia; não exporta PII, paths de mídia ou signed URLs, e escapa entradas que poderiam virar fórmulas. Requer admin, tem respostas privadas `no-store`, filtro UUID, limites de volume e tamanho e paginação sequencial.
- Revisões independentes aprovaram com ressalvas. Risco P2 a acompanhar antes de escalar o catálogo: a RPC de listagem usada pelo XLSX transfere descrições/mídias desnecessárias e alguns limites (variantes/tamanho final) só são avaliados após carregar os dados. Sem N+1 por produto no dashboard; não foi observada necessidade de assinar imagens para estas telas.
- `npm run typecheck`: PASS. `npm run lint`: PASS, 0 erros e 2 warnings preexistentes de `<img>`. Testes focados de serviço/exportação: 27/27 PASS. E2E completo local, ambiente Supabase sanitizado: 32/32 PASS. `npm run build`: PASS.
- `npm run format:check` global: FAIL em 90 arquivos históricos/preexistentes. Não houve formatação em massa; Prettier passou somente nos arquivos novos/alterados de Analytics e nos novos documentos desta feature.
- pgTAP oficial no Supabase TEST: 63/63 passou em transação com rollback; fixtures não persistiram, embora sequências possam ter lacunas. A revisão visual autenticada no browser não foi possível nesta sessão.
- Build local inspecionado: nenhum padrão de secret Supabase ou nome de variável privilegiada nos chunks do cliente. `.env.local` continua ignorado pelo Git. Nenhuma Vercel, push ou deploy foi tocada; sem commit nesta tarefa.
- Veredito detalhado: `docs/analytics/FINAL_VERDICT.md`.

## Fundação de logística — 20/10/2026

- Implementada a base de modalidades, cobertura municipal explícita, retirada Vale, cotações negociadas e trilha de eventos; não inclui checkout, pedidos, pagamento, reserva de estoque, emissão fiscal ou transportadoras.
- Somente Supabase TEST foi alterado. Histórico remoto alinhado às migrations locais `20261020223338_logistics_foundation` e `20261020224530_logistics_foreign_key_indexes`.
- pgTAP oficial no Supabase TEST: 153/153 PASS dentro de transação com `ROLLBACK`. Verificação posterior encontrou zero fixtures temporários; os 51 produtos permaneceram sem fornecedor atribuído, sem alterações comerciais.
- E2E local: 34/34 PASS em viewports 320–1440 px, em execução anterior às últimas mudanças SQL/documentação. QA visual autenticado do Admin não foi concluído porque a sessão administrativa não estava disponível para automação.
- Performance Advisor deixou de reportar FKs logísticas sem índice; 13 índices aparecem como não usados no ambiente de baixo tráfego. Security Advisor ainda lista funções `SECURITY DEFINER` e tabelas sem policy direta, revisadas como fronteiras fechadas e exercitadas por pgTAP; seguem também um finding de proteção contra senhas vazadas e uma policy permissiva duplicada preexistente em avaliações.
- A criação de cotações pelo runtime local segue bloqueada: `SUPABASE_SECRET_KEY` está ausente. Todos os produtos continuam sem fornecedor; telefone oficial, política para múltiplas entregas e calendário de feriados continuam pendentes. Endereço também é repetido no fingerprint interno e precisa de decisão de retenção/remoção antes de operação real.
- `ANALYTICS_FASE_2` continua pendente para depois de pedidos, frete, checkout e pagamentos. Sem commit, push, deploy, alteração MFA ou acesso à Vercel. Evidências e limitações: `docs/logistics/operations.md` e `docs/logistics/architecture.md`.
