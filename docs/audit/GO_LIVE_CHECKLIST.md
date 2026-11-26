# GO_LIVE_CHECKLIST — Império Sofás (2026-11-26)

Tudo abaixo depende do responsável pelo projeto, do cliente ou de credenciais
externas. Nada disso foi feito em produção. Segredos (chaves, tokens, senhas) são
cadastrados **diretamente** no painel de cada serviço pelo dono da conta — nunca
por e-mail, chat ou repositório.

Legenda: ☐ pendente · ☑ já resolvido · **Dono** = quem precisa agir.

Substitui, para o go-live, a lista antiga `docs/production-blockers.md` (02/10),
que ficou desatualizada.

## 1. Já resolvido (não precisa repetir)

- ☑ Dados da empresa e revisão jurídica dos textos (termos, privacidade, trocas).
- ☑ Catálogo sincronizado no TESTE (preços revisados; estoque provisório 10).
- ☑ Fluxo Mercado Pago validado no TESTE com credenciais de teste (pedido pago via
  webhook).
- ☑ Correções da auditoria QA e PERF-01 validadas no staging.

## 2. Vercel

| ☐   | Item                                                                                                                     | Dono           | Observação                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐   | **Plano Pro** no time que vai hospedar a loja                                                                            | Você           | O time "Imperio Sofas" está no Hobby. A cota de otimização de imagens do Hobby (5.000 transformações/mês) se esgota rápido numa loja com tráfego, e então **fotos novas param de carregar (erro 402)**. Confirme também nos Termos da Vercel se o Hobby admite uso comercial. Estimativa de custo em `PERF_IMAGES_2026-11-25.md` §7 |
| ☐   | Definir qual projeto/branch será produção (hoje a branch de produção do projeto de teste é `staging`)                    | Você           | O `main` do GitHub ainda é o código antigo                                                                                                                                                                                                                                                                                          |
| ☐   | Região das funções = região do Supabase de produção (ex.: `gru1` São Paulo)                                              | Você           | PERF-04: reduz a latência de cada página                                                                                                                                                                                                                                                                                            |
| ☐   | Variáveis de ambiente de produção (tabela da §6)                                                                         | Você           | `NEXT_PUBLIC_*` como tipo Config                                                                                                                                                                                                                                                                                                    |
| ☐   | Domínio: decidir como o e-commerce entra no lugar da landing `www.imperiosofas.com.br` (outra conta Vercel), DNS e HTTPS | Você + cliente | A landing atual não foi tocada                                                                                                                                                                                                                                                                                                      |
| ☐   | Acompanhar o uso de "Image Optimization" na primeira semana                                                              | Você           | Se ficar alto: plano maior ou cache maior (aumenta o tempo de exposição após despublicar)                                                                                                                                                                                                                                           |

## 3. Supabase de produção

| ☐   | Item                                                                                                                       | Dono                                       | Observação                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| ☐   | Criar/definir o projeto de **produção** (separado do TESTE `qsafyqsskwbjnailgoev`)                                         | Você                                       | Hoje só existe o TESTE                                  |
| ☐   | Aplicar as 42 migrações de `supabase/migrations` em ordem (inclui `20261125120000` e `20261125130000`)                     | Você (ou eu, com sua autorização e acesso) | Cria tabelas, RLS, RPCs, pg_cron de expiração           |
| ☐   | Auth → Email: **Require current password when updating = ligado**, Secure password change = ligado, Confirm email = ligado | Você                                       | Igual ao TESTE (QA-01)                                  |
| ☐   | Auth → URL Configuration: Site URL e Redirect URLs do domínio de produção                                                  | Você                                       |                                                         |
| ☐   | Auth → SMTP próprio (Resend) para e-mails de cadastro e recuperação                                                        | Você                                       | O SMTP padrão do Supabase tem limite baixo              |
| ☐   | MFA: manter opcional (não obrigatório)                                                                                     | Você                                       | Decisão já tomada                                       |
| ☐   | Storage: bucket `catalog-images` **privado** (as migrações já criam as policies)                                           | Você                                       | Não tornar público — a loja usa a rota `/media/catalog` |
| ☐   | Cadastrar o administrador (tabela `catalog_admins`)                                                                        | Você                                       |                                                         |
| ☐   | Carregar catálogo real: produtos, fotos, preços e **estoque real** (no TESTE está 10 provisório)                           | Você + cliente                             |                                                         |
| ☐   | Backups / point-in-time recovery conforme o plano do Supabase                                                              | Você                                       |                                                         |

## 4. Mercado Pago

| ☐   | Item                                                                                                | Dono                                    | Observação                             |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| ☐   | Credenciais **de produção** (Access Token) e segredo do webhook de produção                         | Cliente (conta MP) → cadastra na Vercel | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| ☐   | Webhook de produção apontando para `https://<domínio>/api/webhooks/mercadopago` (evento Pagamentos) | Cliente                                 |                                        |
| ☐   | `MP_ENV=production` e `MP_EXPECTED_COLLECTOR_ID` = ID da conta recebedora                           | Você                                    | Impede pagamento em conta errada       |
| ☐   | Decisão comercial: parcelamento (até 18x com juros?)                                                | Cliente                                 |                                        |
| ☐   | Decisão comercial: aceitar boleto apesar da reserva de 30 min                                       | Cliente                                 |                                        |
| ☐   | 1 compra real de valor baixo + estorno, feita por vocês                                             | Você + cliente                          | Eu não faço pagamentos reais           |

## 5. E-mail (Resend)

| ☐   | Item                                                                              | Dono |
| --- | --------------------------------------------------------------------------------- | ---- |
| ☐   | Domínio do remetente verificado no Resend                                         | Você |
| ☐   | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_NOTIFY_EMAIL` na Vercel de produção | Você |
| ☐   | Teste: pedido gera e-mail para o cliente e para a loja                            | Você |

## 6. Variáveis de ambiente de produção (Vercel)

| Variável                                                                                     | Origem                 | Obrigatória                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV=production`, `APP_URL` (domínio final)                                              | Você                   | Sim                                                                                                                                            |
| `CATALOG_SOURCE=supabase`                                                                    | Você                   | Sim                                                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`    | Supabase de produção   | Sim                                                                                                                                            |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_ENV`, `MP_EXPECTED_COLLECTOR_ID`                 | Mercado Pago (cliente) | Sim                                                                                                                                            |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_NOTIFY_EMAIL`                                  | Resend                 | Sim                                                                                                                                            |
| `CRON_SECRET` (32+ caracteres aleatórios)                                                    | Você                   | Sim                                                                                                                                            |
| `QUOTE_SIGNING_SECRET`                                                                       | Você (aleatório)       | Sim (exigida pelo `check:production`)                                                                                                          |
| `INTEGRATION_MODE=live`                                                                      | Você                   | Sim (exigida pelo `check:production`)                                                                                                          |
| `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI`, `INTEGRATION_ENCRYPTION_KEY` | Bling                  | **Decisão:** o script `check:production` exige, mas o código da loja ainda não usa o Bling. Ou fornecer, ou eu ajusto o script para não exigir |
| `SENTRY_DSN`                                                                                 | Sentry                 | Opcional                                                                                                                                       |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, `NEXT_PUBLIC_AUTH_APPLE_ENABLED`                          | Você                   | Opcional (hoje desligados)                                                                                                                     |

## 7. Dia do go-live (ordem sugerida)

1. Supabase de produção pronto (§3) e migrações aplicadas.
2. Variáveis na Vercel (§6) e `npm run check:production` passando com elas.
3. Deploy do mesmo commit validado no staging.
4. Smoke test: loja, produto, carrinho, cadastro/login, troca de senha, admin,
   upload de foto, 404 de produto inexistente.
5. Compra real de valor baixo + estorno (§4).
6. Domínio apontado (§2).
7. Primeira semana: acompanhar erros, uso de imagens na Vercel e webhooks.

## 8. Melhorias abertas (não bloqueiam o go-live)

P2/P3 listados em `BUG_TRACKING.md`: UX-04/05, A11Y-05/06/07, PERF-02/03/06,
RESP-03, SEC2-01/02/03 (CSP com nonce, cookie de sessão, idade do timestamp do
webhook), DB2-06/09, QA-06, QA-10.
