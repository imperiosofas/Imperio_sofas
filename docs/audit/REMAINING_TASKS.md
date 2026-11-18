# Pendências após a auditoria (atualizado em 18/11/2026)

Tudo aqui depende de alguém de fora do código (dono, contador, jurídico, painéis da Vercel/Supabase/Mercado Pago) ou de uma decisão. Itens marcados **[bloqueia lançamento]** precisam estar resolvidos antes de vender de verdade.

## 1. Infraestrutura e acessos

- **Supabase TEST**: estava pausado em 17/11 e foi reativado no mesmo dia. Projetos gratuitos pausam após dias sem uso — ao voltar a testar depois de uma pausa longa, conferir no painel.
- **[bloqueia lançamento] Aplicar as migrations novas** no banco de teste e depois no de produção, nesta ordem:
  1. `20261105120000_order_marketing_consent.sql` (aplicada no TEST em 17/11)
  2. `20261117120000_audit_hardening_withdrawal_and_review.sql` (aplicada no TEST em 17/11)
     Depois rodar `npm run db:test` (pgTAP, inclui `supabase/tests/audit_hardening.sql`).
- **[bloqueia lançamento] Projeto Supabase de produção**, Vercel Pro (uso comercial; o time `imperio-sofas` está no plano Hobby) e DNS do domínio.
- **CI do GitHub**: todos os commits da `staging` falhavam em duas etapas — checagem de formatação (1 arquivo) e criação do banco do zero (a migration `20261007200642` exigia dados da importação antiga). Corrigido localmente; confirmar verde no próximo push.
- **Supabase Auth (painel) — conferido em 18/11 no projeto TEST:**
  - já está certo: confirmação de e-mail ligada, confirmação na troca de e-mail ligada, limites de taxa configurados, SMTP customizado pelo Resend (`smtp.resend.com`, remetente `no-reply@imperiosofas.com.br`);
  - falta ligar: **senha mínima 8** (hoje 6), **proteção contra senhas vazadas**, **"Secure password change"** e **exigir senha atual na troca** (hoje desligados), CAPTCHA (desligado);
  - **lista de redirecionamento**: tem os curingas `https://imperio-*-sofas-imperio-sofas.vercel.app` e `.../**`. Qualquer projeto da Vercel com nome nesse formato casaria com o padrão; no projeto de produção usar só o domínio final, sem curinga. Site URL atual: `https://imperio-sofas-imperio-sofas.vercel.app/`.
- **Expiração automática de pedidos**: definir `CRON_SECRET` (≥ 32 caracteres) e agendar `/api/cron/expire-orders` a cada 5–10 min. No plano Hobby da Vercel o cron só roda 1×/dia; usar Vercel Pro ou `pg_cron` no Supabase (`select cron.schedule('expire-pending-orders','*/5 * * * *', $$select public.expire_pending_orders();$$);`).
- **Rate limit** no `/api/logistics/cep` e nos POSTs de Server Actions: regra no Vercel Firewall (ex.: 30 req/min por IP no CEP).
- **Variáveis na Vercel** (conferidas em 18/11): existem as do Supabase, `APP_ENV`, `INTEGRATION_MODE`, `CATALOG_SOURCE`, `APP_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`. **Faltam** `CRON_SECRET`, `RESEND_API_KEY` e `MP_EXPECTED_COLLECTOR_ID`. Para produção: `APP_ENV=production`, `INTEGRATION_MODE=live`, `APP_URL` com o domínio final.

## 2. Pagamento (Mercado Pago) — integração pendente

- **[bloqueia lançamento]** Conta verificada, credenciais sandbox → teste ponta a ponta com webhook real → credenciais de produção → uma compra real de valor baixo.
- Definir parcelamento máximo, juros, desconto no PIX e se aceita boleto. Com boleto, a janela de 30 min de reserva não basta: excluir `ticket` na preferência ou aumentar a janela.
- Estorno: hoje é feito no painel do Mercado Pago e registrado no admin ("Registrar estorno"). Integração com a API de estorno é melhoria futura.

## 3. Jurídico e negócio

- **[bloqueia lançamento] E-mails de pedido** (Decreto 7.962, art. 4º, III e IV): o Resend já está pronto (domínio `imperiosofas.com.br` verificado e usado pelo Supabase para os e-mails de conta). Falta o código enviar a confirmação do pedido e do pagamento, e cadastrar uma `RESEND_API_KEY` na Vercel (hoje não existe lá).
- Revisão jurídica: **feita** (informado pelo proprietário em 18/11).
- Dados da empresa: **já estão no projeto** — Av. Cinderela, 2011, Jardim Gurilândia, Taubaté/SP, CEP 12071-500; WhatsApp (12) 99218-0333; galpão Rua Agostinho Abifadel, 35, Terra Nova, CEP 12081-670. O rodapé legal passou a mostrar bairro e CEP.
- Observação: os Termos dizem que o prazo conta "da confirmação do pedido"; o sistema conta da confirmação do **pagamento**. Alinhar um dos dois.
- Encarregado de dados (LGPD art. 41) ou declaração de dispensa como agente de pequeno porte.
- Guarda de logs de acesso por 6 meses (Marco Civil, art. 15): definir fonte e mencionar na política.
- Política de privacidade: citar Vercel/Supabase como operadores, o iframe do Google Maps (cookies do Google), prazos de retenção e que o nome do avaliador é público.
- Consentimento de WhatsApp: tela no admin para ver quem aceitou, opção de revogar em "Minha conta" e versão do texto aceito.
- Exclusão/anonimização de conta (LGPD art. 18): hoje uma conta com pedidos não pode ser apagada (`orders.customer_id on delete restrict`). Definir política de retenção e criar rotina de anonimização.
- CPF: necessário para NF-e (Bling); quando coletar, atualizar a política.
- Confirmar grafia "Vale"/"Valle" e prazo mínimo da Valle.

## 4. Catálogo

- Ocultar os 8–9 produtos sem estoque indicados pelo cliente (confirmar se são 8 ou 9).
- Conferir preço e estoque dos demais antes de abrir.
- Mundial (sob encomenda): avaliar mostrar "Sob encomenda · prazo" em vez de "Disponível".

## 5. Melhorias técnicas registradas (não bloqueiam)

- CSP completa com nonce (`script-src`), depois de testar GSAP/framer-motion e o redirecionamento do Checkout Pro.
- Cookies de sessão `HttpOnly` exigiriam mover as chamadas de auth do navegador para o servidor.
- Upload de imagens direto para o Storage (URL assinada) para reduzir o limite de 11 MB das Server Actions.
- Imagens de produto passam por `unoptimized`: miniaturas baixam o arquivo de 2400 px. Ativar otimização (custo na Vercel) ou transformação do Supabase.
- `@supabase/supabase-js` (~64 KB gzip) carregado em todas as páginas por causa da barra inferior.
- `LogisticsWorkspace.tsx` com 1436 linhas: dividir por painel.
- Código morto apontado pelo knip (componentes de MFA antigos, `env/server.ts`, ~14 MB de imagens não referenciadas).
- Avaliações sem compra e sem filtro de nome ("Império Sofás Oficial").
- Pedido de `create_checkout_order` duplicado em concorrência devolve erro em vez do pedido existente (o banco não duplica).
- Pagamento aprovado em duplicidade e estorno parcial não geram alerta.
- `next=` perdido ao redirecionar subpáginas do admin para o login.
