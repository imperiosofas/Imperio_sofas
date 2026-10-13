# Primeiro slice do administrativo: catálogo

## Escopo entregue

- `/admin` encaminha para `/admin/produtos`; a área oferece categorias e uma lista operacional filtrável, sem dashboard ou métricas fictícias.
- Cadastro e edição de produto, múltiplas variações, SKU, preço em centavos, dimensões, tecido/cor, estoque e limite de alerta.
- Upload privado de imagens (JPG/PNG/WebP até 10 MB), normalizado para WebP, texto alternativo obrigatório, remoção e preview temporário assinado.
- Salvamento transacional de produto/variações/estoque; publicação só ocorre com categoria ativa, variação vendável, saldo disponível e imagem descrita. Rascunho, despublicação e arquivamento não apagam dados.
- O storefront continua lendo somente as projeções públicas já existentes; não recebe acesso direto às tabelas de administração.

## Acesso e provisionamento do primeiro administrador

O acesso exige uma sessão autenticada e uma linha em `public.catalog_admins`; MFA/AAL2 está temporariamente desativado por decisão do proprietário. Não se usa `user_metadata`, e não existe administrador padrão. Em 02/10/2026, a única membership foi provisionada para a conta confirmada indicada pelo proprietário; a verificação remota confirmou exatamente uma linha ativa. O bucket `catalog-images` continua privado. RLS, o guard server-side e as Server Actions verificam membership; layouts não são tratados como barreira de segurança. A migration `20261002164104_restore_catalog_admin_aal2_and_audit_rls` habilitou RLS no log privado de auditoria; a migration `20261002175919_disable_mandatory_admin_mfa` remove o gate AAL2 do helper sem abrir as policies.

O TOTP em `/conta/seguranca` permanece disponível como gestão voluntária, mas não é necessário para entrar ou executar operações de catálogo. Sessões normais autenticadas passam pelo guard e a membership segue obrigatória no servidor e no banco.

Para uma futura alteração de administradores, confirme a identidade e a conta já registrada antes de um responsável autorizado modificar `public.catalog_admins`. O procedimento usado para o provisionamento inicial foi:

```sql
insert into public.catalog_admins (user_id, enabled_by)
select id, id
from auth.users
where lower(email) = lower('EMAIL_CONFIRMADO')
on conflict (user_id) do nothing;
```

Esse SQL não faz parte da migração, não cria conta e não deve ser colocado no frontend. O usuário precisa iniciar uma sessão autenticada e estar explicitamente cadastrado para acessar `/admin/produtos`. Para revogar o acesso, use `delete from public.catalog_admins where user_id = '<UUID_CONFIRMADO>';` após confirmar identidade e impacto.

## Decisões e limites deste slice

- Não há carrinho, checkout, pagamento, frete calculado, pedidos ou dashboard.
- Uma categoria pode ser criada inativa e ativada explicitamente; desativá-la impede que seus itens apareçam no catálogo público.
- Apagar uma imagem remove seu registro e objeto; arquivar produto preserva histórico. Produto/variação não é apagado fisicamente nesta etapa.
- A tabela de auditoria guarda ator, tabela, UUID do registro, operação e horário, sem copiar dados comerciais completos.
- A proteção de publicação é server-side/transacional. Custos e tributos não são inferidos; o preço é digitado pelo administrador em BRL e persistido em centavos.

## Homologação necessária

O caminho real ainda precisa de teste ponta a ponta após login da conta provisionada e uma operação de catálogo de teste. Não reative MFA/AAL automaticamente; isso só deve ocorrer mediante solicitação explícita do proprietário. Não enviar tokens, service-role keys ou códigos TOTP ao chat.
