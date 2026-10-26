# Logística — regras e decisões

Status: fundação técnica implementada localmente e aplicada ao Supabase TEST. Este documento registra as regras autorizadas pelo proprietário; não declara venda, checkout ou operação logística de produção como homologados.

## Fornecedores e modalidades

| Fornecedor | Modalidades                   | Prazo informado                                      | Regra do frete                                       |
| ---------- | ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Vale       | Retirada no galpão ou entrega | 7 dias úteis, contados após confirmação do pagamento | Entrega depende de cotação; retirada não cobra frete |
| Mundial    | Somente entrega               | 30 a 45 dias úteis após confirmação do pagamento     | Entrega própria e frete negociado antes da compra    |

Os prazos são contagens em dias úteis, não datas garantidas. A aplicação não calcula data de entrega sem calendário operacional de feriados.

Produtos existentes começam sem fornecedor atribuído. Nenhum produto pode ser classificado automaticamente como Vale ou Mundial por nome, preço, foto ou categoria. Enquanto não houver atribuição explícita no Admin, não se oferece modalidade presumida.

## Cobertura de entrega

Inicialmente, somente estas cidades de SP foram autorizadas:

| Município           | Código IBGE |
| ------------------- | ----------: |
| Aparecida           |     3502507 |
| Caçapava            |     3508504 |
| Cachoeira Paulista  |     3508603 |
| Guaratinguetá       |     3518404 |
| Jacareí             |     3524402 |
| Lorena              |     3527207 |
| Pindamonhangaba     |     3538006 |
| Potim               |     3540754 |
| Roseira             |     3544301 |
| São José dos Campos |     3549904 |
| Taubaté             |     3554102 |
| Tremembé            |     3554805 |

O código e o nome do município devem ser tratados pelo identificador oficial do IBGE. Nenhuma outra cidade, ainda que esteja no estado de SP ou nas regiões comerciais citadas, deve ser habilitada por inferência. UF diferente de SP não recebe cotação de entrega.

## Galpão Vale

Endereço fornecido pelo proprietário: Rua Agostinho Abifadel, nº 35, bairro Terra Nova, CEP 12081-670. A consulta ao ViaCEP retornou Rua Agostinho Abifadel, Terra Nova, Taubaté/SP; o código municipal 3554102 e o nome Taubaté foram conferidos na API de localidades do IBGE.

Referências consultadas em 20/10/2026:

- [ViaCEP — formato e consulta de CEP](https://viacep.com.br/)
- [IBGE — API oficial de localidades e municípios](https://servicodados.ibge.gov.br/api/docs/localidades)
- [IBGE — códigos dos municípios](https://www.ibge.gov.br/explica/codigos-dos-municipios.php)

A retirada somente ocorre no galpão, não na loja física. A data de liberação é confirmada operacionalmente depois do prazo informado. Não há regra aprovada restringindo retirada por domicílio fora de SP; a restrição de cobertura de entrega não deve ser aplicada automaticamente à retirada.

## CEP e cobertura

A consulta do CEP é feita no servidor. A entrada deve ser validada como oito dígitos, a resposta do ViaCEP é cruzada com a API oficial do IBGE pelo código do município, e a modalidade de entrega só é liberada se o município estiver explicitamente habilitado no cadastro de cobertura.

Timeout, CEP inexistente, incompatibilidade entre provedores ou indisponibilidade não liberam entrega: o fluxo deve solicitar nova tentativa ou revisão manual. A aplicação consulta sob ação explícita do cliente e usa cache; não varre bases de CEP, em respeito ao aviso do ViaCEP contra uso massivo para validar bases locais.

## Adicional por andar

- Térreo (andar 0) até o 4º: R$ 0.
- A partir do 5º: R$ 10,00 por andar, incluindo o 5º.
- Fórmula em centavos: `max(0, floor - 4) * 1000`.
- Retirada: R$ 0 de adicional.
- O adicional é calculado no servidor e pertence ao destino/solicitação, não a cada item.

A regra para múltiplos envios ao mesmo endereço ainda precisa de decisão comercial antes do checkout. A fundação não multiplica automaticamente o adicional por produto nem decide uma alocação de cobrança entre fornecedores.

## Cotação e comunicação

O cliente solicita cotação para itens elegíveis do carrinho; o servidor revalida catálogo, variante, estoque, fornecedor, modalidade e cobertura. O vendedor informa o frete base. O sistema calcula o adicional por andar e o cliente, e somente o cliente, aceita ou recusa. Mudanças relevantes no carrinho, destino ou condição invalidam a proposta anterior.

Não existe tarifa automática por distância, prefixo de CEP, Correios ou transportadora nesta fase. O contato WhatsApp oficial não está confirmado; o campo deve permanecer vazio até configuração administrativa. Sem número configurado, não se deve gerar link ou contato fictício.

## Limites desta fase

Esta fundação não cria pedidos, pagamentos, cobranças, reserva de estoque, nota fiscal, etiqueta, rastreamento ou integração com transportadora. Cotação aceita é apenas um contrato pronto para checkout futuro. A validade pode ser configurada, mas não recebe prazo padrão inventado.

Permanecem pendentes: classificar produtos existentes com evidência comercial, configurar WhatsApp oficial, decidir a política de andar para múltiplas entregas ao mesmo destino, preencher detalhes de fornecedores/locais e definir a política de retirada para clientes residentes fora de SP.

`ANALYTICS_FASE_2` permanece pendente para depois de pedidos, frete, checkout e pagamentos.
