# Bloqueios de produção — Império Sofás

Este arquivo lista dependências que impedem ativar venda real ou declarar o sistema pronto para produção. Não há credenciais externas homologadas no estado atual. A ausência de uma credencial bloqueia a integração correspondente; não bloqueia a implementação de mocks, contratos e testes determinísticos.

## Bloqueios comerciais e cadastrais

| Status    | Bloqueio                  | Evidência necessária                                                                    |
| --------- | ------------------------- | --------------------------------------------------------------------------------------- |
| BLOQUEADO | Telefone/WhatsApp oficial | Confirmação única da empresa; há números divergentes no código e nos documentos         |
| BLOQUEADO | Identidade fiscal         | CNPJ, razão social, endereço fiscal e dados necessários para faturamento                |
| BLOQUEADO | Catálogo vendável         | Preço à vista, variantes, medidas confirmadas, imagens aprovadas e estoque inicial      |
| BLOQUEADO | Parcelamento e pagamento  | Condições aprovadas; não interpretar textos `12x` como preço final ou ausência de juros |
| BLOQUEADO | Frete                     | Faixas de CEP, taxa, prazo, retirada, limites e regras para carrinhos mistos            |
| BLOQUEADO | Políticas                 | Privacidade, termos, entrega, troca/devolução, retenção e atendimento aprovados         |
| ABERTO    | Domínio                   | Domínio canônico, DNS, HTTPS e estratégia de substituição da landing page               |

## Bloqueios de infraestrutura e segurança

| Status    | Bloqueio        | Evidência necessária                                                                                                                                                   |
| --------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOQUEADO | Supabase        | Projeto `imperiosofas` e nove migrations confirmados; faltam separar ambientes, confirmar envs de runtime, política de backup/restore e validar Auth                   |
| BLOQUEADO | Administração   | Membership única existe; MFA/AAL2 está temporariamente desativado por decisão do proprietário. Ainda falta homologar sessão, operações, upload e recuperação de acesso |
| BLOQUEADO | E-mail          | Domínio/remetente verificado e SMTP/API para autenticação e eventos comerciais                                                                                         |
| ABERTO    | Observabilidade | Canal de alerta, retenção de logs e regras de redaction aprovadas                                                                                                      |
| ABERTO    | Deploy          | Projeto Vercel, ambientes, proteção de staging, cron e procedimento de rollback                                                                                        |

## Bloqueios de autenticação

| Status    | Bloqueio                | Evidência necessária                                                                                                                                               |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BLOQUEADO | Providers OAuth         | Google Cloud/Apple Developer e providers do Supabase não foram confirmados; flags de interface permanecem false. Validar callback URI e redirects por ambiente.    |
| BLOQUEADO | E-mail e regras de Auth | Confirmar policy de senha, rate limits nativos, CAPTCHA, templates, remetente e SMTP no Dashboard Supabase; esses settings não estavam expostos no MCP disponível. |
| BLOQUEADO | Homologação de sessão   | Testar login, signup, confirmação, reset, refresh, membership admin e destino seguro com contas de teste controladas antes do go-live; MFA não é gate atual.       |

## Bloqueios de pagamento

| Status    | Bloqueio               | Evidência necessária                                                                                 |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| BLOQUEADO | Mercado Pago sandbox   | Credenciais de teste, conta recebedora de teste, webhook HTTPS e confirmação do ambiente             |
| BLOQUEADO | Mercado Pago live      | Conta aprovada, credenciais live, identidade do recebedor e autorização explícita para ativar vendas |
| BLOQUEADO | Homologação financeira | Evidência de teste de preferência, webhook, pagamento pendente/aprovado, recuperação e reembolso     |

## Bloqueios fiscais e ERP

| Status    | Bloqueio           | Evidência necessária                                                                          |
| --------- | ------------------ | --------------------------------------------------------------------------------------------- |
| BLOQUEADO | Bling              | Aplicação OAuth, conta/ambiente correto, redirect URI e autorização de integração             |
| BLOQUEADO | Parâmetros fiscais | Contador/assessoria deve fornecer natureza, tributação, NCM, série e demais campos aplicáveis |
| BLOQUEADO | Certificado        | A1 e procedimento de armazenamento/rotação aprovados; não assumir A3 físico em nuvem          |
| BLOQUEADO | Homologação fiscal | Teste comprovado de pedido, nota, rejeição, consulta, XML/DANFE privado e não duplicação      |

## Regra de ativação

Enquanto houver qualquer bloqueio marcado como `BLOQUEADO` nas áreas comercial, pagamento, fiscal ou segurança, manter vendas desabilitadas. O status `ABERTO` representa decisão ou preparação ainda necessária, mas deve ser resolvido antes do go-live quando impactar a operação.

Nenhum mock, fixture DEMO, teste sandbox ou validação de formato deve ser descrito como homologação produtiva.

## Estado catalogado em 02/10/2026

O banco remoto contém uma categoria ativa e nenhuma linha em `products`, `product_variants`, `inventory` ou `product_media`. O bucket `catalog-images` é privado. Assim, catálogo vendável segue bloqueado até confirmação do preço final por variante, SKU, saldo inicial e condições comerciais. As imagens originais do showroom estão no repositório, mas a aprovação de uso comercial e associação por variante também deve ser confirmada. Os textos `12x de ...` não foram interpretados como preço à vista nem como condição sem juros.

O requisito administrativo de AAL2 e RLS da tabela `private.catalog_admin_audit` foi restaurado pela migration `20261002164104_restore_catalog_admin_aal2_and_audit_rls`. O trigger foi exercitado em transação autenticada e a linha de teste foi revertida. A sessão TOTP real e o fluxo admin ponta a ponta continuam pendentes.

### Decisão de MFA — 02/10/2026

MFA/TOTP não é requisito para login, conta, carrinho ou administração. As migrations `20261002175919_disable_mandatory_admin_mfa` e `20261002181355_disable_email_mfa_rpc` mantêm a autorização por sessão + membership no RLS e desativam a consulta/challenge de MFA por e-mail. A gestão TOTP permanece opcional; fatores existentes não foram apagados. Homologar a sessão administrativa AAL1 continua pendente.
