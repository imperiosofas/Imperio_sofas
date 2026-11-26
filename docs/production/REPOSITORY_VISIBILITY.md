# Recomendação: tornar o repositório privado

**Situação (26/11/2026):** `github.com/imperiosofas/Imperio_sofas` é **público**
(página e arquivos abrem sem login). Nenhuma alteração de visibilidade foi feita.

## O que está exposto hoje

- Todo o código do e-commerce, incluindo regras de negócio e rotas administrativas.
- Relatórios de auditoria em `docs/audit/` e `docs/production/`, **incluindo achados de
  segurança ainda abertos** (CSP, cookie de sessão, timestamp do webhook).
- Identificador do projeto Supabase TESTE, URL do site de teste, fluxo do webhook,
  procedimentos de administração.
- Metadados de commits (nome e e-mail dos autores).

**Não está exposto:** nenhuma credencial real. Varredura de 116 commits em todas as
10 branches remotas (26/11): só há uma sentinela de teste com formato de chave
(`tests/supabase-secret-key-fetch.test.mjs`), e o valor real da chave secreta do TESTE
aparece 0 vezes no histórico.

## Recomendação

**Tornar privado, mas só depois de a Vercel estar no plano Pro.**

Motivo da ordem: no plano Hobby, a Vercel não faz deploy de repositório **privado de
organização** (relatos na comunidade da Vercel; confirmar na página de planos). O
projeto de staging está num time Hobby ligado a este repositório — se o repositório
ficar privado antes do Pro, **os deploys de staging param**.

## Impactos de tornar privado

| Área                 | Efeito                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel (Hobby)       | deploys bloqueados até migrar para Pro                                                                                                                         |
| Vercel (Pro)         | normal                                                                                                                                                         |
| GitHub Actions       | passa a consumir minutos do plano da organização (Free: 2.000 min/mês). A CI atual gasta ~5–6 min por push → folga                                             |
| Dependabot           | continua funcionando                                                                                                                                           |
| Consultas anônimas   | o status de CI/deploy deixa de ser consultável sem login (as verificações que fizemos pela API pública passam a exigir token)                                  |
| Forks públicos       | não há forks (0)                                                                                                                                               |
| Histórico já público | **continua conhecido**: quem clonou antes mantém a cópia. Por isso a correção dos achados de segurança abertos (SEC2-01..03) não deve depender da visibilidade |

## Procedimento (com sua autorização, depois do Pro)

1. Vercel do time em Pro (pré-requisito).
2. GitHub → repositório → **Settings** → **General** → **Danger Zone** →
   **Change repository visibility** → **Make private** → confirmar digitando o nome.
3. Fazer um push vazio no `staging` e conferir: CI verde e deploy "Ready" na Vercel.
4. Conferir que o projeto pessoal da landing continua **sem** Git (não deve ser
   afetado).

## Proteção de branch (fazer independentemente da visibilidade)

Hoje **nem `main` nem `staging` têm proteção** (página pública de branches:
`protectedByBranchProtections: false`, sem rulesets). Recomendado em
**Settings → Rules → Rulesets → New branch ruleset**:

| Branch    | Regras                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `main`    | exigir pull request; exigir checks `quality` e `database` verdes; bloquear force-push e exclusão; (opcional) exigir 1 aprovação |
| `staging` | bloquear force-push e exclusão; exigir checks verdes ao abrir PR                                                                |

Atenção: com "exigir pull request" no `main`, o avanço do `main` no lançamento
(fast-forward do commit validado) passa a ser feito por PR `staging → main`, o que é
o fluxo desejado.

Permissões dos colaboradores da organização: **NÃO VERIFICADO** (exige login de
administrador). Conferir em **Settings → Collaborators and teams** e deixar escrita
só para quem precisa.

Fontes: comunidade da Vercel —
[deploy de repositório privado de organização no Hobby](https://community.vercel.com/t/unable-to-deploy-from-organizational-private-repository/16334),
[Hobby e organizações](https://community.vercel.com/t/why-cant-hobby-accounts-deploy-from-organizations/10015),
[Hobby e repositório de organização](https://community.vercel.com/t/question-about-github-organization-repository-and-vercel-hobby-plan/1386).
