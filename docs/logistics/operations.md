# Logística — operação local e homologação

## Limite desta fase

Esta fundação serve para validar modalidades e negociar frete antes de existir checkout. Ela não autoriza cobrança nem representa um pedido. O Supabase autorizado nesta fase é somente o projeto de teste; a Vercel, ambientes de produção, MFA, pedidos e pagamentos permanecem fora do escopo.

## Pré-condições antes de testar uma cotação pelo site

1. Confirmar no histórico do Supabase TEST as migrations `20261020223338_logistics_foundation` e `20261020224530_logistics_foreign_key_indexes` aplicadas nesta homologação.
2. Executar o arquivo pgTAP em transação com `ROLLBACK`; confirmar zero falhas e ausência de resíduos de fixture.
3. Configurar `SUPABASE_SECRET_KEY` somente no `.env.local` ignorado pelo Git. Nunca colar a chave no chat, código, documentação, variáveis `NEXT_PUBLIC_*` ou console do navegador.
4. Reiniciar o servidor local. Sem essa configuração, a criação de cotação privilegiada deve falhar de modo explícito e fechado.
5. Classificar cada produto apenas com confirmação do responsável comercial. Todos os produtos legados devem continuar sem fornecedor até essa decisão.
6. Confirmar o telefone WhatsApp oficial, endereço(s) de retirada e prazos operacionais antes de ativar comunicação ou novos locais.

## Fluxo de homologação

1. Adicionar ao carrinho uma variante ativa e em estoque de produto classificado manualmente.
2. Escolher entrega ou retirada para cada grupo de fornecedor. Mundial nunca oferece retirada.
3. Para entrega, consultar o CEP; verificar o município aprovado e informar número e andar. Uma falha no ViaCEP/IBGE ou cidade não habilitada deve bloquear a cotação.
4. Enviar a solicitação. O servidor relê o carrinho, valida sessão, produto, variante, preço, estoque, fornecedor, modo e endereço; a cotação não reserva estoque.
5. No Admin, revisar endereço e itens, negociar e lançar o frete-base de cada grupo de entrega. Não duplicar o adicional por andar entre fornecedores.
6. O cliente revisa o total e aceita ou recusa. Mudanças no carrinho, endereço ou cobertura tornam a proposta obsoleta e exigem nova cotação.
7. Repetir os testes com dois fornecedores, retirada Vale, cidade fora da lista, cidade desativada, variante inativa/sem estoque, edição do carrinho e alteração administrativa de fornecedor/local.

### Classificação em lote

Em `/admin/entregas/produtos`, a ação em lote exige seleção individual, escolha explícita do fornecedor e confirmação do operador. O servidor aceita de 1 a 100 IDs únicos; a RPC transacional reutiliza, para cada produto, a regra administrativa auditada da ação individual. Qualquer erro aborta o lote inteiro. Nenhum item é selecionado ou classificado automaticamente.

## Migração e dados de teste

- Confirmar o identificador e estado do projeto antes de qualquer operação; ele deve ser o Supabase TEST autorizado.
- Conferir o histórico de migrations e aplicar somente migrations revisadas pelo mecanismo oficial ao Supabase TEST, sem `db reset`, `repair` ou DDL manual de produção.
- A suíte `supabase/tests/logistics_foundation.sql` usa fixtures temporárias dentro de transação e deve terminar com `ROLLBACK`. Nunca executar fixtures em sessão sem confirmar esse rollback.
- Antes e depois: verificar 51 produtos, nenhum fornecedor atribuído automaticamente, duas configurações de fornecedor, 12 áreas aprovadas, e o único galpão confirmado do Vale. Após os testes, confirmar que não restaram produtos, variantes, carrinhos, cotações, eventos ou locais temporários de teste.
- Se uma migração falhar, parar e inspecionar a causa; não improvisar alteração remota nem reaplicar DDL parcial.

## Operação segura e itens pendentes

- A chave privilegiada não é exigida para carregar informações públicas de modalidade; é necessária para a RPC server-only de criação de cotação. A chave continua ausente neste `.env.local` no momento desta escrita.
- O rate limit de solicitações em memória é uma defesa auxiliar de um processo, não proteção distribuída. Antes de tráfego real, adicionar limite compartilhado e monitoramento de abuso.
- Não habilitar todos os municípios de SP. Habilitar apenas a allowlist aprovada e mediante confirmação operacional.
- Não configurar prazo de expiração, telefone, produto ou local por suposição. A política para múltiplas entregas no mesmo destino segue pendente.
- Calendário de feriados não configurado; os prazos continuam expressos em dias úteis informados pelos fornecedores, sem conversão para datas estimadas ou feriados presumidos.
- Prazo de retenção/expurgo ainda não aprovado. O endereço permanece no snapshot operacional e o fingerprint é um digest pseudônimo usado para idempotência; nenhum deles deve ir para logs. Definir retenção/exclusão antes da operação comercial.
- Checkout, pedido, pagamento, reserva de estoque, nota fiscal, etiqueta e rastreamento exigem fases próprias e não devem consumir a cotação aceita como se ela fosse um pedido.
- `ANALYTICS_FASE_2` permanece pendente para depois de pedidos, frete, checkout e pagamentos.

## Evidências desta execução

Atualizar esta seção somente com resultados observados. Não declarar PASS por inspeção de código.

- Migrations Supabase TEST: `20261020223338_logistics_foundation`, `20261020224530_logistics_foreign_key_indexes` e `20261021154845_logistics_operational_hardening`, aplicadas pelo mecanismo oficial e confirmadas no histórico.
- pgTAP Supabase TEST: plano completo `1..164` executado em transação com `ROLLBACK`, sem diagnóstico de falha; consulta posterior confirmou zero fixtures. Cobriu RLS/isolamento entre clientes, autorização do bulk RPC, atomicidade e limite de lote, digest do fingerprint, cálculo por andar, transições/expiração e impossibilidade de aceitar sem frete de todos os grupos.
- Configuração local: `SUPABASE_SECRET_KEY` ausente no `.env.local`; nenhuma credencial foi criada nem exposta. `.env.local` está ignorado pelo Git e não há `NEXT_PUBLIC_SUPABASE_SECRET_KEY`. A cotação real pela aplicação local permanece bloqueada; o serviço server-only falha fechado.
- Estado remoto após rollback: 51 produtos, os 51 sem fornecedor; 0 fixtures de teste, 0 cotações/grupos/itens; 2 fornecedores, 12 áreas habilitadas e 1 local ativo do Vale preservados.
- Código local: testes focados de logística/admin 47/47 PASS; `typecheck` PASS; ESLint nos arquivos alterados PASS; Prettier nos arquivos alterados PASS; `git diff --check` PASS. A varredura global `npm run lint` foi interrompida após execução prolongada sem saída; isso não foi classificado como falha. Build e E2E de navegador não foram executados nesta rodada.
- QA visual Admin: bloqueado nesta sessão por ausência de sessão administrativa acessível; não houve tentativa de contornar autenticação nem solicitação de senha/código. Não foram produzidas capturas autenticadas.
- Supabase Advisors: nenhum finding novo associado à função bulk SECURITY INVOKER; permanecem findings preexistentes de RPC SECURITY DEFINER autenticáveis, tabelas RLS sem policies (com grants diretos revogados/guards testados), proteção contra senha vazada desativada, índices não utilizados em baixo tráfego e múltiplas policies permissivas em `product_reviews`.
- E2E local anterior a esta mudança: 34/34 PASS em viewports 320–1440 px. O fluxo operacional real cliente→vendedor→proposta não foi exercitado por falta da chave server-side e de sessão Admin; os testes pgTAP exercitam a fundação de banco com fixtures revertidas.

O vendedor ainda não tem papel/permissão separado no modelo atual: cotas e atribuições do Admin exigem a membership administrativa existente. Confirmar se vendedores devem entrar nesse mesmo grupo ou receber um papel operacional próprio antes de ampliar o acesso.
