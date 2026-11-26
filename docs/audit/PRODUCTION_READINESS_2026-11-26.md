# Prontidão para produção — Império Sofás (2026-11-26)

## Veredito

**Staging fechado: aprovado no ambiente de TESTE, sem P0 nem P1 abertos.**
**Produção: pronta do lado do código; depende de configuração e de itens externos**
listados em `GO_LIVE_CHECKLIST.md`. Nada foi alterado em produção.

Ambiente avaliado: `imperio-sofas-woad.vercel.app` (branch `staging`) + Supabase TESTE
`qsafyqsskwbjnailgoev`.

## Situação dos achados

| Prioridade | Total | Corrigidos | Abertos | Observação                                                                     |
| ---------- | ----- | ---------- | ------- | ------------------------------------------------------------------------------ |
| P0         | 0     | —          | 0       |                                                                                |
| P1         | 10    | 10         | **0**   | DB2-01, DB2-02, QA-01, UX-01, UX-02, UX-03, A11Y-01, A11Y-02, A11Y-03, PERF-01 |
| P2 e P3    | —     | a maioria  | alguns  | lista completa em `BUG_TRACKING.md`; nenhum bloqueia a venda                   |

Corrigidos e retestados nesta etapa final:

- **QA-03** — produto, categoria ou produto excluído inexistente agora responde
  **HTTP 404 real** (antes 200). Páginas válidas continuam 200 com o esqueleto de
  carregamento.
- **PERF-01** — fotos servidas pela rota `/media/catalog` com o bucket privado;
  `/loja` no Lighthouse mobile: LCP 6,8–7,2 s → 3,1–3,2 s, peso 1071 → 545 KB.
- **QA-01** — troca de senha exige a senha atual no servidor do Supabase TESTE.

## Regressão final (2026-11-26)

| Verificação                                            | Resultado                                   |
| ------------------------------------------------------ | ------------------------------------------- |
| Typecheck, lint, build, 146 testes unitários           | OK (0 erros de lint)                        |
| E2E do repositório                                     | 39 PASS, 1 pulado (marcado no arquivo)      |
| E2E QA (cadastro, compra, conta, admin, falhas, links) | 92 PASS, 0 FAIL                             |
| Banco: pagamentos, estoque e concorrência              | 18/18 + 10 rodadas de webhooks sem deadlock |
| Rota de imagens: casos de segurança                    | 11/11                                       |
| Senha atual / redefinição por e-mail                   | 4/4                                         |
| Dados de teste após a regressão                        | nenhum resíduo                              |

Detalhes: `QA_AUDIT_REPORT.md` §6.

## Segurança

- RLS e policies inalteradas (nenhuma enfraquecida); bucket de fotos privado.
- Pagamento: webhook com assinatura, idempotência, reprocessamento seguro,
  estorno não reabre pedido encerrado.
- Abertos (P3, recomendações): CSP com nonce nas páginas da loja, cookie de sessão
  não `HttpOnly` (padrão do Supabase), idade máxima do timestamp do webhook.
  Detalhes: `SECURITY_AUDIT.md`.

## Custos e limites a observar

- **Vercel:** o time está no plano Hobby. Com a loja em produção, a cota de
  otimização de imagens do Hobby (5.000/mês) acabaria em poucos dias e fotos novas
  deixariam de carregar. Recomendado plano **Pro**; custo estimado das imagens:
  ~US$ 6–10/mês numa loja pequena (pior caso ~US$ 43–70). Detalhes:
  `PERF_IMAGES_2026-11-25.md` §7.
- Tempo máximo de exposição de foto após despublicar produto: 60 min (medido: 30 min).

## O que falta para ligar a produção

Resumo de `GO_LIVE_CHECKLIST.md`:

1. Vercel: plano Pro, projeto/branch de produção, região `gru1`, variáveis de
   ambiente, domínio.
2. Supabase de produção: criar projeto, aplicar as 42 migrações, ligar "Require
   current password when updating", SMTP, URLs, admin, catálogo e estoque reais,
   backups.
3. Mercado Pago: credenciais e webhook de produção, ID da conta recebedora,
   decisões de parcelamento e boleto, compra real de teste + estorno.
4. Resend: domínio verificado e chaves.
5. Bling: o `check:production` agora só exige as variáveis do Bling se a
   integração for configurada (a loja não usa o Bling hoje). Mercado Pago em
   produção exige `MP_ENV=live` e `MP_EXPECTED_COLLECTOR_ID` — o script passou a
   conferir isso.
6. Testes ainda pendentes antes da abertura: Safari, Firefox, carga e pagamento
   real com estorno — roteiro em `PRE_LAUNCH_TESTS.md`.

## Limitações desta avaliação

- Testes em Chromium (Playwright); Safari e Firefox reais não testados.
- Sem pagamento real; Mercado Pago validado só com credenciais de teste.
- Sem teste de carga nem teste de intrusão ofensivo.
- Estimativas de custo da Vercel sem dados de tráfego real.
