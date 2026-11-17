# Pendências após a auditoria (17/11/2026)

Tudo aqui depende de alguém de fora do código (dono, contador, jurídico, painéis da Vercel/Supabase/Mercado Pago) ou de uma decisão. Itens marcados **[bloqueia lançamento]** precisam estar resolvidos antes de vender de verdade.

## 1. Infraestrutura e acessos

- **Supabase TEST**: estava pausado em 17/11 e foi reativado no mesmo dia. Projetos gratuitos pausam após dias sem uso — ao voltar a testar depois de uma pausa longa, conferir no painel.
- **[bloqueia lançamento] Aplicar as migrations novas** no banco de teste e depois no de produção, nesta ordem:
  1. `20261105120000_order_marketing_consent.sql` (aplicada no TEST em 17/11)
  2. `20261117120000_audit_hardening_withdrawal_and_review.sql` (aplicada no TEST em 17/11)
     Depois rodar `npm run db:test` (pgTAP, inclui `supabase/tests/audit_hardening.sql`).
- **[bloqueia lançamento] Projeto Supabase de produção**, Vercel Pro (uso comercial) e DNS do domínio.
- **Supabase Auth (painel)**: senha mínima ≥ 8 com requisitos, proteção contra senhas vazadas, confirmação de e-mail obrigatória, "Secure password change", CAPTCHA em cadastro/recuperação, limites de taxa, **lista de redirecionamento exata sem curingas** (`*.vercel.app` permitiria roubo de conta pela recuperação de senha). Depois de configurar, copiar para `supabase/config.toml`.
- **Expiração automática de pedidos**: definir `CRON_SECRET` (≥ 32 caracteres) e agendar `/api/cron/expire-orders` a cada 5–10 min. No plano Hobby da Vercel o cron só roda 1×/dia; usar Vercel Pro ou `pg_cron` no Supabase (`select cron.schedule('expire-pending-orders','*/5 * * * *', $$select public.expire_pending_orders();$$);`).
- **Rate limit** no `/api/logistics/cep` e nos POSTs de Server Actions: regra no Vercel Firewall (ex.: 30 req/min por IP no CEP).
- **Produção**: `APP_ENV=production`, `INTEGRATION_MODE=live`, `APP_URL` com o domínio final (hoje o sitemap usa a URL do deployment), sem provedor mock.

## 2. Pagamento (Mercado Pago) — integração pendente

- **[bloqueia lançamento]** Conta verificada, credenciais sandbox → teste ponta a ponta com webhook real → credenciais de produção → uma compra real de valor baixo.
- Definir parcelamento máximo, juros, desconto no PIX e se aceita boleto. Com boleto, a janela de 30 min de reserva não basta: excluir `ticket` na preferência ou aumentar a janela.
- Estorno: hoje é feito no painel do Mercado Pago e registrado no admin ("Registrar estorno"). Integração com a API de estorno é melhoria futura.

## 3. Jurídico e negócio

- **[bloqueia lançamento] E-mails transacionais** (Decreto 7.962, art. 4º, III e IV): confirmação imediata do pedido e do pagamento com o resumo do contrato. Precisa de chave do Resend e domínio verificado.
- **[bloqueia lançamento] Revisão jurídica** da Política de Privacidade e dos Termos.
- Termos (texto do cliente, não alterado sem autorização) — propor ao cliente:
  - prazo de entrega "a partir da confirmação do **pagamento**" (o sistema conta assim; o texto diz "do pedido");
  - garantia: a loja responde junto com os fabricantes (CDC art. 18), não só "os fornecedores";
  - regras de cancelamento depois do pagamento (seção 5 tem título mas não tem regra);
  - regras de retirada no galpão (endereço, horário, documento, prazo para retirar).
- Endereço completo (bairro, CEP) da empresa e do galpão; número oficial do WhatsApp.
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
