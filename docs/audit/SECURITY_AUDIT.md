# SECURITY_AUDIT — Império Sofás (2026-11-25)

Verificação defensiva, só no ambiente de TESTE. Nenhum segredo aparece neste
documento. Referência: OWASP Top 10 (2021) e ASVS nível 1.

## 1. Resultado geral

| Área                                                                                                                     | Resultado                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Autorização por linha (RLS) — cliente não lê/edita dados de outro cliente                                                | Aprovado (208 verificações, 0 desvios)                                                                           |
| RPCs `SECURITY DEFINER` com `search_path=''` e grants mínimos                                                            | Aprovado                                                                                                         |
| Rotas `/admin` e ações de admin bloqueadas para cliente/anônimo                                                          | Aprovado                                                                                                         |
| Webhook Mercado Pago com assinatura HMAC + idempotência por evento                                                       | Aprovado                                                                                                         |
| Server Actions validando entrada não confiável (zod)                                                                     | Aprovado após correção SEC2-04                                                                                   |
| Troca de senha exige a senha atual                                                                                       | **Aberto (P1)** — checado no app, mas só é garantido no servidor com "Secure password change" ligado no Supabase |
| Escrita direta em `inventory.reserved` pelo cliente                                                                      | Corrigido (DB2-02)                                                                                               |
| Segredos no bundle do navegador                                                                                          | Aprovado (só a chave pública do Supabase)                                                                        |
| Requisições anônimas não recebem cookies; sem `X-Powered-By`; `/auth/confirm` com CSP estrita, `no-referrer`, `no-store` | Aprovado                                                                                                         |
| CSP das páginas da loja e cookie de sessão                                                                               | Aberto (SEC2-01, SEC2-02 — P3)                                                                                   |

## 2. Achados

| ID      | Prioridade | Descrição                                                                                                                                                                                                     | Status                                                                                                                                                                                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC2-04 | P2         | `simulateMockPaymentAction` aceitava `orderId`/`outcome` sem validação                                                                                                                                        | **Corrigido** (validação uuid/enum antes de qualquer acesso)                                                                                                                                                                                                                 |
| QA-01   | P1         | Troca de senha não conferia a senha atual                                                                                                                                                                     | **Aberto (mitigado)**: `verifyCurrentPassword` confere a senha antes da troca, mas é só barreira de interface (revisão independente). Correção definitiva: ligar "Secure password change" no Supabase — o app já envia `current_password` e trata o código de reautenticação |
| DB2-02  | P1         | `authenticated` tinha `UPDATE` em toda a tabela `inventory`, inclusive `reserved`                                                                                                                             | **Corrigido**: grant restrito a `on_hand, low_stock_threshold, version, updated_at` (migração `20261125120000`, aplicada no TESTE)                                                                                                                                           |
| DB2-01  | P1         | Reenvio de aprovação podia rebaixar pagamento aprovado; 2º pagamento não sinalizado; pagamento estornado podia reviver pedido encerrado                                                                       | **Corrigido** (migrações `20261125120000` e `20261125130000`)                                                                                                                                                                                                                |
| SEC2-01 | P3         | CSP das páginas da loja não define `script-src`/`default-src` (não protege contra XSS). `/auth/confirm` já tem CSP estrita. Falta também `Cross-Origin-Opener-Policy`.                                        | Aberto — recomendação: CSP com nonce, começando em modo Report-Only (`next.config.ts`)                                                                                                                                                                                       |
| SEC2-02 | P3         | Cookie de sessão do Supabase não é `HttpOnly` (padrão da biblioteca `@supabase/ssr`); só vira risco somado a um XSS                                                                                           | Aberto — tratar junto com SEC2-01                                                                                                                                                                                                                                            |
| SEC2-03 | P3         | Verificação de assinatura do webhook não limita a idade do timestamp (replay de notificação capturada). Impacto mínimo: o pagamento é sempre reconsultado no Mercado Pago e eventos repetidos são descartados | Aberto — recomendação: rejeitar timestamp com mais de ~10 min (`mercadopago-signature.ts`)                                                                                                                                                                                   |

## 3. Não testado / fora de escopo

- Testes de intrusão ofensivos, força bruta e carga: **não executados** (fora do escopo autorizado).
- Painéis de terceiros (Mercado Pago produção, Vercel, Resend): configuração conferida visualmente; credenciais nunca foram digitadas nem copiadas por mim.
- Banco de produção: **não tocado**.

## 4. Pendências de segurança para produção

1. Ligar "Require current password" e manter MFA opcional (não obrigatório) no Supabase de produção.
2. Aplicar todas as migrações (inclusive `20261125120000`) no projeto de produção antes do go-live.
3. Cadastrar credenciais de produção do Mercado Pago e o segredo do webhook direto na Vercel (passo do responsável pela conta).
