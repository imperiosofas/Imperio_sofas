# Roteiro de teste da logística (Supabase TEST)

Ambiente: `https://imperio-sofas-woad.vercel.app` (site de teste). Banco: Supabase TEST `qsafyqsskwbjnailgoev`. Nada aqui usa pagamento real: o fluxo termina na cotação aceita, que **não** cria pedido nem cobrança.

## Antes de começar

- Duas contas: uma **cliente** (qualquer conta de teste) e uma **administradora** (`imperiosofas.js@gmail.com`, com membership em `catalog_admins`). Use uma janela anônima para uma e a janela normal para a outra.
- Produtos de exemplo (fornecedor já atribuído):
  - **Vale:** Cama Lopas, Colchão Casal Las Vegas, Poltrona Josy.
  - **Mundial:** Sofá Berlim, Sofá Trevo, Sofá Dallas.
- CEPs de teste: Taubaté `12081-670` (galpão da Vale, dentro da área); Praça da Sé, São Paulo `01001-000` (cidade de SP **fora** da lista de 12); um CEP de outro estado à sua escolha.
- Use números e andares fictícios. Não digite o endereço real de nenhum cliente.

## Casos de teste

Marque cada linha com PASSOU, FALHOU ou NÃO TESTADO e anote o que viu.

### A. Carrinho e grupos por fornecedor

| #   | Passo                                                           | Resultado esperado                                                                          |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A1  | Cliente: adicione **Cama Lopas** ao carrinho e abra `/carrinho` | Painel "Como prefere receber?" com um grupo **Vale** e as opções **Entrega** e **Retirada** |
| A2  | Adicione também **Sofá Berlim**                                 | Aparece um segundo grupo **Mundial** com **somente Entrega** (sem Retirada)                 |
| A3  | Remova os dois itens e adicione só o Sofá Berlim                | Só o grupo Mundial, com Entrega                                                             |

### B. Retirada (Vale)

| #   | Passo                                     | Resultado esperado                                                                                 |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| B1  | Só Vale no carrinho, escolha **Retirada** | Campo "Local de retirada" com o galpão de Taubaté (Rua Agostinho Abifadel, 35)                     |
| B2  | Confira o texto abaixo do formulário      | "A retirada não gera solicitação de frete nem pedido". Não há botão de cotação e não pede endereço |

### C. CEP e cobertura de entrega

| #   | Passo                                                      | Resultado esperado                                                                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| C1  | Escolha **Entrega**, digite `12081-670`, **Consultar CEP** | "Taubaté/SP — CEP confirmado e área atendida" e o botão de cotação habilitado                                            |
| C2  | Digite `01001-000`                                         | "CEP confirmado para São Paulo/SP, mas o município ainda não está na área de entrega"; botão de cotação **desabilitado** |
| C3  | Digite um CEP de outro estado                              | Também fora da área; sem cotação                                                                                         |
| C4  | Digite `00000-000` ou um CEP inexistente                   | "CEP não encontrado. Confira os números."                                                                                |
| C5  | Digite menos de 8 dígitos                                  | "Informe um CEP válido com oito dígitos."                                                                                |

### D. Adicional por andar (R$ 10 por andar a partir do 5º)

Mostrado ao cliente como "Adicional por andar, uma vez por endereço".

| #   | Andar informado | Adicional esperado (visto no admin, passo F) |
| --- | --------------- | -------------------------------------------- |
| D1  | 0 (térreo)      | R$ 0,00                                      |
| D2  | 4               | R$ 0,00                                      |
| D3  | 5               | R$ 10,00                                     |
| D4  | 6               | R$ 20,00                                     |

Faça uma solicitação por andar (D1 a D4) para conferir. Em cada uma, outro produto no carrinho não deve mudar o adicional: ele é por endereço, não por item.

### E. Solicitar a cotação (cliente)

| #   | Passo                                                                                           | Resultado esperado                                                                                            |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| E1  | Carrinho com Cama Lopas (Vale) e Sofá Berlim (Mundial), CEP de Taubaté, número `100`, andar `5` | Botão "Solicitar cotação de entrega" habilitado                                                               |
| E2  | Clique no botão                                                                                 | Mensagem "Solicitação registrada" com uma referência de 8 caracteres e link "Ver minhas entregas"             |
| E3  | Abra **Minhas entregas** (`/conta/entregas`)                                                    | A solicitação aparece como aguardando cotação, com dois grupos (Vale e Mundial) e "Frete ainda não informado" |
| E4  | Clique duas vezes no botão de cotação rapidamente                                               | Só **uma** solicitação é criada (idempotência)                                                                |
| E5  | Se a mensagem for de erro de configuração                                                       | Anote o texto. Pode indicar falta da chave `SUPABASE_SECRET_KEY` no ambiente da Vercel                        |

### F. Resposta do vendedor (administradora)

| #   | Passo                                                                                          | Resultado esperado                                                                                     |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F1  | Admin: abra `/admin/entregas/solicitacoes`                                                     | A solicitação do passo E aparece, com o mesmo código de referência                                     |
| F2  | Veja os dados de destino e os grupos                                                           | Grupos Vale e Mundial separados; adicional por andar calculado pelo servidor (R$ 10,00 para o andar 5) |
| F3  | Preencha **Frete base negociado (R$)** do grupo Vale (ex.: `150,00`) e clique **Salvar frete** | A cotação **continua aguardando**, porque falta o grupo Mundial                                        |
| F4  | Preencha o frete base do grupo Mundial (ex.: `300,00`) e salve                                 | A cotação passa a **cotada**                                                                           |
| F5  | Informe um valor inválido (letras, negativo, vazio)                                            | A tela recusa e mantém o valor anterior                                                                |

### G. Resposta do cliente

| #   | Passo                                                               | Resultado esperado                                                                             |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| G1  | Cliente: abra **Minhas entregas** com a cotação cotada              | Mostra os dois fretes e o adicional por andar, com os botões **Aceitar cotação** e **Recusar** |
| G2  | Clique em **Aceitar cotação** e confirme                            | Estado "Cotação aceita". A mensagem deixa claro que não cria pedido nem pagamento              |
| G3  | Em outra solicitação, clique em **Recusar**                         | Estado "Cotação recusada"                                                                      |
| G4  | Em uma solicitação ainda aberta, clique em **Cancelar solicitação** | Estado cancelado                                                                               |

### H. Invalidação (a cotação não pode ficar desatualizada)

| #   | Passo                                                                      | Resultado esperado                                        |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| H1  | Com uma cotação aceita, altere a quantidade ou remova um item do carrinho  | A cotação passa a **invalidada** e exige nova solicitação |
| H2  | Admin: desative uma cidade em `/admin/entregas/areas` e reative em seguida | Cotações abertas daquela cidade ficam invalidadas         |
| H3  | Admin: troque o fornecedor de um produto de uma cotação aberta             | A cotação é invalidada                                    |

### I. Segurança

| #   | Passo                                                                      | Resultado esperado                                         |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| I1  | Sem login, abra `/admin/entregas/solicitacoes`                             | Redireciona para o login                                   |
| I2  | Logado como cliente comum (sem admin), abra `/admin/entregas/solicitacoes` | Acesso negado ou redirecionamento; não mostra solicitações |
| I3  | Com duas contas de cliente, confira em **Minhas entregas**                 | Cada uma vê **somente** as próprias solicitações           |

### J. Celular

Repita E1 a E3 e G1 a G2 no celular (ou na emulação de 390 px): campos legíveis, botões com área de toque confortável, barra inferior sem cobrir o botão de cotação.

## O que registrar

Para cada caso que **falhar**: a tela (print), o que você fez e a mensagem exibida. Se possível, a hora do teste, para eu cruzar com os registros da Vercel e do Supabase.

## Limites conhecidos (não são falhas do teste)

- O WhatsApp oficial e a validade da cotação ainda não estão configurados: o link de WhatsApp não aparece e a cotação não expira.
- Não existe calendário de feriados, então nenhuma data de entrega é calculada.
- A política de cobrança para vários envios ao mesmo endereço ainda não está definida.
- Aceitar a cotação **não** gera pedido, pagamento nem reserva de estoque.

## Limpeza depois dos testes

As solicitações de teste ficam gravadas no banco TEST, com o endereço digitado. Ao terminar, me avise para eu preparar o SQL que remove só as cotações criadas durante o teste.
