# Especificação de exportação Excel

## Contrato

- Gerar workbook real `.xlsx` no servidor para sessão admin; visitante e cliente recebem negação segura (403 ou redirecionamento consistente com os guards do app).
- Tela e exportação usam o mesmo serviço/shape e filtros; números devem coincidir exatamente.
- Nome: `imperio-sofas-relatorio-AAAA-MM-DD.xlsx`, com a data do relatório e timezone explicitados.
- Limitar volume e tempo, permitir paginação/batch e nunca incluir signed URLs, segredos, e-mail, telefone, IDs de cliente ou outros dados pessoais desnecessários.
- Texto iniciado em `=`, `+`, `-`, `@`, tab ou CR deve ser serializado como texto seguro; números negativos legítimos permanecem numéricos.

## Abas planejadas

1. **Resumo:** nome da marca, título, período/snapshot, gerado em, fonte, KPIs operacionais reais e aviso de vendas ainda indisponíveis.
2. **Produtos:** nome, categoria, status, variantes e métricas disponíveis; sem popularidade inferida.
3. **Estoque:** variante/SKU, quantidade e threshold visíveis apenas ao admin, estado e alerta; formatação condicional e barras de dados.
4. **Categorias:** distribuição baseada no snapshot atual.
5. **Comportamento:** apenas quando eventos consentidos reais existirem; enquanto indisponível, registrar a limitação sem zeros artificiais.
6. **Metodologia:** definições, fórmulas, filtros, fontes, timezone, limites e métricas pendentes.

Vendas, Pedidos, Clientes, Regiões e Frete não serão planilhas fictícias. A futura integração será apenas uma nota textual até que os módulos comerciais existam.

## Visualizações

Quando as séries derivadas do catálogo real estiverem presentes, incluir pelo menos dois gráficos embutidos de imagem nítida, derivados exclusivamente das tabelas que os acompanham (ex.: disponibilidade por categoria e distribuição de estoque). Não chamar uma tabela ou CSV de arquivo Excel e não anunciar gráficos nativos se a biblioteca escolhida não os produzir. Se os dados disponíveis não permitirem uma série legítima, deixar explícito e não inventar uma série temporal.

## Verificação automatizada

Reabrir o workbook gerado com parser compatível em teste e verificar extensão/assinatura ZIP OOXML, abas, cabeçalhos, formatos numéricos, filtros/congelamento, formatação de baixo estoque, gráficos/imagens quando houver dado apropriado, filtro aplicado e igualdade exata com os resultados do backend. Testar formula injection e negação sem permissão.
