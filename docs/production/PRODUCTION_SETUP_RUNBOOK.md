# Runbook de produção — Império Sofás

Versão do código validada no staging: **`ec407a9`** (funcional) + commits posteriores
que só mudam scripts de verificação, testes e documentação — exceto a correção de
e-mail em pagamento tardio (ver `PRE_LAUNCH_AUDIT.md` §5), que precisa ser validada no
staging antes do lançamento.

Regra geral: **nenhum passo deste documento foi executado em produção.** Segredos são
colados pelo dono da conta direto no painel de cada serviço.

## 0. Tipos de tarefa

| Sigla          | Significado                                                     |
| -------------- | --------------------------------------------------------------- |
| **AGORA**      | pode ser feito já, sem acesso a produção nem decisão do cliente |
| **ACESSO**     | exige acesso às contas (Vercel, Supabase, Resend, GitHub)       |
| **CLIENTE**    | exige decisão ou aprovação do cliente                           |
| **CRED**       | exige credenciais reais de produção                             |
| **LANÇAMENTO** | só no dia, na janela de lançamento                              |

## 1. Contas e acessos necessários

| Conta                                                 | Para quê                                | Quem           | Tipo               |
| ----------------------------------------------------- | --------------------------------------- | -------------- | ------------------ |
| GitHub `imperiosofas/Imperio_sofas`                   | avançar `main` para a versão validada   | Você           | ACESSO             |
| Vercel — time que vai hospedar a loja (**plano Pro**) | projeto de produção, variáveis, domínio | Você           | ACESSO             |
| Vercel — conta pessoal da landing atual               | mover o domínio (corte)                 | Você           | ACESSO, LANÇAMENTO |
| Registro/DNS do domínio `imperiosofas.com.br`         | se o DNS não estiver na Vercel          | Você / Cliente | ACESSO             |
| Supabase — projeto **novo** de produção               | banco, Auth, Storage                    | Você           | ACESSO             |
| Resend                                                | domínio do remetente e chave            | Você           | ACESSO, CRED       |
| Mercado Pago — conta do cliente                       | credenciais e webhook de produção       | Cliente        | CLIENTE, CRED      |

## 2. Sequência de configuração (ordem de execução)

1. **Decisões do cliente** (CLIENTE) — §12 de `PRE_LAUNCH_AUDIT.md`.
2. **Vercel Pro** e alerta de gasto (ACESSO). Motivo: cota de imagens do Hobby
   (`docs/audit/PERF_IMAGES_2026-11-25.md` §7).
3. **Supabase produção** (§3) (ACESSO).
4. **Resend** (§6) (ACESSO, CRED).
5. **Projeto Vercel de produção** + variáveis (§4) (ACESSO, CRED).
6. **Mercado Pago** (§5) (CLIENTE, CRED).
7. **Catálogo e estoque reais** (`CATALOG_IMPORT_GUIDE.md`) (CLIENTE).
8. **Deploy** (§7) e **smoke tests** (§8) (LANÇAMENTO).
9. **Compra real + estorno** (§9) (CRED, LANÇAMENTO).
10. **Ligar o checkout** (§3.7) e **corte do domínio** (§10) (LANÇAMENTO).
11. **Monitoramento** da primeira semana (§12).

## 3. Banco de dados de produção (Supabase)

### 3.1 Criar o projeto (ACESSO)

- Novo projeto, **separado do TESTE `qsafyqsskwbjnailgoev`**. Região: São Paulo
  (`sa-east-1`) se disponível — a Vercel deve usar a região mais próxima (`gru1`).
- Postgres 17 (igual a `supabase/config.toml`).
- Backups / point-in-time recovery conforme o plano.

### 3.2 Conferir o pacote de migrações (AGORA — já conferido)

```
npm run check:migrations
```

Resultado em 2026-11-26: **42 migrações** (`20260924155912_catalog_initial_schema`
→ `20261125130000_payment_event_review_fixes`), 32 tabelas todas com RLS, 84 funções,
26 policies, 18 triggers, 46 índices, job `expire-pending-orders`, bucket
`catalog-images` privado. Reprodutibilidade: o job **database** do CI recria o banco do
zero com todas as migrações e roda os testes de RLS a cada push (verde em `2a5ef00`).

### 3.3 Aplicar as migrações (ACESSO, LANÇAMENTO-1 dia)

Com a Supabase CLI, na pasta do repositório, no commit validado:

```
npx supabase login
npx supabase link --project-ref <ref-producao>
npx supabase migration list          # confere: 42 locais, 0 remotas
npx supabase db push                 # aplica as 42, em ordem
npx supabase migration list          # confere: 42 locais = 42 remotas
```

**Nunca** usar `--include-seed` nem `supabase db reset --linked` em produção: o
`supabase/seed.sql` cria uma categoria e 5 produtos de rascunho de desenvolvimento.

Se uma migração falhar: o projeto ainda está vazio — corrigir e reaplicar, ou apagar
o projeto e recriar. Nunca editar migração já aplicada.

Diferença conhecida: no TESTE as migrações `20261125120000` e `20261125130000`
foram aplicadas pelo SQL Editor, então o histórico do TESTE pode não listá-las.
Não afeta a produção (projeto novo via CLI).

### 3.4 Conferências pós-migração (ACESSO)

No SQL Editor de produção (somente leitura):

```sql
select count(*) from supabase_migrations.schema_migrations;            -- 42
select id, public from storage.buckets where id = 'catalog-images';    -- public = false
select jobname, schedule from cron.job;                                 -- expire-pending-orders */5
select checkout_enabled, payment_window_minutes from public.commerce_settings; -- false, 30
select count(*) from pg_tables where schemaname in ('public','private') and not rowsecurity; -- 0
```

### 3.5 Auth (ACESSO)

| Configuração                                       | Valor                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Email → Confirm email                              | ligado                                                                     |
| Email → Secure password change                     | ligado                                                                     |
| Email → **Require current password when updating** | **ligado** (QA-01)                                                         |
| Minimum password length                            | 8 (igual ao TESTE)                                                         |
| URL Configuration → Site URL                       | `APP_URL` final                                                            |
| URL Configuration → Redirect URLs                  | `APP_URL/**`                                                               |
| SMTP → custom (Resend)                             | host/porta/usuário do Resend; remetente do domínio verificado              |
| Email Templates → Confirm signup / Reset password  | copiar de `supabase/email-templates/confirm-signup.html` e `recovery.html` |
| MFA                                                | opcional (não obrigatório)                                                 |
| Google/Apple                                       | desligados (flags `false`)                                                 |

### 3.6 Administrador (ACESSO, após o dono criar e confirmar a conta no site)

Procedimento em `docs/admin-catalog.md`: inserir o `user_id` da conta **já
confirmada** em `public.catalog_admins` pelo SQL Editor. Não há admin padrão.

### 3.7 Dados operacionais (ACESSO + CLIENTE)

- **Logística**: as migrações já criam os fornecedores `VALE` e `MUNDIAL`, 12 cidades
  atendidas, o ponto de retirada "Galpão Vale" e as regras de andar. Conferir em
  `/admin/entregas` se batem com o que está no TESTE hoje (alterações feitas pelo
  admin do TESTE **não** são copiadas).
- **Catálogo e estoque**: `CATALOG_IMPORT_GUIDE.md`.
- **Checkout**: depois de tudo validado (LANÇAMENTO):
  ```sql
  update public.commerce_settings set checkout_enabled = true, updated_at = now();
  ```
  Este é também o **interruptor de emergência** (voltar para `false` bloqueia novos
  pedidos na hora, sem deploy).
- **Janela de reserva** (`payment_window_minutes`, padrão 30, aceita 5–1440): ajustar
  só se o cliente decidir (ex.: boleto).

## 4. Variáveis de ambiente (ACESSO, CRED)

Tabela completa em `PRODUCTION_ENV_TEMPLATE.md`; modelo em `.env.production.example`.

- Criar um **projeto Vercel de produção separado** do projeto de teste (no projeto
  atual, a branch de produção é `staging` e as variáveis "Production" são as do site de
  teste — não mexer nelas).
- Branch de produção do novo projeto: `main`.
- Região das funções: `gru1` (ou a mais próxima do Supabase).
- `NEXT_PUBLIC_*` como tipo Config.
- Conferência antes do deploy (localmente, com as variáveis exportadas no terminal, sem
  gravar em arquivo): `npm run check:production` → "passou".

## 5. Mercado Pago (CLIENTE, CRED)

1. Conta de produção do cliente ativa e apta a receber.
2. **Suas integrações → aplicação → Credenciais de produção**: Access Token →
   `MP_ACCESS_TOKEN` na Vercel (colado pelo cliente ou por você na frente dele).
3. **Webhooks → modo produção**: URL `https://<APP_URL>/api/webhooks/mercadopago`,
   evento **Pagamentos**; copiar a **assinatura secreta** → `MP_WEBHOOK_SECRET`.
4. `MP_ENV=live`; `MP_EXPECTED_COLLECTOR_ID` = user id da conta que recebe.
5. Meios de pagamento e parcelas conforme decisão do cliente (o código não restringe;
   vale o que estiver configurado na conta).

O que o código já garante (revisado em 2026-11-26): assinatura conferida; o pagamento
é sempre consultado na API do Mercado Pago; moeda BRL; conta recebedora conferida;
valor conferido no banco (divergência → revisão); eventos repetidos não duplicam;
aprovação nunca é rebaixada; pagamento estornado não reabre pedido. `check:production`
recusa token `TEST-`; credenciais de usuário de teste (`APP_USR-`) são barradas pelo
`MP_EXPECTED_COLLECTOR_ID` (pagamento em outra conta nunca marca pedido como pago).

## 6. Resend (ACESSO, CRED)

1. Adicionar o domínio do remetente e criar os registros DNS que o Resend pedir
   (SPF/DKIM; DMARC recomendado). Esperar "Verified".
2. API key com permissão de envio → `RESEND_API_KEY`; `RESEND_FROM_EMAIL` no domínio
   verificado; `STORE_NOTIFY_EMAIL` (opcional).
3. SMTP do Supabase (§3.5) usando o Resend, para e-mails de cadastro/recuperação.
4. Teste (LANÇAMENTO): criar conta → chega confirmação; "esqueci a senha" → chega o
   link; pedido criado → e-mail "pedido recebido"; pagamento aprovado → e-mail ao
   cliente + cópia para a loja.
5. Falhas: o envio de pedido é "melhor esforço" — sem chave ou com erro do Resend, o
   pedido continua normal e o log registra `order-email: ...` (sem dados pessoais).
   Repetições não duplicam (chave de idempotência por pedido e tipo).

## 7. Deploy (LANÇAMENTO)

1. Confirmar que o commit a publicar é o validado no staging (CI verde: quality +
   database).
2. Avançar `main` sem merge (fast-forward; `main` é ancestral de `staging`):
   ```
   git fetch origin
   git push origin <commit-validado>:refs/heads/main
   ```
3. A Vercel do projeto de produção faz o deploy de `main`. Conferir "Ready".
4. Antes do corte de domínio, testar pela URL `*.vercel.app` do projeto de produção.

## 8. Smoke tests (LANÇAMENTO, na URL de produção)

- `/`, `/loja`, uma categoria, um produto (fotos carregam; 2ª visita em cache).
- `/produto/nao-existe` → **404**.
- Cadastro → e-mail de confirmação → login → troca de senha (exige senha atual) →
  "esqueci a senha".
- Carrinho → CEP → checkout (com `checkout_enabled = false` aparece o aviso de
  pagamento não liberado — esperado até §3.7).
- Admin: login, editar produto, enviar foto, ver pedidos.
- `GET /api/cron/expire-orders` sem segredo → 401 (não 503).
- Logs da Vercel sem erros 5xx.

## 9. Pagamento real (dono da conta — CRED, LANÇAMENTO)

Feito por você e pelo cliente; o assistente não faz pagamentos reais. Roteiro em
`docs/audit/PRE_LAUNCH_TESTS.md` §4: compra de valor baixo, conferir pedido pago,
e-mails, estoque baixado, webhook registrado; estornar e conferir "reembolsado";
conferir o dinheiro na conta certa.

## 10. Corte do domínio (CLIENTE, ACESSO, LANÇAMENTO)

1. Combinar o horário com o cliente (de preferência fora do horário comercial).
2. Na conta pessoal da Vercel (landing): **anotar** a configuração atual do domínio
   (projeto, registros DNS, redirecionamentos `www`/raiz). Não apagar o projeto da
   landing.
3. Remover o domínio do projeto da landing e adicioná-lo ao projeto de produção da
   loja (a Vercel não permite o mesmo domínio em dois projetos ao mesmo tempo).
4. Se o DNS estiver fora da Vercel, ajustar os registros que a Vercel indicar.
5. Atualizar `APP_URL`, Site URL/Redirect URLs do Supabase e a URL do webhook do
   Mercado Pago **se** o domínio final for diferente do usado no teste da etapa 8.
6. Conferir HTTPS e repetir o smoke test no domínio final.

## 11. Rollback

Ver `ROLLBACK_PLAN.md`.

## 12. Primeira semana

| O quê                                                   | Onde                                                                   | Frequência          |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| Erros 5xx, logs de `mercadopago webhook`, `order-email` | Vercel → Logs                                                          | diário              |
| Pedidos com alerta (`payment_alert_at`) ou em revisão   | `/admin/pedidos`                                                       | diário              |
| Uso de Image Optimization e gasto                       | Vercel → Usage                                                         | diário na 1ª semana |
| Entregas do Resend (bounces)                            | Resend → Emails                                                        | diário              |
| Webhooks com falha                                      | Mercado Pago → Webhooks → histórico                                    | diário              |
| Estoque vs. vendas                                      | `/admin`                                                               | diário              |
| Job de expiração rodando                                | `select * from cron.job_run_details order by start_time desc limit 5;` | a cada 2–3 dias     |
