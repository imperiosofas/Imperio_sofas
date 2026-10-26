# Veredito final — hardening do e-commerce

**Data:** 2026-10-14 (revalidação)
**Branch integrada:** `integration/final-hardening`
**HEAD validado antes deste relatório:** `4fd0343` (`fix(db-002): derive cleanup retry readiness in database`)
**Base:** `8af0f47` (`feat: validate atomic cart and stock privacy`)

## Resultado executivo

Nesta continuação, DB-002 foi aplicado somente no projeto Supabase de teste, e os 36 testes pgTAP foram executados contra ele. A prova pelo Storage REST com sessão autenticada continua bloqueada: não foi possível obter uma sessão segura para o usuário temporário; esse usuário e sua membership foram removidos. A suíte E2E completa passou em **31/31** e os testes focados passaram em **18/18**. O `format:check` global continua falhando nos **93 arquivos** de baseline; não houve reformatação em massa.

**FINAL_HARDENING_COMPLETE = NO.** `PERF-001` ainda não tem benchmark autenticado e `DB-002` ainda não tem validação runtime real do Storage. A única mutação remota foi a aplicação das duas migrations DB-002 no projeto de teste declarado pelo proprietário. Nenhum push, deploy, alteração de MFA ou ação de billing foi realizada.

## CLOSED

Findings herdados do baseline `8af0f47`, revalidados nesta rodada — não são implementações novas desta etapa:

- `DEP-001` — atualização da fundação para Next.js 16.3.8.
- `TEST-001` — suíte E2E determinística; execução final desta rodada passou em 31/31.
- `NAV-001`, `NAV-002`, `AUTH-001` — comportamento de navegação/loading/autenticação já integrado.
- `DB-001` — histórico local de migrations alinhado; sem reparo ou mutação remota nesta rodada.
- `DATA-001` — privacidade do estoque na loja.
- `CODE-001` — incremento atômico do carrinho.
- `CODE-002` — segurança/idempotência do dry-run do importador.

`PERF-002` encerrou como **NO_CHANGE_RECOMMENDED** após investigação somente de leitura: com 51 produtos e 71 variantes, as medições atuais não justificam alteração de SQL ou índices. Não é uma garantia de escala futura.

## INTEGRATED

- `LAT-001` — imagens secundárias decorativas são adiadas para dispositivos com hover e ponteiro fino; comportamento visual desktop foi preservado. Em três amostras locais, os elementos de imagem dos dez primeiros cards passaram de 17 para 10, e as requisições assinadas observadas na página de 19 para 12. Revisões de código, segurança e performance aprovadas com ressalvas: bytes exatos indisponíveis, causalidade por requisição não provada e diferença de LCP inconclusiva.
- `DEP-002` — `sharp` atualizado para 0.35.5 e evidência de auditoria registrada. A auditoria ainda reporta vulnerabilidades independentes do `sharp`; não são apresentadas como corrigidas.
- `ARCH-001` — a landing usa dados comerciais dos produtos publicados no catálogo Supabase sem refazer seu layout/motion. Falhas parciais preservam cards válidos; drafts, produtos indisponíveis e itens sem preço/mídia são omitidos. Ressalvas: o manifesto completo da fonte antiga não estava disponível para rehash nesta worktree e o E2E local não dispõe de fixture Supabase publicada.
- `DB-002` — limpeza recuperável de imagens com fila paginada, autorização administrativa, tentativas com backoff e confirmação server-side da ausência do objeto. As migrations foram aplicadas ao Supabase TEST como versões `20261014140637` e `20261014141259`; o pgTAP remoto passou em **36/36**. A versão `20261014141259` corrige o cursor da paginação, descoberto por teste. Falta prova por Storage REST com sessão admin real; veja `BLOCKED_ENVIRONMENT`.
- Auditoria de dependências: `source-map-js` foi atualizado dentro da faixa compatível para **1.2.2**, e as ferramentas `eslint`, `eslint-config-next` e `prettier` foram movidas de `dependencies` para `devDependencies`. Resultado atual: `npm audit --omit=dev` sem advisories; `npm audit` ainda aponta **22 pacotes** vulneráveis somente no conjunto de desenvolvimento/teste.
- `ENV-001` — configuração de ambiente explícita, com exigência de `APP_ENV=production` e execução separada de `npm run check:production` no ambiente de produção.
- Acessibilidade — corrigidos apenas os dois contrastes reproduzidos em localização e rodapé, preservando layout e motion. Teste Axe final não encontrou violações nas rotas `/`, `/loja` e `/conta`.

## APPROVED_NOT_INTEGRATED

Nenhuma mudança aprovada ficou aguardando integração nesta rodada. `PERF-002` é uma conclusão de não alteração, não um patch pendente. Os itens bloqueados abaixo não devem ser tratados como aprovados para aplicar.

## BLOCKED_OWNER

- `SEC-001` — proteção contra senhas vazadas requer plano Supabase Pro ou superior. O estado atual é Free. É necessária decisão/ação do proprietário sobre plano; nenhuma configuração de Auth ou MFA foi alterada.

## BLOCKED_ENVIRONMENT

- `DB-002 runtime` — pgTAP remoto passou, mas o fluxo real de upload/list/remove/confirm foi **BLOCKED_ENVIRONMENT**. Uma conta TEST criada para a tentativa não conseguiu autenticar pela API; ela e a membership foram apagadas e não houve fixture de produto/mídia. Não se contornou Auth nem se usou chave privilegiada.
- `PERF-001` — **BLOCKED_ENVIRONMENT**: a tentativa autorizada de criar sessão admin de teste não conseguiu autenticar. Revisão estática confirma que `/admin/produtos` carrega todos os produtos, variantes, inventário e mídia, assina thumbnails e faz busca/filtro/sort/paginação no cliente; portanto não foi recomendado “não mudar” sem medir. Nenhuma sessão ou dado privado foi contornado.
- `BUNDLE-001` — medição de impacto por rota não concluída porque a instalação de dependências na worktree candidata não estava disponível durante a coleta. Nenhuma otimização foi inferida sem medição.

## DEFERRED

- `DOC-001`, `DX-001`, `CODE-004` — documentação geral, melhorias de DX e helper de código adiados; não eram necessários para a integração segura dos findings aprovados.
- Escalabilidade do catálogo além do volume observado — reavaliar com tráfego e cardinalidade representativos; os números atuais não predizem 5.000 produtos.
- `format:check` global — continua falhando em **93 arquivos preexistentes**. O baseline limpo `8af0f47` também falhava em arquivos preexistentes; somente arquivos tocados nesta rodada foram formatados/verificados, sem reformatação global.

## Gates e validação final

| Verificação                   | Resultado               | Evidência / ressalva                                                                                 |
| ----------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run typecheck`           | **PASS**                | Reexecutado nesta continuação.                                                                       |
| `npm run lint`                | **PASS**                | Zero erros; dois avisos `@next/next/no-img-element` em `StorePhoto.tsx` e `Catalog.tsx`.             |
| `npm run format:check`        | **FAIL — preexistente** | Os mesmos 93 arquivos de baseline; sem reformatação global.                                          |
| `npm run build`               | **PASS**                | Next.js 16.3.8; executado nesta continuação.                                                         |
| `npm run test:e2e`            | **PASS — 31/31**        | Local, sem sessão/dados Supabase autenticados.                                                       |
| Testes focados Node           | **PASS — 18/18**        | Cleanup Storage, catálogo da landing e runtime config.                                               |
| pgTAP DB-002 no Supabase TEST | **PASS — 36/36**        | Executado via SQL no projeto de teste; transação revertida, sem resíduo.                             |
| `git diff --check`            | **PASS**                | Nenhum erro de whitespace.                                                                           |
| Storage REST runtime DB-002   | **BLOCKED_ENVIRONMENT** | Sem sessão admin de teste válida; fixtures temporárias limpas.                                       |
| `npm audit --omit=dev`        | **PASS — 0**            | Após classificar tooling como dev e atualizar `source-map-js`.                                       |
| `npm audit`                   | **22 advisories**       | 2 low, 4 moderate, 16 high, todos em dependências dev/test; sem fix seguro dentro das faixas atuais. |

## Revisão de segurança

- **Ações administrativas/destrutivas:** a fila de limpeza e suas ações exigem autorização admin no servidor; a migration mantém o ledger privado/RLS, restringe execução e não fornece exclusão arbitrária por caminho. O fluxo não expõe paths de Storage na listagem administrativa e a conclusão verifica o estado do objeto no servidor. Aprovação independente com ressalvas; grants/runtime ainda precisam de validação local antes da aplicação da migration.
- **Credenciais Supabase:** `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` não apareceram no bundle cliente. O uso privilegiado permanece em código/scripts server-side; a chave não foi lida, revelada, versionada nem passada ao browser. `.env.local` permanece ignorado pelo Git.
- **Imagens e consultas:** o bucket `catalog-images` segue privado e as URLs assinadas foram preservadas. `LAT-001` reduz a montagem/requisição das imagens decorativas em touch. A PLP usa chamadas em lote; não foi encontrado N+1 por produto no caminho analisado. Medições SQL atuais são pequenas amostras do catálogo de 51 produtos, não um teste de carga ou promessa de escala.
- **DB-002:** Storage segue privado; RLS está ativo na outbox; `anon` não pode ler a outbox nem invocar list/remove; `authenticated` pode invocar as RPCs, que mantêm guarda admin. Os testes verificaram path inválido, produto alheio, backoff, retry, ausência e paginação. A prova real do Storage REST segue pendente.
- **Catálogo/carrinho:** acesso direto público a `inventory` é negado; RLS limita o acesso autenticado e há políticas de ownership para `carts` e `cart_items`.
- **Credenciais:** não foi usada nem lida chave privilegiada. O scan do bundle encontrou apenas a string literal de prefixo `sb_secret_` usada por código cliente para reconhecer o formato; não encontrou valor completo de token nem nomes de variáveis privilegiadas. `SERVICE_ROLE_CLIENT=NO`.
- **Dependências:** o `npm audit --omit=dev` está limpo. O audit completo mantém advisories de Lighthouse CI (`basic-ftp`, `extract-zip`, `sprintf-js`, `tmp`, `uuid`) e do encadeamento `eslint-config-next`/`braces`; os fixes propostos exigem upgrade major/downgrade incompatível ou não oferecem uma correção segura. São tooling de desenvolvimento, não runtime da aplicação. O advisory do `@modelcontextprotocol/sdk` foi fechado atualizando para a versão compatível corrigida.

## Estado operacional e limites

```text
FINAL_HARDENING_COMPLETE=NO
BRANCH=integration/final-hardening
FINAL_HEAD=72a0ad0 (working tree com alterações locais; nenhum commit novo)
PUSH=NO
DEPLOY=NO
VERCEL=OUT_OF_SCOPE
REMOTE_SUPABASE_MUTATION=YES (somente migrations DB-002 no Supabase TEST autorizado)
MFA=NOT_TOUCHED
DB002_MIGRATION_APPLIED=YES (TEST)
DB002_PGTAP=PASS (36/36)
DB002_STORAGE_RUNTIME=BLOCKED_ENVIRONMENT
PERF001=BLOCKED_ENVIRONMENT
LAT001=IMPROVED_STRUCTURALLY (sem fechamento de LCP causal)
MIGRATION_HISTORY_ALIGNED=YES (25 local / 25 remoto)
```

O project ref consultado coincide com o projeto que o proprietário identificou como TEST/DEV. A variável local `DATABASE_ENVIRONMENT=TEST` não estava definida; portanto, a classificação TEST é uma declaração do proprietário vinculada ao ref, não uma confirmação por variável local.

O worktree principal `integration/audit-remediation` foi preservado sem alterações desta continuação. Arquivos temporários ignorados, como `.next-e2e`, não foram removidos. O diretório `supabase/.temp/` preexistente no worktree principal também foi preservado.

### Próximos passos seguros

1. Disponibilizar uma forma segura de autenticar um usuário admin de teste para validar o fluxo real DB-002 com a API do Storage; não é necessário Docker.
2. O proprietário decidir se deseja habilitar o plano necessário para `SEC-001`.
3. Fornecer uma sessão admin de teste válida (ou mecanismo oficial de criar usuário sem e-mail externo) para medir `PERF-001`; o caminho atual não usa paginação/filtros server-side.
4. Tratar os advisories restantes e os itens `DOC-001`/`DX-001`/`CODE-004` em tarefas próprias.

## Revalidação LAT-001 (390 × 844, Fast 3G, CPU 4×)

Cinco amostras foram coletadas na build local de produção. Como o repositório local usa catálogo vazio/rascunhos e não recebeu credenciais públicas para consultar o catálogo de teste, **nenhuma amostra teve cards de produto**; estas métricas não são uma comparação direta com o baseline de 11,3 s / 19 imagens:

| Métrica local (p50, n=5) |                         Resultado |
| ------------------------ | --------------------------------: |
| LCP                      |                          1.576 ms |
| Imagem LCP               |     `wagner-boas-vindas-480.webp` |
| Load                     |                          2.697 ms |
| Requisições de imagem    |                                 4 |
| Bytes de imagem          | 55.702 bytes via `Content-Length` |
| Cards de produto         |                                 0 |

A classificação fica **`LAT001=IMPROVED_STRUCTURALLY`**, apoiada pela comparação anterior de três recargas com o mesmo catálogo (19→12 requisições de imagem assinadas; elementos de imagem dos dez primeiros cards 17→10). A revalidação atual confirma renderização local, mas não prova delta causal de LCP ou bytes do catálogo remoto.

## Advisories residuais (npm audit completo)

`npm audit --omit=dev`: **0**. `npm audit`: **22 pacotes afetados** (2 low, 4 moderate, 16 high), todos em tooling dev/test. `source-map-js` foi atualizado para 1.2.2; eslint, eslint-config-next e prettier agora são `devDependencies`. Os advisories restantes e sua aplicabilidade:

| Advisory                                                                                                                                           | Pacote vulnerável                              | Severidade / dependência    | Reachable no runtime? | Aplicável à aplicação?                               | Fix / risco                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- | --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r)                                                                           | `basic-ftp` (cadeia Lighthouse CI)             | High / transitiva dev       | Não                   | Não no runtime; risco restrito ao tooling Lighthouse | Fix sugerido exige trocar/major do `@lhci/cli`; não aplicar automaticamente.                 |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)                                                                           | `braces` → `micromatch` → `fast-glob` (ESLint) | High / transitiva dev       | Não                   | Não no runtime; risco restrito ao lint/build tooling | npm sugere `eslint-config-next@14.2.35`, downgrade incompatível com Next 16; sem fix seguro. |
| [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv), [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) | `extract-zip` (Puppeteer/Lighthouse CI)        | High / transitiva dev       | Não                   | Não no runtime; tooling de auditoria                 | Fix vinculado a upgrade incompatível do LHCI; upgrade adiado.                                |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)                                                                           | `sprintf-js` (Lighthouse CI)                   | Moderate / transitiva dev   | Não                   | Não no runtime                                       | Sem correção segura sem trocar/major do tooling.                                             |
| [GHSA-52f5-9888-hmc6](https://github.com/advisories/GHSA-52f5-9888-hmc6), [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | `tmp` (Lighthouse CI)                          | Low + High / transitiva dev | Não                   | Não no runtime                                       | Fix requer atualização major/substituição da cadeia LHCI; adiado.                            |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                           | `uuid` (Lighthouse CI)                         | Moderate / transitiva dev   | Não                   | Não no runtime                                       | Fix sugerido acompanha troca/major do LHCI; adiado.                                          |

O inventário completo de pacotes transitivos afetados inclui `@lhci/cli`, `@lhci/utils`, `@puppeteer/browsers`, `argparse`, `external-editor`, `get-uri`, `inquirer`, `js-yaml`, `lighthouse`, `pac-proxy-agent`, `proxy-agent` e `puppeteer-core`, além dos pacotes listados acima. Não foi usado `npm audit fix --force`.
