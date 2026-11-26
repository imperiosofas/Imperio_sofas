# Plano de rollback — lançamento Império Sofás

Objetivo: qualquer problema no lançamento é revertido em minutos, sem perder
pedidos nem pagamentos. Ordem: do mais leve (parar vendas) ao mais pesado (voltar o
domínio para a landing).

## 1. Interruptores rápidos (sem deploy)

| Situação                                  | Ação                                                                                                       | Efeito                                                                                                                     | Tempo    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Problema em pagamento, estoque ou pedidos | SQL Editor (produção): `update public.commerce_settings set checkout_enabled = false, updated_at = now();` | Novos pedidos bloqueados no banco e aviso "pagamento não liberado" no checkout. Loja, conta e pedidos existentes continuam | imediato |
| Produto com erro (preço, foto)            | `/admin/produtos` → voltar para rascunho/arquivar                                                          | Produto some da loja. A foto pode continuar acessível por até 60 min no cache (documentado)                                | imediato |
| Webhook falhando                          | Nada a desligar: o Mercado Pago reenvia; corrigir e os eventos pendentes são aplicados (idempotente)       | —                                                                                                                          | —        |

## 2. Voltar a versão do código (projeto Vercel de produção)

- **Instant Rollback / Promote** de um deploy anterior no painel da Vercel (Deployments
  → deploy anterior → Promote/Rollback). Não exige build.
- No **primeiro** lançamento não existe deploy anterior da loja: a volta é o passo 4
  (domínio de volta para a landing) ou o passo 1 (desligar o checkout).
- Mudança de variável de ambiente só vale depois de um novo deploy (Redeploy).

## 3. Banco de dados

- Migrações só avançam ("forward-only"). Nunca editar uma migração já aplicada.
- Antes do lançamento o banco está vazio: falhou a migração → recriar o projeto.
- Depois do lançamento: não apagar dados. Corrigir com nova migração testada no TESTE
  e no CI. Para desastre: restauração por backup/point-in-time do Supabase (confirmar
  que o plano inclui isso — `PRODUCTION_SETUP_RUNBOOK.md` §3.1).
- Pedidos e pagamentos nunca são apagados para "desfazer": usar cancelamento,
  estorno pelo Mercado Pago e as ações do admin.

## 4. Voltar o domínio para a landing

Só se a loja inteira precisar sair do ar.

1. Antes do corte, **anotar** a configuração do domínio na conta da landing
   (projeto, registros, redirecionamentos) — `PRODUCTION_SETUP_RUNBOOK.md` §10.
2. Remover o domínio do projeto da loja e adicioná-lo de volta ao projeto da landing
   (a landing não é apagada nem alterada no lançamento).
3. Se o DNS estiver fora da Vercel, restaurar os registros anotados.
4. Conferir a landing no domínio (HTTPS).
5. Pedidos já pagos continuam no Supabase e no admin (acessível pela URL
   `*.vercel.app` do projeto da loja) e os webhooks continuam chegando se a URL do
   webhook apontar para um endereço que segue ativo — por isso, durante o rollback,
   **trocar a URL do webhook do Mercado Pago para a URL `*.vercel.app` do projeto**.

## 5. Credenciais

- Chave vazada ou suspeita: gerar nova no painel do serviço (Supabase, Mercado Pago,
  Resend), atualizar na Vercel, Redeploy, revogar a antiga.
- `CRON_SECRET` e `MP_WEBHOOK_SECRET` trocados exigem Redeploy (e, no webhook, salvar a
  nova assinatura no Mercado Pago).

## 6. Quem decide e quem executa

| Ação                 | Decide         | Executa                |
| -------------------- | -------------- | ---------------------- |
| Desligar checkout    | Você           | Você (SQL Editor)      |
| Rollback de deploy   | Você           | Você (Vercel)          |
| Voltar o domínio     | Você + Cliente | Você                   |
| Estorno de pagamento | Cliente        | Cliente (Mercado Pago) |
