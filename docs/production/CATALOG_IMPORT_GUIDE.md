# Guia de importação do catálogo para produção

## 1. Situação atual (evidência: consulta somente leitura ao TESTE em 2026-11-26)

| Item       | TESTE                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Categorias | `sofas`, `colchoes`, `sala-de-jantar`, `roupeiros`, `racks`, `poltronas`, `camas`, `kit-cozinha` |
| Produtos   | 63 (53 publicados, 10 rascunhos)                                                                 |
| Variações  | 105 (104 ativas), todas com SKU                                                                  |
| Estoque    | **10 em todas — valor provisório**, não é estoque real                                           |
| Fotos      | 122 WebP no bucket privado `catalog-images`                                                      |

Origem do catálogo do TESTE: sincronização com `imperiosofas-catalogo.vercel.app`
(`scripts/import-legacy-catalog.mjs` + `docs/audit/CATALOG_SYNC_2026-11-19.md`).

## 2. Caminhos possíveis para a produção (decisão do cliente/responsável)

| Caminho                                      | Quando faz sentido                               | Ferramenta                                                                                                                                                                                                                                       | Estado                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Levar para a produção o catálogo do TESTE | Produtos, preços e fotos do TESTE estão corretos | Hoje **não há um comando único**: o TESTE foi montado por `scripts/import-legacy-catalog.mjs` (manifesto `legacy-catalog-inventory.json`, que está **fora do repositório**) + `scripts/audit/catalog-sync-2026-11-19.cjs` (12 produtos de 19/11) | Precisa de um script de cópia TESTE → produção (leitura no TESTE, gravação na produção), com dry-run, chaves de produção e autorização. **O estoque continuaria 10 até ser corrigido** |
| B. Planilha do cliente (CSV)                 | Cliente quer revisar preços, estoque, fotos      | `scripts/catalog/validate-catalog-csv.mjs` (este guia)                                                                                                                                                                                           | Validação pronta (**só dry-run**). A gravação a partir do CSV **não existe** ainda                                                                                                     |
| C. Cadastro manual no admin                  | Poucos produtos ou ajustes finais                | `/admin/produtos`                                                                                                                                                                                                                                | Pronto e testado (E2E D2–D7)                                                                                                                                                           |

Recomendação conservadora para o lançamento: decidir entre A (cópia do TESTE,
exige preparar e testar o script de cópia antes) e C (cadastro no admin). Em
qualquer caso, **estoque real por SKU** vem do cliente.
Nunca subir o estoque provisório 10 como se fosse real.

## 3. Modelo de planilha (caminho B)

Arquivo: `docs/production/catalog-import-template.csv` (separador `;`, UTF-8; abre no
Excel). **Uma linha por variação** (ex.: cada largura de um sofá). Linhas do mesmo
produto repetem os campos do produto.

| Coluna                         | Obrigatória   | Formato / regra                                                        |
| ------------------------------ | ------------- | ---------------------------------------------------------------------- |
| `categoria_slug`               | sim           | um dos slugs da §1                                                     |
| `produto_slug`                 | sim           | minúsculas, números e hífen (ex.: `sofa-berlim`); vira a URL           |
| `produto_nome`                 | sim           | até 180 caracteres                                                     |
| `produto_descricao`            | não           | texto da página                                                        |
| `produto_status`               | não           | `rascunho` (padrão) ou `publicado`                                     |
| `sku`                          | sim           | único no arquivo; letras, números, `.` `_` `-`                         |
| `largura_cm`                   | se publicado  | número > 0 (ex.: `210` ou `210,5`)                                     |
| `profundidade_cm`, `altura_cm` | não           | número > 0                                                             |
| `tecido`, `cor`                | não           | texto                                                                  |
| `preco`                        | se publicado  | `2.799,00`, `2799,00` ou `2799.00`; > 0; até 2 casas                   |
| `estoque`                      | **sim**       | inteiro ≥ 0. **Em branco é rejeitado** — o sistema não inventa estoque |
| `estoque_minimo`               | não           | inteiro ≥ 0 (alerta de estoque baixo)                                  |
| `imagens`                      | se publicado  | nomes de arquivo separados por `\|` (jpg, png ou webp, até 10 MB)      |
| `texto_alternativo`            | se há imagens | descrição da foto (acessibilidade), até 300 caracteres                 |

## 4. Regras conferidas (iguais às do banco + checagens de planilha)

- Preço, estoque, medidas e slugs com o mesmo formato exigido pelas restrições das
  migrações.
- Produto publicado: pelo menos 1 imagem; cada variação com SKU, preço e largura.
- Categoria precisa existir (`--categories=`).
- Imagem precisa existir na pasta, ter extensão aceita, até 10 MB e ser **de fato**
  uma imagem (conferido pelos primeiros bytes).
- Duplicidades: SKU repetido; mesma variação (tecido, cor, medidas) duas vezes;
  mesma foto em produtos diferentes (aviso).
- Linhas do mesmo produto precisam concordar em nome, categoria, descrição e status.
- **Tudo ou nada por produto**: se uma variação tem erro, o produto inteiro é
  rejeitado.

## 5. Como rodar (dry-run — não grava nada)

```
node scripts/catalog/validate-catalog-csv.mjs catalogo.csv --images=fotos --categories=sofas,colchoes,sala-de-jantar,roupeiros,racks,poltronas,camas,kit-cozinha --out=relatorio-catalogo
```

Saída: `relatorio-catalogo/relatorio.md` (legível: aceitas, rejeitadas com motivo,
resumo por produto) e `relatorio.json`. Código de saída 0 = tudo aceito, 2 = há
rejeitadas, 1 = arquivo inutilizável (ex.: coluna faltando).

Testes: `tests/validate-catalog-csv.test.mjs` (preços BR, estoque em branco, categoria
inexistente, imagem ausente/falsa, SKU e variação duplicados, produto
tudo-ou-nada, modelo oficial).

## 6. O que falta para gravar a partir do CSV (não feito)

A validação está pronta; a **gravação** a partir do CSV não foi implementada para não
mexer em dados sem as decisões abaixo. Se o caminho B for escolhido, o passo seguinte
é um modo `--apply` que use as mesmas RPCs do admin, com relatório e reversão por
SKU, testado primeiro no TESTE.

## 7. Perguntas para o cliente

1. O catálogo de produção é o mesmo do TESTE (63 produtos, preços sincronizados em
   19/11)? Algum produto entra/sai?
2. **Estoque real** por SKU (planilha `sku;estoque`).
3. Os 10 produtos em rascunho devem ser publicados?
4. Fotos: as atuais são aprovadas para uso comercial?
