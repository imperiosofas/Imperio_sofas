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

| Integração   | Evidência atual                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Supabase     | Projeto remoto `imperiosofas` identificado e migration inicial aplicada; CLI local não validada porque Docker não está instalado |
| Mercado Pago | Não configurado; nenhum pagamento ou webhook testado                                                                             |
| Bling/NF-e   | Não configurado; nenhuma emissão ou certificado testado                                                                          |
| Resend       | Não configurado; nenhum envio comercial testado                                                                                  |

## Catálogo persistente

| Verificação      | Resultado                                   | Evidência                                                                                                                                                                                     |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration e seed | Schema aplicado; seed pendente              | `supabase/migrations/20260924155912_catalog_initial_schema.sql`; versão remota `20260924155912`; seed não executado no banco remoto                                                           |
| RLS e RPC        | Aplicados; pgTAP local pendente             | Cinco tabelas com RLS, funções RPC filtradas e bucket `catalog-images` privado; `supabase/tests/catalog_public.sql` aguarda Docker                                                            |
| Adapter Supabase | Implementado; conexão da aplicação pendente | RPCs validadas com Zod; variáveis de ambiente do app ainda não configuradas                                                                                                                   |
| Seed comercial   | Arquivo criado; remoto vazio                | O seed contém cinco rascunhos sem preço e sem estoque; não foi inserido no projeto remoto                                                                                                     |
| Advisors         | Conferidos após aplicar                     | RLS sem policy é intencional: acesso direto permanece revogado; RPCs públicas são as projeções controladas. Há também aviso prévio em `public.rls_auto_enable` e recomendação de índice da FK |

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

| Verificação                   | Resultado                 | Evidência                                                                                                                                     |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`           | Passou                    | Fluxos Supabase browser/server, callbacks, páginas privadas e TOTP compilam sem erros                                                         |
| `npm run lint`                | Passou com avisos antigos | 0 erros; permanecem apenas 3 avisos de `<img>` em componentes preexistentes da landing                                                        |
| `npm run format:check`        | Passou                    | Script agora inclui `proxy.ts`, `src/index.css`, `src/lib/supabase` e `src/features/auth`                                                     |
| `npm run build`               | Passou                    | Next.js 16 gerou `/conta`, confirmação, callback, recuperação e segurança; páginas com sessão foram mantidas dinâmicas                        |
| UI sem configuração Supabase  | Conferida no navegador    | `/conta` mostra indisponibilidade explícita e desabilita o envio; sem login ou OTP de demonstração                                            |
| Mobile 390 × 844              | Conferido visualmente     | Cabeçalho compacto, imagem editorial curta e formulário em coluna, sem overflow horizontal visível                                            |
| Refinamento desktop           | Checks locais passaram    | Cadastro >=900px agora mantém campos em coluna única; build, typecheck e formato passaram; lint sem erros (3 avisos preexistentes de `<img>`) |
| Supabase/SMTP/token hash/TOTP | Pendente                  | `.env.local`, templates e credenciais homologadas ausentes; signup, e-mail, sessão e MFA não foram simulados como funcionais                  |

## Refinamento da autenticação e banco remoto — 24/09/2026

| Verificação                | Resultado                            | Evidência                                                                           |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Transição login/cadastro   | Implementada; desktop conferido      | Cobertura animada adaptada por breakpoint; ciclo ida/volta e foco vistos no browser |
| Entrada TOTP               | Implementada; backend não homologado | Input único acessível de seis dígitos, autofill/colar e código preservado no erro   |
| Sucesso MFA                | Implementado; backend não homologado | Animação só começa após resposta bem-sucedida de `mfa.verify`                       |
| Migration remota           | Aplicada e conferida                 | Projeto `imperiosofas`, versão `20260924155912`, tabelas e bucket presentes         |
| Check de advisors Supabase | Executado                            | RLS ligado nas tabelas; avisos registrados na seção de catálogo acima               |
| Operações reais Auth e MFA | Pendentes                            | Aplicação local ainda sem env; nenhum cadastro/login ou TOTP foi simulado           |
| Desktop 1234 × 712         | Conferido manualmente                | Login↔cadastro, títulos, foco e rolagem até o botão conferidos                      |
| Mobile 320–430 px          | Pendente                             | Viewports mobile ainda precisam de conferência visual nesta versão                  |

## Refinamento visual da autenticação — 24/09/2026

| Verificação                   | Resultado                        | Evidência                                                                                                   |
| ----------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Formulário sem rótulos extras | Conferido no navegador           | Kicker da marca e overlines de login/cadastro removidos; textos inferiores da foto removidos                |
| Login desktop                 | Conferido manualmente (1234×712) | Formulário à esquerda; foto Berlim à direita; hierarquia e foco visíveis sem corte após reload              |
| Cadastro desktop              | Conferido manualmente (1234×712) | Foto Maximo à esquerda; formulário à direita; mudança de imagem e conteúdo sincronizada à cobertura animada |
| Foco após trocar estado       | Conferido manualmente            | Não rola o cartão no desktop; em viewports compactos mantém a rolagem assistida ao formulário               |
| Mobile 320–430 px             | Pendente                         | A sessão de navegador não oferece emulação/controle de viewport; requer conferência em viewport ou aparelho |
| `npm run typecheck`           | Passou                           | `tsc --noEmit`                                                                                              |
| `npm run lint`                | Passou com avisos antigos        | 0 erros; somente 3 avisos preexistentes de `<img>` fora da tela de autenticação                             |
| `npm run format:check`        | Passou                           | Todos os arquivos incluídos no script estão formatados                                                      |
| `npm run build`               | Passou                           | Next.js 16 compilou e gerou as rotas da aplicação                                                           |
| Fluxos Supabase               | Não alterados/não homologados    | Sem variáveis locais; signup, e-mail, sessão e MFA não foram exercitados contra o serviço                   |

## Ergonomia mobile da autenticação — 24/09/2026

| Verificação                       | Resultado                        | Evidência                                                                                         |
| --------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Faixa promocional inferior        | Removida                         | O bloco deixou de ser renderizado em `/conta`                                                     |
| Painel mobile                     | Ajustado no CSS                  | Imagem limitada a 108 px e sem slogan; prioridade visual e de altura transferida ao formulário    |
| Campos e tipografia               | Ajustados no CSS                 | Inputs com 52 px mínimos e 16 px; labels e ajuda ampliados, com mais distância vertical           |
| Áreas de toque                    | Ajustadas no CSS                 | CTA, senha, links de login/cadastro/recuperação e retorno com ao menos 48 px de altura            |
| Teclado, safe area e altura útil  | Configurados; falta QA em device | `enterKeyHint`, `100dvh`, safe-area insets, `viewport-fit=cover`, teclado redimensiona o conteúdo |
| Login/cadastro e alternância      | Lógica preservada                | Alterações restritas à apresentação e atributos de ergonomia                                      |
| Toggle, recuperação e alternância | Conferidos no navegador          | Mostrar/ocultar senha, abrir recuperação, voltar ao login e abrir cadastro; nenhum dado enviado   |
| Viewports 320/360/375/390/430 px  | Pendente                         | Nenhum controle de viewport/emulador mobile disponível nesta sessão                               |
| Teclado virtual, toque e overflow | Pendente                         | Requer navegador com device emulation ou aparelho; não inferido a partir do CSS                   |
| Supabase real                     | Não exercitado                   | Fluxos de conta não foram submetidos nem alterados                                                |

## Estabilidade e motion mobile em `/conta` — 24/09/2026

| Verificação                                        | Resultado                                  | Evidência                                                                                                  |
| -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 320/360/375/390/430 px: login→cadastro→login       | Passou no navegador                        | Nos cinco widths, cartão: `y=65,59 px`, altura `853,98 px`, `scrollTop=0`; sem overflow horizontal         |
| Altura da composição entre estados                 | Estável                                    | Mesmas medidas do cartão no login, cadastro e retorno; formulário é sobreposto dentro da stage de `528 px` |
| Movimento formulário e imagem                      | Conferido nos dois sentidos                | Capturas no meio da transição; fotos cruzam de opacidade ~0,5 com deslocamento diagonal oposto             |
| Campos e ações                                     | Passou                                     | Input `52 px`/`16 px`; CTA `52 px`; revelar senha `48×48 px`; alternância `48 px`, 13,59 px após CTA       |
| Foco com altura reduzida (`420 px`)                | Passou como simulação de teclado           | E-mail focado e inteiramente visível nas cinco larguras; `type=email`, sem overflow horizontal             |
| Teclado virtual nativo                             | Não disponível nesta sessão                | A altura foi reduzida no emulador, mas não há teclado de aparelho/iOS/Android real                         |
| CTA e toggle em viewport baixo                     | Conferidos sem envio                       | CTA vazio acionou validação nativa sem submeter; mostrar senha continuou operável                          |
| Desktop (`1234×900`)                               | Conferido; breakpoints existentes mantidos | Grid calculada continua `"form visual"` no login e `"visual form"` no cadastro                             |
| Supabase/auth/MFA                                  | Preservados e não exercitados              | Mudanças limitadas a apresentação, motion, foco e organização dos controles                                |
| `npm run typecheck`, `lint`, `format:check`, build | Passaram                                   | Lint: 0 erros; 3 avisos preexistentes de `<img>` em componentes fora da tela de autenticação               |
