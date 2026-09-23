# Bloqueios de produção — Império Sofás

Este arquivo lista dependências que impedem ativar venda real ou declarar o sistema pronto para produção. Não há credenciais externas homologadas no estado atual. A ausência de uma credencial bloqueia a integração correspondente; não bloqueia a implementação de mocks, contratos e testes determinísticos.

## Bloqueios comerciais e cadastrais

| Status | Bloqueio | Evidência necessária |
|---|---|---|
| BLOQUEADO | Telefone/WhatsApp oficial | Confirmação única da empresa; há números divergentes no código e nos documentos |
| BLOQUEADO | Identidade fiscal | CNPJ, razão social, endereço fiscal e dados necessários para faturamento |
| BLOQUEADO | Catálogo vendável | Preço à vista, variantes, medidas confirmadas, imagens aprovadas e estoque inicial |
| BLOQUEADO | Parcelamento e pagamento | Condições aprovadas; não interpretar textos `12x` como preço final ou ausência de juros |
| BLOQUEADO | Frete | Faixas de CEP, taxa, prazo, retirada, limites e regras para carrinhos mistos |
| BLOQUEADO | Políticas | Privacidade, termos, entrega, troca/devolução, retenção e atendimento aprovados |
| ABERTO | Domínio | Domínio canônico, DNS, HTTPS e estratégia de substituição da landing page |

## Bloqueios de infraestrutura e segurança

| Status | Bloqueio | Evidência necessária |
|---|---|---|
| BLOQUEADO | Supabase | Projeto correto, ambientes separados, acesso de desenvolvimento e política de backup/restore |
| BLOQUEADO | Administração | Responsáveis pelo bootstrap, recuperação de admin e guarda de segredos/TOTP |
| BLOQUEADO | E-mail | Domínio/remetente verificado e SMTP/API para autenticação e eventos comerciais |
| ABERTO | Observabilidade | Canal de alerta, retenção de logs e regras de redaction aprovadas |
| ABERTO | Deploy | Projeto Vercel, ambientes, proteção de staging, cron e procedimento de rollback |

## Bloqueios de pagamento

| Status | Bloqueio | Evidência necessária |
|---|---|---|
| BLOQUEADO | Mercado Pago sandbox | Credenciais de teste, conta recebedora de teste, webhook HTTPS e confirmação do ambiente |
| BLOQUEADO | Mercado Pago live | Conta aprovada, credenciais live, identidade do recebedor e autorização explícita para ativar vendas |
| BLOQUEADO | Homologação financeira | Evidência de teste de preferência, webhook, pagamento pendente/aprovado, recuperação e reembolso |

## Bloqueios fiscais e ERP

| Status | Bloqueio | Evidência necessária |
|---|---|---|
| BLOQUEADO | Bling | Aplicação OAuth, conta/ambiente correto, redirect URI e autorização de integração |
| BLOQUEADO | Parâmetros fiscais | Contador/assessoria deve fornecer natureza, tributação, NCM, série e demais campos aplicáveis |
| BLOQUEADO | Certificado | A1 e procedimento de armazenamento/rotação aprovados; não assumir A3 físico em nuvem |
| BLOQUEADO | Homologação fiscal | Teste comprovado de pedido, nota, rejeição, consulta, XML/DANFE privado e não duplicação |

## Regra de ativação

Enquanto houver qualquer bloqueio marcado como `BLOQUEADO` nas áreas comercial, pagamento, fiscal ou segurança, manter vendas desabilitadas. O status `ABERTO` representa decisão ou preparação ainda necessária, mas deve ser resolvido antes do go-live quando impactar a operação.

Nenhum mock, fixture DEMO, teste sandbox ou validação de formato deve ser descrito como homologação produtiva.
