# Exportação administrativa de analytics

`GET /api/admin/reports/analytics.xlsx?category=<uuid>` monta um arquivo XLSX no servidor. A rota valida a categoria, exige a sessão e membership de catálogo por `requireCatalogAdmin`, usa o serviço `getAdminAnalyticsSnapshot` para os indicadores e pagina os produtos pelo RPC administrativo já existente. Nenhuma consulta ao banco ocorre no navegador e nenhuma chave privilegiada é usada.

## Limites operacionais

- 100 produtos por página;
- no máximo 20 páginas / 2.000 produtos;
- no máximo 20.000 variantes;
- no máximo 25 MiB no arquivo final.

Se o limite for ultrapassado, a API recusa a exportação inteira; não entrega um relatório parcial. A paginação verifica shape, número/total de páginas e IDs/slugs repetidos. O parser mantém apenas os campos necessários para as planilhas, descartando descrição e mídia.

## Planilhas

- **Resumo:** snapshot de catálogo/estoque e dois gráficos PNG derivados dos números reais por categoria.
- **Produtos:** uma linha por variante, com atributos, preço e medidas confirmadas; produtos sem variante ainda são listados.
- **Estoque:** saldo em mãos, reservas, disponível, limite baixo e estado. Dados operacionais de estoque aparecem somente nesta exportação administrativa.
- **Categorias:** contagens reais do snapshot.
- **Comportamento:** eventos exibidos como “Ainda sem dados”; vendas e pedidos como “Disponível após ativação de pedidos”.
- **Metodologia:** fontes, filtros, definições, limites e privacidade.

O timestamp em **Metodologia** corresponde ao snapshot dos indicadores do resumo. Produtos e estoque são obtidos em chamadas paginadas separadas e podem refletir instantes próximos, porém diferentes, quando há edição administrativa concorrente; o XLSX não é uma leitura transacional única.

**Analytics Fase 2 — futuro:** planejar instrumentação de eventos, séries temporais e métricas de funil depois da ativação de pedidos. Essa etapa não faz parte deste exportador; não há histórico, previsão nem números simulados.

Não são exportados dados pessoais, IDs de clientes, descrições livres, storage paths ou URLs assinadas. Campos textuais que iniciem por `=`, `+`, `-`, `@`, tab ou carriage return são escapados para evitar fórmula em planilhas; valores numéricos continuam sendo gravados como números.

## Compatibilidade da dependência XLSX

ExcelJS permanece fixado em `4.4.0`. Seu módulo CommonJS usa `uuid.v4()` para IDs internos de formatação estendida; o override fica restrito à árvore de dependências do ExcelJS em `uuid@11.1.1`. A compatibilidade foi verificada executando o import CommonJS do ExcelJS e os testes de geração/leitura do workbook. O caminho de `uuid.v3/v5/v6` com buffer citado no CVE-2026-41907 (GHSA-w5hq-g745-h8pq) não é usado pelo ExcelJS neste fluxo.
