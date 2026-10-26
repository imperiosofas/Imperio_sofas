# Homologação operacional da logística

Data: 21/10/2026  
Ambiente de banco autorizado: Supabase TEST (`imperiosofas`, `qsafyqsskwbjnailgoev`)

## Resultado

**Fundação de banco e guardas: homologadas no TEST. Fluxo real ponta a ponta pela interface: bloqueado por configuração local e sessão Admin indisponíveis.** Nenhum produto foi classificado e nenhum dado comercial foi alterado.

## O que foi implementado/aplicado

- Migration `20261021154845_logistics_operational_hardening`: fingerprint versionado como SHA-256 no banco, com endereço mantido apenas nas colunas operacionais da cotação; constraint de formato e RPC atômica para classificar de 1 a 100 produtos explicitamente selecionados.
- A RPC de lote é `SECURITY INVOKER`, concedida apenas a `authenticated`, e delega cada item à função administrativa auditada existente. A membership de Admin continua sendo a autorização efetiva. Erro em qualquer produto reverte o lote inteiro.
- `/admin/entregas/produtos` agora permite selecionar produtos, escolher Vale ou Mundial e confirmar a alteração. Não há seleção/classificação automática; a ação individual permanece disponível.
- O fingerprint de idempotência no navegador também é digest opaco em memória, em vez de manter a serialização do endereço como chave.
- Configurações exibem que telefone oficial, calendário de feriados e política de entregas múltiplas seguem pendentes. Nenhum número, data ou regra comercial foi inventado.

## Evidência de banco e segurança

- Histórico remoto confirma as três migrations logísticas, incluindo `20261021154845_logistics_operational_hardening`.
- `supabase/tests/logistics_foundation.sql`: pgTAP concluiu o plano `1..164` em transação revertida, sem falhas reportadas. Inclui acesso anon/non-admin, escopo de clientes, atribuição em lote/limite/atomicidade, fingerprint sem endereço em claro, CEP/cobertura, adicional por andar, proposta e ciclo/expiração.
- Após `ROLLBACK`: 51 produtos; 51 sem fornecedor; 0 fixtures, 0 cotações, grupos ou itens; 2 fornecedores; 12 áreas habilitadas; 1 local ativo do Vale.
- Grants do RPC em banco: `authenticated=YES`, `anon=NO`, `service_role=NO`. As alterações por produto continuam passando pela função existente, que valida membership administrativa e gera auditoria.
- Advisors ainda reportam avisos preexistentes sobre funções `SECURITY DEFINER`, tabelas com RLS sem policies, proteção contra senha vazada desativada, índices não utilizados com pouco tráfego e múltiplas policies em `product_reviews`. Os grants diretos das tabelas logísticas seguem revogados; não alterei esses findings nesta tarefa.

## Evidência local

- `SUPABASE_SECRET_KEY`: **MISSING** no `.env.local`. O arquivo está ignorado pelo Git; nenhuma chave foi criada, impressa ou movida para o bundle público. Sem ela, o endpoint server-only de criação da cotação fecha a operação com segurança.
- Testes focados logística/admin: **47/47 PASS**.
- `npm run typecheck`: **PASS**.
- ESLint nos arquivos desta mudança: **PASS**.
- Prettier nos arquivos desta mudança: **PASS**.
- `git diff --check`: **PASS**.
- A varredura global de lint foi interrompida após execução prolongada sem saída; isso não foi classificado como falha. Build e E2E de navegador não foram executados nesta rodada.
- Não foi possível validar visualmente Admin desktop/mobile: não havia sessão administrativa acessível. Não houve solicitação de senha ou tentativa de contornar autenticação.

## Bloqueios e decisões necessárias

1. Adicionar localmente a chave server-side já existente ao `.env.local` ignorado, sem compartilhá-la no chat, para liberar teste real de solicitação autenticada.
2. Entrar manualmente com uma sessão administrativa legítima e repetir a homologação visual desktop/mobile e a edição em lote.
3. Definir se vendedores serão membros Admin ou se haverá papel operacional próprio. Hoje leitura de solicitações, lançamento de frete e atribuição de fornecedor exigem membership Admin.
4. Confirmar quais produtos pertencem a Vale ou Mundial antes de usar a ação em massa.
5. Definir retenção e expurgo do endereço de cotação. O digest do fingerprint é pseudônimo, não anonimização, e também deve ser tratado como sensível. Não existe prazo ou expurgo automático configurado.
6. Confirmar número oficial WhatsApp, calendário de feriados e política de cobrança quando houver múltiplas entregas ao mesmo destino.
7. Não há rotas/tabelas/RPCs de checkout, pedido ou pagamento no fluxo atual; por isso não existe pagamento habilitado nem um gate de pagamento para testar. Checkout futuro deverá exigir cotação vigente e aceita, frete de todos os grupos e revalidação server-side.

`ANALYTICS_FASE_2` continua pendente para depois de pedidos, frete, checkout e pagamento. Vercel não foi acessada ou alterada; sem push, deploy, Docker ou mudança de MFA.
