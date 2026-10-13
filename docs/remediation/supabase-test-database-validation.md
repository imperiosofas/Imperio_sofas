# Validação DATA-001 + CODE-001 no Supabase de teste

Data: 2026-10-13
Branch de validação: `test/local-database-validation`
Base Git: `56af8e29c6cdd054a85eda179b5d654cbcf7e205`
Ambiente: teste/desenvolvimento, conforme declaração do proprietário.
Projeto: `imperiosofas` — ref `qsafyqsskwbjnailgoev` (us-east-1, Postgres 17.6).

Nenhum push Git ou deploy foi feito. Nenhuma migration repair foi executada. O schema e os dados legítimos foram preservados; as únicas alterações remotas foram as duas migrations autorizadas e fixtures removidas após os testes.

## Histórico de migrations

Antes da alteração havia 21 migrations remotas. A migration DB-001 `20261007213800_catalog_publish_readiness_optional_dimensions` estava alinhada; não foi reparada nem reaplicada.

DATA-001 e CODE-001 foram aplicadas pelo mecanismo oficial `apply_migration`. Esse mecanismo recebe o nome, mas gera a versão remota usando o horário de aplicação; por isso, as versões registradas diferem dos timestamps originais dos arquivos locais. Para evitar que um futuro `db push` tente reaplicar SQL já executado, os arquivos locais foram renomeados para corresponder ao histórico remoto, sem alteração do SQL:

| Migration                | Versão registrada no Supabase | Resultado |
| ------------------------ | ----------------------------- | --------- |
| `customer_stock_privacy` | `20261013220236`              | aplicada  |
| `atomic_cart_add`        | `20261013220402`              | aplicada  |

O histórico remoto final tem 23 migrations e contém ambas as entradas. Não foi usada migration repair, DDL manual para editar histórico, `db push` ou reset.

## DATA-001 — privacidade de estoque

Foram testadas as cinco projeções previstas:

- Anônimo: `get_catalog_listing`, `get_catalog_products` e `get_catalog_product_detail`.
- Usuário autenticado com carrinho e favorito de teste: `get_my_cart` e `get_my_favorite_products`.

Nenhuma resposta testada incluiu campos/valores de quantidade exata (`on_hand`, `reserved` ou equivalentes). As respostas expõem apenas estado qualitativo. A leitura direta da tabela `inventory` não retorna estoque para `anon` ou cliente comum. Um usuário de teste com membership administrativa conseguiu ler o valor exato, conforme esperado.

RLS permaneceu habilitada em `products`, `product_variants`, `inventory`, `carts` e `cart_items`. A política existente de inventário continua limitada a administradores. Tentativas do cliente de alterar estoque/preço confiáveis afetaram zero linhas; nenhuma policy foi flexibilizada.

**DATA001_APPLIED=YES**
**ANON_EXACT_STOCK_EXPOSED=NO**
**CUSTOMER_EXACT_STOCK_EXPOSED=NO**
**ADMIN_EXACT_STOCK_AVAILABLE=YES**
**RLS_PRESERVED=YES**

## CODE-001 — carrinho atômico

A candidata estática aprovada foi recuperada da worktree existente, sem integrar o restante das alterações daquela branch. A RPC `add_cart_item` foi aplicada; `addCartItem` agora usa a operação aditiva no banco. `set_cart_item` continua sendo uma substituição absoluta.

Testes feitos contra o Postgres remoto com sessões autenticadas reais e contas temporárias distintas:

| Cenário                                             | Resultado                        |
| --------------------------------------------------- | -------------------------------- |
| 25 pares concorrentes de `+1`, quantidade inicial 1 | final 3 em todas as rodadas      |
| 10 incrementos simultâneos, saldo 120               | final 10                         |
| 10 incrementos simultâneos, saldo 3                 | 3 aceitos, 7 rejeitados, final 3 |
| Usuário A altera o carrinho; usuário B lê o próprio | carrinho B permaneceu inalterado |
| Variante UUID inválida                              | rejeitada                        |
| Quantidades 0, negativa e 100                       | rejeitadas                       |
| `SET 4`, incremento `+2`, depois `SET 4`            | quantidades observadas 6 e 4     |

**CONCURRENCY_ITERATIONS=25**
**LOST_UPDATES=0**
**OVERSTOCK_EVENTS=0**
**CROSS_USER_VIOLATIONS=0**
**CART_OWNERSHIP_PRESERVED=YES**

O teste de estoque limitado usa a RPC concorrente real e não apenas chamadas sequenciais dentro de uma transação SQL. A função valida `auth.uid()`, exige usuário autenticado, usa `search_path` vazio, bloqueia a linha de inventário e concede execução somente a `authenticated`; `PUBLIC` e `anon` não podem executá-la.

## pgTAP e fixtures

Foram executadas seis suítes existentes com `BEGIN`/`ROLLBACK`:

| Suíte                       | Assertions |
| --------------------------- | ---------: |
| `catalog_public.sql`        |          5 |
| `catalog_listing.sql`       |         13 |
| `commerce_interactions.sql` |         27 |
| `catalog_admin_access.sql`  |         19 |
| `customer_profiles.sql`     |          9 |
| `cart_atomic.sql`           |         12 |
| **Total**                   |     **85** |

**PGTAP_TOTAL=85**
**PGTAP_PASS=85**
**PGTAP_FAIL=0**
**PGTAP_SKIPPED=0**

O teste público antigo pressupunha catálogo vazio e falhava num banco que já contém o catálogo real. Foi ajustado para criar um rascunho `TEST_` e testar esse slug específico, sem pressupor ausência de produtos legítimos. O fixture atômico também ganhou mídia e membership administrativa de teste para respeitar o guard real de publicação. Nenhum guard ou policy foi relaxado.

As contas temporárias usadas pelas sessões HTTP foram removidas pela API administrativa. As fixtures SQL foram revertidas ou apagadas por IDs exatos; o produto de teste foi despublicado antes de sua mídia ser removida, respeitando o guard. Verificação após cleanup:

- Categorias: 7 (igual ao estado inicial).
- Produtos: 51 (igual ao estado inicial).
- Variantes/inventory: 71/71 (igual ao estado inicial).
- Carrinhos/itens: 1/2 (igual ao estado inicial).
- Contas temporárias remanescentes: 0.
- Produtos com slug de teste remanescentes: 0.

**TEST_FIXTURES_REMOVED=YES**
**CLEANUP_COMPLETE=YES**

## Segurança e avisos

**SECURITY_REVIEW=PASS** para o escopo DATA-001/CODE-001. A chave privilegiada não foi adicionada ao código, à migration ou ao bundle. `SUPABASE_SECRET_KEY` não aparece no código-fonte. O único identificador de chave de servidor encontrado no código é `SUPABASE_SERVICE_ROLE_KEY` no parser marcado `server-only`; não é usado por componentes/clientes e não aparece em `.next/static`. `.env.local` está ignorado pelo Git.

O Supabase Security Advisor continua reportando avisos gerais: funções `SECURITY DEFINER` públicas/autenticadas (incluindo as RPCs de catálogo/carrinho, intencionais e com grants/validação explícitos), tabelas internas no schema `private` com RLS sem policies (deny-by-default) e proteção contra senhas vazadas desabilitada. Esses avisos foram registrados, não alterados nesta tarefa. O aviso genérico para `add_cart_item` não representa autorização anônima: `anon` não tem `EXECUTE`, e a RPC exige usuário autenticado.

## Validação de código

| Check                                                   | Resultado                                         |
| ------------------------------------------------------- | ------------------------------------------------- |
| `npm run typecheck`                                     | PASS                                              |
| `npm run lint`                                          | PASS — 0 erros; 2 avisos preexistentes de `<img>` |
| Prettier no `src/features/commerce/actions.ts` alterado | PASS                                              |
| `npm run build`                                         | PASS — Next.js 16.3.8/Turbopack                   |
| `git diff --check`                                      | PASS                                              |
| Chave privilegiada no bundle cliente (`.next/static`)   | não encontrada                                    |

O build atualizou referências de tipos geradas em `next-env.d.ts`; essa alteração automática foi restaurada e não faz parte da integração.

## Resultado

**DATABASE_ENVIRONMENT=TEST (owner-declared)**
**DB001_HISTORY_ALIGNED=YES**
**DATA001_VALIDATED=YES**
**CODE001_CONCURRENCY_VALIDATED=YES**
**RLS_PRESERVED=YES**
**STOCK_PRIVACY_PRESERVED=YES**
**SERVICE_ROLE_EXPOSED_TO_CLIENT=NO**
**GIT_PUSHED=NO**
**DEPLOYED=NO**
