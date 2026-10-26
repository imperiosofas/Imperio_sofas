# Roadmap de Analytics

## Fase 1 — operação de catálogo (atual)

- Snapshot agregado de status do catálogo e distribuição por categoria.
- Variantes e disponibilidade/estoque baixo/zero somente no painel autenticado.
- Alertas determinísticos de reposição e produtos com mídia/preço ausentes somente se os dados reais e a regra de publicação confirmarem.
- Relatórios Excel construídos a partir do mesmo contrato do backend.
- Estados honestos “Ainda sem dados” e “Disponível após ativação de pedidos”.
- Nenhum evento comportamental é coletado por padrão; instrumentação depende de política, consentimento e retenção decididos pelo proprietário.

## Fase 2 — transações reais

> *** PENDÊNCIA FUTURA OBRIGATÓRIA — ANALYTICS FASE 2**  
> Quando **frete + pedidos + checkout + pagamento + reembolso** estiverem implementados e homologados, conectar os fatos financeiros/operacionais reais a Analytics: receita bruta/líquida, pedidos válidos, ticket médio, conversão de checkout/pedido, abandono por etapa, meios de pagamento, reembolsos, custo/margem, SLA de entrega e receita por região/produto. Fazer isso a partir do **estado persistido e validado no servidor**, com webhooks idempotentes e snapshots de preços/custos; nunca aceitar evento `purchase` enviado pelo browser como prova de venda. Até lá mostrar **“Disponível após ativação de pedidos”** ou estado sem dados, jamais métricas financeiras inventadas. Deixar contratos/tipos e pontos de extensão definidos, mas sem tabelas de pedidos fictícias nem implementação prematura de pagamento.

Sequência futura: homologar os sistemas comerciais → persistir transações/snapshots → processar webhooks idempotentes → reconciliar estados → validar fonte com testes → agregar métricas com filtros e timezone definidos. Não criar tabelas comerciais nesta fase.

## Pendência do proprietário

Antes de views, buscas, sessões ou outros dados de navegação: aprovar base legal, texto, política de privacidade, consentimento opt-in/opt-out, retenção e controles. Até decisão e implementação aprovadas, comportamento continua sem tracking e o Analytics informa “Ainda sem dados”.
