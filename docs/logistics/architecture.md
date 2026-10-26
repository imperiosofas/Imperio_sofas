# Fundação de logística — arquitetura, estados e segurança

Status: implementação local e fundação aplicada somente ao Supabase TEST. Histórico remoto: `20261020223338_logistics_foundation` e `20261020224530_logistics_foreign_key_indexes`. Isto não habilita checkout nem venda operacional.

## Componentes

- `GET /api/logistics/cep`: valida CEP no servidor, consulta ViaCEP e confere o código municipal com a API oficial do IBGE. Só a lista explícita em `logistics_areas` libera entrega.
- Dados públicos de modalidade e retirada: projeção de logística do produto publicado; não expõe estoque operacional nem endereço de cliente.
- Solicitação do cliente: a aplicação confirma a sessão no servidor, lê o carrinho do usuário autenticado, calcula grupos elegíveis e repete a conferência do CEP antes de pedir uma cotação.
- RPC `logistics_create_quote_server`: fronteira privilegiada que revalida usuário, produtos, variantes, preço, estoque, fornecedor, modo e cobertura no Postgres. A identidade e os dados derivados do CEP vêm do servidor, nunca de campos confiados do navegador.
- RPCs `customer_*_logistics_quote`: escopo por `auth.uid()`; o cliente só lista, consulta, responde ou cancela as próprias solicitações.
- RPCs `admin_*_logistics_*`: autorização administrativa pelo helper de membership já existente; o navegador não recebe acesso direto às tabelas de cotação.

## Modelo de dados

- `logistics_suppliers`: Vale e Mundial, modalidades e prazos operacionais.
- `logistics_areas`: allowlist de municípios por código IBGE.
- `logistics_pickup_locations`: endereços de retirada explicitamente confirmados.
- `logistics_settings`: adicional por andar, validade opcional, telefone oficial opcional e estado da política de múltiplas entregas.
- `logistics_quotes`, `logistics_quote_groups` e `logistics_quote_items`: solicitação imutável como snapshot do destino, grupos por fornecedor/modalidade e itens/preços no momento da consulta.
- `logistics_quote_events` e `logistics_admin_events`: histórico de transições e operações administrativas.
- Índices cobrem FKs de auditoria, locais, grupos, produtos, municípios e configuração. Após a migration complementar, o Performance Advisor não reporta FKs logísticas sem índice.
- `products.supplier_id`: nullable e preenchido somente por atribuição explícita. Os 51 produtos legados não podem ser classificados por inferência.

## Máquina de estados

Estados de solicitação: `awaiting_quote → quoted → accepted | rejected`; estados terminais adicionais: `cancelled`, `invalidated` e `expired`.

- `awaiting_quote`: aguardando negociação de todos os grupos de entrega.
- `quoted`: o Admin informou os fretes-base necessários; o adicional por andar já foi calculado no servidor.
- `accepted` ou `rejected`: resposta explícita do cliente à proposta vigente.
- `cancelled`: cliente cancelou uma solicitação ainda aberta.
- `invalidated`: mudou o carrinho, a impressão do pedido/endereço ou a cobertura da cidade; exige nova validação e uma nova solicitação.
- `expired`: validade configurada expirou antes da resposta do cliente. Não há validade padrão inventada.

Alterações em `cart_items` invalidam transacionalmente solicitações abertas e aceitas. Uma nova solicitação com impressão materialmente diferente invalida as anteriores; desabilitar uma cidade invalida propostas daquele município. Reatribuir fornecedor a um produto invalida cotações que contêm esse produto. Alterações na taxa por andar, no andar incluído ou na validade configurada invalidam cotações de entrega ainda abertas/aceitas. Mudanças de telefone WhatsApp não alteram as condições de uma cotação. Eventos de invalidação guardam apenas a razão, sem CEP/endereço ou outros dados do cliente.

A criação serializa com alterações administrativas: a RPC bloqueia o carrinho e seus itens, os produtos, a configuração de entrega, a área e os registros de fornecedor/local de retirada selecionados. As mudanças administrativas usam bloqueios de escrita antes de invalidar snapshots afetados. Assim, uma cotação não deve confirmar silenciosamente condições lidas antes de uma edição concorrente.

## Contrato de frete

O adicional é calculado uma vez por destino/solicitação: `max(0, floor - 4) × 1000 centavos`. Retirada não recebe adicional. O operador informa apenas o frete-base negociado por grupo de fornecedor. A cotação aceita é um snapshot contratual para uma futura etapa de checkout, não é pedido, cobrança ou autorização para reservar estoque.

O carrinho pode conter grupos Vale e Mundial. A implementação não soma o adicional por produto nem decide uma regra comercial para múltiplas entregas ao mesmo destino. Essa política permanece bloqueante para checkout.

## Fronteiras de segurança

- Todas as tabelas logísticas em `public` têm RLS; clientes e `anon` não recebem privilégios diretos de leitura/escrita das tabelas de cotações.
- Funções privilegiadas usam `SECURITY DEFINER` apenas onde precisam escrever através da fronteira RPC, com `SET search_path = ''`, nomes qualificados e checagem de proprietário/admin no corpo. EXECUTE é revogado de `PUBLIC` e concedido somente aos papéis requeridos.
- A RPC de criação privilegiada só é executável por `service_role`. A chave Supabase `sb_secret` não é JWT: no cliente server-only ela deve ser enviada somente em `apikey`; o wrapper remove somente o `Authorization: Bearer` duplicado gerado pelo `supabase-js`. Nunca colocar essa chave em `NEXT_PUBLIC_*`, componentes client, logs ou documentação.
- `src/lib/supabase/service.ts` é `server-only` e falha fechado se `SUPABASE_SECRET_KEY` não estiver configurada. Neste ambiente a variável está ausente; portanto o fluxo de criação real de cotações não está habilitado localmente.
- CEP e endereço são revalidados no servidor. Eventos e logs não devem copiar PII. Consultas de cotações do cliente usam sempre o `auth.uid()` da sessão validada.

## Limitações antes de operação comercial

O fundamento não cria pedido, pagamento, reserva de estoque, nota fiscal, etiqueta, rastreamento ou integração de transportadora. Os produtos atuais continuam sem fornecedor atribuído; não há telefone WhatsApp confirmado configurado; não há regra aprovada para múltiplas entregas ao mesmo destino nem calendário de feriados. O limitador de solicitações mantido em memória por processo é apenas uma defesa auxiliar local e não substitui rate limit distribuído em ambiente multi-instância.

O endereço necessário à proposta fica em colunas de snapshot protegidas por RLS. `request_fingerprint` guarda somente `{version, sha256}` calculado no Postgres a partir dos dados normalizados; o navegador também usa um digest opaco em memória, não o JSON com endereço. O digest é pseudônimo, não anonimização: trate-o como dado sensível e não o inclua em logs ou analytics. Não há prazo de retenção aprovado nem expurgo automático; cotações permanecem armazenadas até exclusão por regras administrativas/relacionais existentes. O proprietário deve aprovar o prazo e a rotina de exclusão antes da operação comercial.

Antes do checkout, concluir a configuração local segura da chave server-side, classificar produtos com confirmação comercial, confirmar todos os locais e dados dos fornecedores, decidir as políticas pendentes e testar idempotência/concorrência no ambiente autorizado. Migration e pgTAP foram homologados no Supabase TEST, o que não equivale a validação de produção. `ANALYTICS_FASE_2` continua pendente para depois de pedidos, frete, checkout e pagamentos.
