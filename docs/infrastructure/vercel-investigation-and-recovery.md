# Investigação e recuperação segura da Vercel

Data: 23/10/2026, America/Sao_Paulo. Veredito: causa comprovada; correção local isolada validada; Preview remoto continua bloqueado por decisões de plano e isolamento de credenciais.

## 1. Causa comprovada

Os dois projetos novos clonaram `imperiosofas/Imperio_sofas`, commit `32896999314b6f0bbd760208ca22b5bd2cf6473e`, instalaram dependências, compilaram e passaram pelo TypeScript. Ambos falharam ao coletar configuração/páginas:

```text
Error: Failed to collect configuration for /_not-found
[cause]: TypeError: Invalid URL
at module evaluation (src/app/layout.tsx:7:17)
metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000")
code: ERR_INVALID_URL
input: ''
Error: Command "npm run build" exited with 1
```

`??` não substitui uma string vazia. A variável existia vazia no processo do build; `new URL("")` falhou durante a avaliação do layout. Os dois erros da interface são a falha de configuração e sua propagação como falha de coleta/build; não são evidência de duas causas independentes.

Evidências autenticadas:

- [imperio-sofas, EubSuWaKo5sJtVvredrLbgb3zye2](https://vercel.com/imperio-sofas/imperio-sofas/EubSuWaKo5sJtVvredrLbgb3zye2): build 40 s, Next 16.3.6, compilação e TS concluídos; erro acima.
- [imperio-sofas-z28b, 5fZfc9juBq6GJrZQqB9CwYxV4ry4](https://vercel.com/imperio-sofas/imperio-sofas-z28b/5fZfc9juBq6GJrZQqB9CwYxV4ry4): build 42 s, mesmo commit, arquivo e `input: ''`.
- Reprodução histórica isolada em `../vercel-investigation-20261022`: Node 24.15.0, npm 11.12.1, Next 16.3.6. `APP_URL=''`: FAIL com a mesma causa; mesmo código sem `APP_URL`: PASS. Typecheck, lint e format:check históricos passaram; lint manteve três avisos de imagens. Logs em `evidence/build-empty.log` e `evidence/build-unset.log` daquele diretório.

Não se atribui a falha a avisos `npm deprecated`, à transferência GitHub, ao framework detectado ou a variáveis Supabase sem evidência.

## 2. Contas, projetos e domínios

| Papel                   | Conta/equipe                 | Projeto / ID                                              | Estado observado                                                                                 |
| ----------------------- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Landing oficial         | `thiagobettinramos-projects` | `imperio-sofas` / `prj_o7jRr0SZaMRUDuMzKku3PibOTC0g`      | Produção READY `AtGnDUUiKaqFj1a3daGvwcQUEabb`, commit `90cbf52d0fab8d96ce1fc4607fb7e9ba45c8aea0` |
| E-commerce escolhido    | `imperio-sofas`, Hobby       | `imperio-sofas` / `prj_H9gOf0Dcv0yv6tTXP5uusx99QNAg`      | Nenhum build novo executado nesta tarefa; último build principal observado falhou                |
| Projeto novo redundante | mesma equipe                 | `imperio-sofas-z28b` / `prj_WmCxqiaXX0GYBb9wo2d0V76yG5Sx` | Mesmo commit e causa de falha; preservado                                                        |

Equipe nova: `team_fOxZuAfqTk0SUmpLAmD86zxT`, confirmada também na UI de configurações da equipe.

**Acesso às contas em 2026-10-23:** o proprietário esclareceu que as contas da Império Sofás estão no Brave e a conta pessoal está no Chrome. A sessão Brave da equipe ficou acessível e foi usada em modo somente leitura. Nesta sessão, o controle de janelas não expôs nenhuma janela Chrome e o canal Chrome DevTools mostrou apenas `about:blank`; portanto, a conta pessoal não pôde ser revalidada visualmente agora. Os dados da landing pessoal acima refletem as evidências já registradas nesta investigação e a verificação pública do deployment, não uma nova inspeção autenticada do Chrome nesta etapa.

Landing: `imperiosofas.com.br` redireciona 308 para `www.imperiosofas.com.br`; `www.imperiosofas.com.br` e `imperio-sofas.vercel.app` estão associados à produção antiga. Projeto escolhido: somente `imperio-sofas-woad.vercel.app`, associado à sua produção. Projeto redundante: `imperio-sofas-z28b.vercel.app`. Nenhum domínio foi associado, removido ou alterado.

Os três projetos continuam ligados a `imperiosofas/Imperio_sofas`. Landing usa preset Vite, raiz padrão e comandos automáticos; novos usam Next.js, raiz padrão e comandos automáticos, sem override de output. Node atual exibido nas configurações: 24.x. Isso é configuração atual, não prova retrospectiva da versão Node do build antigo.

Nos projetos novos, Require Log In está marcado com Standard Protection. Não foi alterado. Esta proteção cobre Preview e não cobre todos os aliases/domínios de produção. Sua eficácia em um novo deployment ainda não foi testada anonimamente.

## 3. GitHub e risco de automação

O endereço antigo `ratryx/Imperio_sofas` responde com redirecionamento para o repositório ID `1356434023`, hoje `imperiosofas/Imperio_sofas`. A data exata da transferência não foi estabelecida. Clones e statuses Vercel posteriores funcionam: não há evidência de transferência causando o erro de URL.

`90cbf52` contém Vite (`tsc -b && vite build`); `3289699` já contém Next.js (`next build`). O GitHub `main` consultado ainda aponta a `3289699`, enquanto o código atual relevante está localmente muito mais avançado. O job quality daquele commit passou, inclusive build; isso é compatível com a falha específica de env observada na Vercel.

**Push não é seguro nesta configuração.** A landing antiga acompanha `main` em Production e todas as branches não atribuídas em Preview. Deployments Dependabot recentes confirmam que a integração continua ativa. Criar uma branch alternativa não impediria atividade no projeto antigo.

Não foram alteradas permissões, instalação de apps, webhooks, Git integration, refs ou branches remotas. O inventário completo das autorizações/webhooks GitHub não foi comprovado; não é necessário mudá-los para a alternativa manual.

## 4. Código atual e candidato isolado

Fonte atual com Analytics e logística:

```text
C:\Users\Thiago\Documents\Codex\2026-09-03\files-pasted-by-the-user-estou\outputs\imperio-sofas-vale-final-hardening
branch: codex/logistics-foundation
HEAD: 72a0ad0d798d8a710ebf648b7e17f8ddba4924b5
```

Essa fonte tem alterações unstaged, arquivos novos necessários e um rename de migration staged. Foi preservada. A pasta original `imperio-sofas-vale`, HEAD `8af0f47`, não representa o estado atual com Analytics/logística. As pastas `ChatGPT/ecommerce` e `ChatGPT/Ecommerce Imperio` eram repositórios sem commits.

O candidato desta recuperação é uma cópia isolada em `ChatGPT/ecommerce/vercel-test-recovery`, inicialmente com 389 arquivos do estado real; os 18 omitidos foram depois restaurados. Nenhum `.env` foi copiado; não contém vínculo `.vercel` nem `.git` próprio. Não é uma nova branch publicada e não substitui a fonte original. Migrations foram apenas copiadas como parte do snapshot, nunca aplicadas.

**Paridade do snapshot:** a comparação inicial encontrou 18 arquivos ausentes (13 imagens e cinco arquivos do Supabase). Copiei somente esses arquivos para os caminhos ausentes, sem sobrescrever os já existentes nem alterar a fonte. A comparação final encontrou zero arquivo de projeto faltante, excluindo intencionalmente `.env*`, `.next*`, `node_modules`, `.git`, logs e `supabase/.temp`. O build foi repetido depois da cópia e passou. Isso conclui a paridade local, mas os gates de plano e ambiente Preview continuam pendentes.

Correção limitada à causa comprovada:

- `src/lib/env/app-url.mjs` e declaração de tipos centralizam resolução da base de URL.
- `APP_URL` válida e explícita tem precedência; string vazia/espaços passam a ser ausência.
- Na Vercel, usa-se o hostname real `VERCEL_URL` com HTTPS como fallback; fora do ambiente local, ausência de ambos falha com mensagem sanitizada.
- URLs malformadas, protocolos não HTTP(S) e URLs com credenciais são rejeitados sem imprimir valores.
- Layout, JSON-LD da PDP, sitemap, robots e schema de env usam o mesmo resolvedor.
- Oito testes cobrem ausência, vazio/espaços, host Vercel, precedência, URL inválida, mensagem sem vazamento e composição de URLs.
- `.vercelignore` exclui envs, caches/builds, dependências, documentação, testes e migrations do upload. A junction de dependências foi preservada fora do snapshot após ser identificada pelo Turbopack; a regra `.local-dependency-reference` impede seu envio caso seja reintroduzida.

Uma tentativa inicial de validação com dependências via junction falhou porque o Turbopack encontrou a referência local fora da raiz do projeto. A junction foi preservada fora do snapshot; as dependências foram instaladas fisicamente a partir do lockfile. Isso era um problema do harness, separado da falha histórica de `APP_URL`.

**Validação local do candidato:** instalação pelo lockfile concluída; `npm run build` passou em Next 16.3.8 com `APP_URL=''`, `APP_ENV=staging`, `CATALOG_SOURCE=supabase`, URL pública e chave publishable do Supabase TEST, e o hostname de Preview observado. O build compilou, passou pelo TypeScript e gerou páginas estáticas 8/8. A correção resolve o caso real de env vazia. `npm run typecheck` passou; `npm run lint` passou com dois avisos preexistentes de `<img>`; os oito testes de `app-url` passaram; Prettier passou em todos os arquivos alterados nesta cópia.

`npm run format:check` do projeto completo continua encontrando 84 arquivos preexistentes fora desta correção. A revisão independente havia confirmado que os arquivos inicialmente apontados eram byte-idênticos à fonte anterior; apenas o teste E2E alterado para corrigir o timeout foi formatado pontualmente. Nenhum formato global foi aplicado.

No E2E local, a primeira execução marcou 29/31: um timeout do teste que navega 18 combinações de viewport em 30 s, e um seletor `getByRole("alert")` ambíguo entre a mensagem OAuth e o anúncio do Next. O timeout mostrava a PDP ainda em skeleton, sem falha de overflow. O teste passou a ter 90 s e o seletor foi restringido a `#auth-stage-error`; ambos passaram isoladamente.

A repetição completa executou 34 casos: 33 passaram e um teste de navegação animada falhou intermitentemente, lendo `/loja` enquanto a captura já mostrava a página Conta. Esse mesmo caso passou na execução isolada seguinte. Portanto, houve sucesso observado em todos os 34 casos, mas a suíte completa ainda apresentou uma flutuação não reproduzida; não a declaro determinística.

## 5. Variáveis e segurança do ambiente novo

Foram lidos somente nomes/escopos; valores mascarados não foram revelados.

Projeto escolhido, Production + Preview: `APP_ENV`, `APP_URL`, `INTEGRATION_MODE`, `CATALOG_SOURCE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_EXPECTED_COLLECTOR_ID`.

Somente Production no escolhido: variáveis da integração Supabase `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` e nomes `POSTGRES_*` observados na UI. Não foram copiados valores da landing.

Higiene do candidato: não há arquivos `.env*`, vínculo `.vercel` ou `.git` próprios; `SUPABASE_SECRET_KEY` não estava no ambiente do processo e não foi fornecida ao build. O build recebeu somente a URL e a chave publishable públicas do Supabase TEST. A varredura independente da fonte apontou três ocorrências em fixtures de teste chamadas `variantKey`; foram classificadas como falsos positivos, sem segredo real. A pasta `tests` também está excluída do upload pelo `.vercelignore`.

O z28b contém os dez nomes comuns acima e ainda `MP_ENV`, `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI`, `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATION_KEY_VERSION`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, `QUOTE_SIGNING_SECRET`, `SENTRY_DSN`, em Production + Preview.

Não se presume que as credenciais remotas sejam TEST ou live. Antes de deploy, separar Preview de Production, comprovar URL/chaves do TEST `qsafyqsskwbjnailgoev` e excluir credenciais financeiras/ERP do Preview. Não basta definir flags que o código não consome.

Não existe implementação de checkout, criação de pedidos ou pagamento no código revisado. `INTEGRATION_MODE=mock` não é um guard de pagamento. Não foram implementados recursos financeiros nesta recuperação. Logística usa especificamente `SUPABASE_SECRET_KEY`, server-only; uma service role com outro nome não a substitui. Essa chave não estava presente no escopo Preview observado e não foi transferida nesta tarefa.

Revisão de segurança somente leitura no TEST: RLS nas 25 tabelas public/private examinadas; uma membership administrativa; nenhuma das 23 RPCs administrativas permite execução anônima; criação privilegiada de cotação não está concedida a clientes; bucket privado. Esses checks não homologam sessão, carrinho ou cotação reais no Preview.

## 6. Arquitetura recomendada e bloqueios

Escolha recomendada: reutilizar `imperio-sofas` na equipe nova e preparar **Preview manual a partir do snapshot revisado, sem push**. A landing antiga permanece no deployment atual e nenhum alias oficial participa desse fluxo. Os dois projetos novos duplicam a tentativa principal; não há motivo funcional comprovado para ambos nesta homologação, mas nenhum deve ser excluído automaticamente.

Branches distintas não isolam a automação antiga; repositórios separados aumentam manutenção e exigiriam aprovação própria. O upload manual permite separar os sistemas sem mudar o GitHub ou o projeto antigo.

Bloqueios antes do primeiro upload:

1. O conector Vercel lista a equipe correta, mas retorna zero projetos e 404 para o ID confirmado na UI. A sessão Brave do proprietário está autenticada e abriu as configurações do projeto e da proteção; a CLI oficial 60.1.3 continua sem sessão autenticada. Não foram lidos arquivos de autenticação nem criado token.
2. Confirmar uso/plano: equipe está em Hobby; a documentação limita Hobby a uso pessoal não comercial. Não se assumiu isenção para um Preview empresarial privado. Nenhuma contratação Pro ou adicional foi autorizada/executada. Pro deve ser uma decisão comercial do proprietário, com valores confirmados no painel antes de contratar.
3. Comprovar env TEST do deployment e excluir as credenciais financeiras/ERP de seu escopo. Nenhuma variável remota foi alterada nesta tarefa.
4. A UI atual confirma Require Log In ligado em Standard Protection, sem exceções de domínio listadas e sem segredo de bypass configurado. Password Protection está desabilitado; o painel informa Pro e US$ 20 por projeto/mês. Não foi contratado. Após uma publicação de Preview autorizada, testar URL anonimamente. Para aliases de produção do projeto de testes, avaliar All Deployments; não foi ativado nem cobrado nada.
5. Só considerar upload após decidir a elegibilidade do plano e comprovar que as variáveis Preview usam TEST e não permitem integração financeira/ERP live.

Comando futuro, apenas depois dos gates e de conferir o projeto pela CLI autenticada:

```powershell
vercel project inspect prj_H9gOf0Dcv0yv6tTXP5uusx99QNAg --scope imperio-sofas --non-interactive
vercel deploy <snapshot-revisado> --project prj_H9gOf0Dcv0yv6tTXP5uusx99QNAg --scope imperio-sofas --target preview --non-interactive
```

Não executar `--prod`, promoção, rollback, alteração de aliases ou push. Build verde não libera as funcionalidades operacionais. Uploads grandes e exportações XLSX também precisam de validação nos limites reais de Functions; não foram homologados por este build.

## 7. Resend, DNS e redirecionamento de autenticação

O painel Resend autenticado exibiu `imperiosofas.com.br` como **Verified** nesta investigação. DNS atual: NS `b.sec.dns.br`/`c.sec.dns.br`; TXT DKIM `resend._domainkey` presente; CNAME `send` para `send.forge.rmta.net`; CNAME `rsend` para `rsend-sae1.forge.rmta.net`; TXT `_dmarc` presente. Não foi proposta adição de um segundo SPF na raiz: seguir os registros específicos exigidos pelo provedor. Não se alterou nenhum registro.

Supabase TEST SMTP: custom SMTP habilitado, host `smtp.resend.com`, porta `465`, sender name `Império Sofás`, remetente configurado e senha armazenada oculta. O valor completo do remetente/username foi redigido pela superfície; não foi contornada essa proteção. Nenhum envio foi disparado nesta investigação. A captura anterior do proprietário comprovava recebimento, mas não é um novo teste ponta a ponta.

**Origem comprovada do redirect quebrado:** em URL Configuration, o Site URL ainda é `https://imperio-sofas-imperio-sofas.vercel.app/`. A lista permite essa raiz, `/**`, dois padrões antigos Vercel e somente os callbacks locais de `127.0.0.1:3100`. Não contém a origem local 3105 nem o futuro Preview. O próprio painel informa que destino ausente/não autorizado usa o Site URL. Esse domínio antigo não é o domínio atual do projeto novo escolhido.

Procedimento seguro após existir um Preview protegido:

1. Manter o domínio Verified e SMTP atuais; não reconfigurar DNS da landing.
2. Confirmar remetente no domínio verificado e chave Resend de envio armazenada exclusivamente no SMTP TEST.
3. Autorizar o callback exato do Preview no Auth TEST e ajustar Site URL para a aplicação de testes aprovada, nunca para a landing sem callback. Para ensaio local, autorizar separadamente a origem/porta realmente usada.
4. Conferir template de confirmação: o padrão `ConfirmationURL` respeita o redirect fornecido e autorizado; templates token_hash precisam corresponder ao handler implementado. Não houve edição de template nesta tarefa.
5. Solicitar novo e-mail a partir da aplicação correta, sem reutilizar códigos antigos; testar entrega, confirmação e sessão na mesma origem. Nenhum código/token deve ir ao relatório.

Resend pode enviar e-mails independentemente da hospedagem do e-commerce. A conclusão do cadastro por link depende de um callback funcionando e autorizado. A verificação de DNS não corrige Site URL nem cria deployment.

## 8. Preservação, validação e veredito

Landing antes e depois: HTTP 200, HTML 3270 bytes, SHA-256 `6DD3398AE9C707CED66D887A0FF9EF4F8A6FF67D421FCBDB11DA072CC5EAB5AA` em ambas as verificações. A resposta pública atual é byte-idêntica à observada no início.

O projeto Vercel da landing e sua configuração remota não foram alterados. A correção local foi aplicada também à fonte atual `codex/logistics-foundation`, preservando suas mudanças preexistentes; nenhum commit foi criado. Nenhum domínio, DNS, SMTP, produto, estoque, preço, MFA, migration remota, GitHub main ou permissão foi alterado. Não houve push, deployment nem contratação.

```text
ROOT_CAUSE=EMPTY_APP_URL_CAUSES_ERR_INVALID_URL_IN_LAYOUT
GITHUB_TRANSFER_CAUSAL=NO_FOR_THE_OBSERVED_BUILD_FAILURE
OLD_LANDING_STATUS=READY_AND_HTTP_200
OLD_LANDING_MODIFIED=NO
OFFICIAL_DOMAIN_MODIFIED=NO
DNS_MODIFIED=NO
OLD_LANDING_PROJECT_IDENTIFIED=YES
OLD_LANDING_DEPLOYMENT_READY=YES
OLD_LANDING_PROTECTED_FROM_CHANGES=YES_OPERATIONAL_READ_ONLY; GIT_AUTODEPLOY_STILL_CONNECTED
NEW_PROJECT_ISOLATED=YES_PROJECT_AND_DOMAINS; NO_GIT_PUSH_ISOLATION
NEW_VERCEL_PROJECT=imperio-sofas/prj_H9gOf0Dcv0yv6tTXP5uusx99QNAg
NEW_VERCEL_BUILD=HISTORICAL_ERROR; LOCAL_CANDIDATE_BUILD=PASS; NO_NEW_REMOTE_BUILD
NEW_VERCEL_PREVIEW=NOT_CREATED_BLOCKED_BY_PLAN_AND_ENV_ISOLATION
NEW_VERCEL_ACCESS_PROTECTION=STANDARD_CONFIGURED_NO_EXCEPTION_OR_BYPASS; NEW_DEPLOYMENT_EFFECTIVENESS_UNVERIFIED
SUPABASE_TARGET=TEST_ONLY
RESEND_DOMAIN_STATUS=VERIFIED_IN_AUTHENTICATED_DASHBOARD
RESEND_BLOCKERS=AUTH_CALLBACK_DESTINATION_AND_ALLOWLIST; NO_NEW_DELIVERY_TEST
GIT_PUSH=NO
DEPLOYMENT_PERFORMED=NO
REMOTE_PROJECT_SETTINGS_CHANGED=NO
LOCAL_FIX_APPLIED_TO_SOURCE=YES
SOURCE_BRANCH=codex/logistics-foundation
LOCAL_COMMIT_CREATED=NO
LOCAL_TYPECHECK=PASS
LOCAL_LINT=PASS_WITH_2_EXISTING_IMG_WARNINGS
LOCAL_SOURCE_TREE_BUILD=NOT_RUN; ISOLATED_CANDIDATE_BUILD=PASS
FOCUSED_APP_URL_TESTS=8/8_PASS
LOCAL_E2E=34_CASES; FULL_RUN_33/34; REMAINING_NAVIGATION_CASE_PASS_ON_ISOLATED_RERUN; FLAKY
TARGETED_FORMAT=PASS; GLOBAL_FORMAT=84_PREEXISTING_FILES
NEXT_ACTION=VERIFY_TEST_ONLY_PREVIEW_ENV_AND_PLAN_ELIGIBILITY_BEFORE_ANY_DEPLOY
```

## Referências oficiais consultadas

- [Vercel: ambientes](https://vercel.com/docs/deployments/environments), [CLI deploy](https://vercel.com/docs/cli/deploy), [GitHub integration](https://vercel.com/docs/git/vercel-for-github).
- [Vercel: Deployment Protection](https://vercel.com/docs/deployment-protection), [preços de proteção](https://vercel.com/docs/deployment-protection/usage-and-pricing), [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines), [Pro](https://vercel.com/docs/plans/pro-plan).
- [GitHub: transferência de repositórios](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository).
- [Resend: SMTP com Supabase](https://resend.com/docs/send-with-supabase-smtp).
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

`ANALYTICS_FASE_2` permanece pendente conforme os relatórios anteriores. Esta investigação não a implementa nem substitui homologação de login, carrinho, frete ou checkout.
