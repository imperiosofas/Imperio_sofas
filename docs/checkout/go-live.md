# Checkout: status e checklist de go-live

## Pronto (staging, TEST Supabase)
- Pedidos, grupos por fornecedor, reserva de estoque, expiração, máquina de estados (migration `20261028120000`, 51 checagens em `supabase/tests/orders_checkout.sql`).
- Páginas: `/checkout`, `/pedido/[id]`, `/conta/pedidos`, `/admin/pedidos` (+ detalhe), KPIs na Visão geral.
- Pagamento: provedor `mock` (staging/local) e Mercado Pago Checkout Pro (código + testes unitários; NÃO testado contra a API real).
- Webhook `/api/webhooks/mercadopago` (assinatura HMAC, valor exato conferido) e cron `/api/cron/expire-orders` (Bearer `CRON_SECRET`).
- Kill switch: `commerce_settings.checkout_enabled` (deixar `false` até tudo abaixo estar fechado).

## Falta antes de vender de verdade
1. Conta Mercado Pago do cliente: credenciais sandbox → testar webhook de ponta a ponta → credenciais live (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_ENV`, `MP_EXPECTED_COLLECTOR_ID`, `INTEGRATION_MODE=live`, `APP_ENV=production`).
2. `CRON_SECRET` (≥32 caracteres) e agendamento do cron de expiração.
3. Revisão jurídica da Política de Privacidade (texto redigido com base no que o sistema coleta; os Termos e a política de Trocas vêm do texto do cliente). Registrar o aceite dos termos no pedido (hoje só é exigido no checkbox).
4. ~~Política de frete misto~~ decidida: um frete por fornecedor, adicional por andar uma vez por endereço (migration `20261102120000`, precisa ser aplicada em cada banco).
5. Fiscal / Bling (NF-e) e dados fiscais.
6. Plano Vercel Pro, projeto Supabase de produção, domínio.
7. Os 13 produtos legados ausentes e os 8 inativos publicados; WhatsApp oficial; validade da cotação (24 h, definida na mesma migration).
8. E-mails de pedido (Resend API ainda não configurada).
