# Etapa 1 — Segurança e dependências (2026-11-26)

Escopo autorizado: investigar `SUPABASE_JWT_SECRET`, remover `POSTGRES_*` se
comprovadamente desnecessárias, varrer o histórico do Git, tratar vulnerabilidades de
desenvolvimento, revisar proteção de branch, recomendar repositório privado e
documentar 2FA. Sem produção, sem `main`, sem rotação de credenciais, sem planos pagos.
Nenhum valor de segredo foi revelado, copiado ou registrado.

## Resumo

| #   | Item                  | Resultado                                                                                                                                                                                                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `SUPABASE_JWT_SECRET` | Origem: integração Supabase da Vercel (23/09). Não usado pelo código. **Risco real**: no TESTE a chave HS256 antiga ainda é aceita para verificar tokens e as chaves legadas `anon`/`service_role` continuam ativas. Correção proposta (não executada) abaixo |
| 2   | `POSTGRES_*`          | **7 variáveis removidas do staging** (Production do projeto de teste). Comprovadamente sem uso                                                                                                                                                                |
| 3   | Histórico do Git      | **Nenhuma credencial real** em 116 commits, 10 branches remotas                                                                                                                                                                                               |
| 4   | Vulnerabilidades      | **29 → 0** (`npm audit`), produção já era 0. Pacotes do site inalterados                                                                                                                                                                                      |
| 5   | Proteção de branch    | **`main` e `staging` sem proteção**. Recomendação em `REPOSITORY_VISIBILITY.md`; permissões de colaboradores **NÃO VERIFICADAS**                                                                                                                              |
| 6   | Repositório privado   | Recomendado **depois** do Vercel Pro (Hobby não faz deploy de repositório privado de organização) — `REPOSITORY_VISIBILITY.md`                                                                                                                                |
| 7   | 2FA                   | Guia em `ACCOUNT_SECURITY_2FA.md`                                                                                                                                                                                                                             |
| —   | Correção              | A lista de variáveis lida na revisão independente estava truncada; `RESEND_*`, `APP_URL`, `CRON_SECRET` etc. **existem** no staging (valor não verificado). Revisão corrigida                                                                                 |

## 1. `SUPABASE_JWT_SECRET`

**Origem (evidência):** time "Imperio Sofas" → Integrations → **Supabase**, "Updated Sep 23".
Na lista de variáveis do projeto `imperio-sofas`, as gerenciadas pela integração têm o
ícone do Supabase: `SUPABASE_PUBLISHABLE_KEY`, **`SUPABASE_SECRET_KEY`**,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `POSTGRES_*` (removidas), `SUPABASE_URL`,
`SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY` — todas "Added Sep 23", só Production.
Não há banco criado pela Vercel (Storage vazio): é a integração antiga que **liga um
projeto Supabase existente** e copia as variáveis.

**Qual projeto:** **NÃO VERIFICADO diretamente** — revelar qualquer valor exige código
de verificação por e-mail (não solicitado). Evidência indireta forte de que é o TESTE:
`SUPABASE_SECRET_KEY` vem da mesma integração e é a chave que o staging usa com sucesso
no TESTE (webhook do pedido 1019 pago, e-mails/cron usam o mesmo cliente).

**Uso:** nenhum. Busca em todo o repositório (código, scripts, testes, configuração,
função de borda) e no histórico: só aparece o **nome** num documento de investigação.

**Risco real:**

- No TESTE (`Settings → JWT Keys`): chave atual **ECC P-256**; a **HS256 (Shared
  Secret)** antiga está como **"Previous"**, ainda usada para **verificar** tokens.
- `Settings → API Keys → Legacy`: chaves `anon` e `service_role` (JWT) **ativas**
  (opção "Disable JWT-based API keys" disponível).
- Portanto, quem obtiver `SUPABASE_JWT_SECRET` (se for o segredo HS256) pode assinar um
  token `service_role` aceito pelo banco — **acesso total, ignorando RLS**. O mesmo vale
  para **`SUPABASE_SERVICE_ROLE_KEY`** (variável criada à mão em 23/09, também sem uso).
- Exposição: quem tem acesso ao time da Vercel (contas **sem 2FA**) ou a qualquer
  processo que imprima o ambiente (o código não faz isso).
- Escopo: banco **TESTE** (dados de teste). Não há produção ainda — mas o mesmo padrão
  **não pode** ser repetido na produção.

**Nada usa as chaves legadas:** o código e os scripts só leem `SUPABASE_PUBLISHABLE_KEY`/
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` (formato novo); a função
de borda `email-password-mfa` não lê nenhuma; o site não chama funções do Supabase.

### Correção proposta (aguardando autorização — envolve credenciais)

| Passo | O que faz                                                                                                                                                                                                                                            | Impacto no staging                                                                                                | Reversível                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| A     | Vercel staging: apagar `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (todas sem uso). **Manter** `SUPABASE_SECRET_KEY` (usada) e a integração | nenhum (nada lê essas variáveis); vale a partir do próximo deploy                                                 | sim (recriar)                    |
| B     | Supabase TESTE → API Keys → Legacy → **Disable JWT-based API keys**                                                                                                                                                                                  | nenhum esperado (app usa só chaves novas); scripts de QA também                                                   | sim (reabilitar)                 |
| C     | Supabase TESTE → JWT Keys → **revogar** a chave HS256 "Previous"                                                                                                                                                                                     | invalida tokens assinados com o segredo antigo (os de sessão atual são ECC) — pode deslogar sessões muito antigas | **não** (revogação é definitiva) |
| D     | Depois de B/C, o `SUPABASE_JWT_SECRET` deixa de ter efeito mesmo se vazado                                                                                                                                                                           | —                                                                                                                 | —                                |

Ordem recomendada: A → B → testar staging (E2E + webhook) → C. **Não remover a
integração inteira**: ela fornece `SUPABASE_SECRET_KEY`, que o staging usa.

Produção: projeto novo sem integração da Vercel (variáveis cadastradas à mão, só as de
`PRODUCTION_ENV_TEMPLATE.md`), chaves legadas desabilitadas desde o primeiro dia.

## 2. `POSTGRES_*` — removidas

**Prova de não uso:** nenhuma referência a `POSTGRES_URL`, `POSTGRES_PRISMA_URL`,
`POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`,
`POSTGRES_DATABASE` em código, scripts, testes, configuração, `next.config.ts` ou
histórico; o site acessa o Supabase só pela API (supabase-js); não há ORM.

**Ação:** Vercel → `imperio-sofas` (staging) → Environment Variables → excluídas uma a
uma, conferindo o nome no diálogo antes de confirmar. Lista recarregada: 0 `POSTGRES_*`.
A Vercel avisa que a exclusão vale a partir do próximo deploy e que **o segredo continua
válido na origem** até ser desativado lá (a senha do banco não foi trocada — trocar é
rotação, fora desta etapa).

**Não alterado:** nenhuma outra variável, nenhum outro projeto, nada de produção.

## 3. Histórico do Git

- 116 commits, 10 branches remotas (incluindo 7 do Dependabot).
- Padrões buscados: chaves Supabase novas e JWT, tokens Mercado Pago (`APP_USR-`,
  `TEST-`), Resend (`re_`), URLs Postgres com senha, chaves privadas, tokens GitHub,
  AWS, Stripe.
- Única ocorrência: `tests/supabase-secret-key-fetch.test.mjs`, sentinela
  `sb_secret_test_only_never_a_real_credential` (falsa por desenho).
- Valor real da chave secreta do TESTE (comparado localmente, sem imprimir): **0
  ocorrências**.
- Arquivos `.env` versionados: só `.env.example` e `.env.production.example`.
- Observação: os commits públicos mostram nome e e-mail dos autores.

## 4. Dependências

| Momento                          | Total                                 | Altas | Produção |
| -------------------------------- | ------------------------------------- | ----- | -------- |
| Antes                            | 29 (2 baixas, 13 moderadas, 14 altas) | 14    | 0        |
| `npm audit fix` (só compatíveis) | 16                                    | 13    | 0        |
| `@lhci/cli` 0.15.1 → **0.16.1**  | **0**                                 | **0** | **0**    |

- 13 das 14 altas vinham de uma única ferramenta de desenvolvimento, `@lhci/cli`
  (Lighthouse CI, usada só por `npm run lhci`).
- Pacotes do site **inalterados**: `next` 16.4.6, `react`/`react-dom` 19.2.8,
  `@supabase/supabase-js` 2.117.1, `@supabase/ssr` 0.7.0, `zod` 4.6.7, `sharp` 0.35.5.
  Fora da árvore de desenvolvimento, só entrou `@opentelemetry/api` (marcado
  `devOptional`, trazido pelo Lighthouse; o Next só o usa se o rastreamento for ligado).
- Alterações: `package.json` (`@lhci/cli` 0.16.1) e `package-lock.json`.

## 5. Proteção de branch e permissões

Página pública de branches do GitHub (a API estava em limite): `main` e `staging` com
`protectedByBranchProtections: false` e sem rulesets. Recomendações e procedimento em
`REPOSITORY_VISIBILITY.md`. Colaboradores e permissões: **NÃO VERIFICADO** (exige login
de administrador da organização).

## 6–7. Visibilidade e 2FA

`REPOSITORY_VISIBILITY.md` e `ACCOUNT_SECURITY_2FA.md`.

## Regressão

Build local com as dependências atualizadas, banco TESTE:

| Verificação                      | Resultado                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                        | OK                                                                                                                                                                                                                                                                                                                |
| Lint                             | 0 erros                                                                                                                                                                                                                                                                                                           |
| Testes unitários (comando da CI) | 169/169                                                                                                                                                                                                                                                                                                           |
| `check:migrations`               | OK                                                                                                                                                                                                                                                                                                                |
| Build de produção                | OK                                                                                                                                                                                                                                                                                                                |
| E2E QA                           | 92 PASS, 0 FAIL, sem resíduo                                                                                                                                                                                                                                                                                      |
| E2E do repositório               | 1ª execução: 37 PASS, 2 falhas de tempo no servidor de desenvolvimento (`home-motion` e `navigation-auth`: navegação não concluída em 5 s / `ERR_ABORTED` na primeira compilação da rota); as 2 passaram em duas reexecuções isoladas; 2ª execução completa: **39 PASS, 1 pulado (marcado no arquivo), 0 falhas** |
| Lighthouse CI 0.16.1             | healthcheck OK, 3 relatórios gerados                                                                                                                                                                                                                                                                              |

A remoção das variáveis vale no próximo deploy do staging; smoke test após o deploy
desta etapa: **SMOKE**.

## Pendências

| Item                                                                                   | Depende de                                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Passos A–C (chaves legadas, JWT antigo)                                                | sua autorização                                                  |
| Conferir para qual projeto aponta a integração (revelar valor exige código por e-mail) | você                                                             |
| Proteção de branch (`main`/`staging`)                                                  | você (admin do GitHub)                                           |
| Repositório privado                                                                    | Vercel Pro antes                                                 |
| 2FA nas contas                                                                         | você e o cliente                                                 |
| `CRON_SECRET` do staging provavelmente vazio/curto (rota 503)                          | você (opcional; `pg_cron` já expira pedidos)                     |
| Valor de `RESEND_API_KEY` no staging                                                   | NÃO VERIFICADO — será tratado na etapa 2 (homologação de e-mail) |
