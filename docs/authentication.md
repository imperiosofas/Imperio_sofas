# Autenticação de clientes

## Fluxos implementados

- `/conta`: login, cadastro somente de cliente, confirmação por e-mail, recuperação de acesso e desafio TOTP quando a conta já possui fator verificado.
- `/conta/redefinir-senha`: atualização da senha após o callback PKCE de recuperação.
- `/conta/seguranca`: adesão opcional a TOTP por QR ou chave manual, verificação antes de ativar e novo código exigido antes de desativar.
- `/auth/callback`: troca o código PKCE por sessão em cookies e permite somente destino relativo interno.
- `proxy.ts`: atualiza cookies/sessão em cada requisição quando o Supabase está configurado. A autorização continua sendo verificada nas rotas de servidor; Proxy não é a barreira de permissão.

Não existe cadastro público, papel ou painel de administrador nesta etapa. O cadastro grava apenas `full_name` em metadados de perfil, nunca papel de acesso. Nenhum dado do usuário ou fator é usado como autorização administrativa. O bootstrap de admin continua seguindo D-009 e depende de provisionamento operacional e políticas RLS próprias.

## Ativação local e do projeto Supabase

1. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local`, criado a partir de `.env.example`. A chave publicável é apropriada para o navegador com RLS; **não** coloque `SUPABASE_SERVICE_ROLE_KEY` no bundle, em formulário, ou em variável `NEXT_PUBLIC_*`.
2. Na configuração de Auth do projeto Supabase, habilite confirmação de e-mail e defina a URL de site. Inclua `/auth/callback` na lista de redirect URLs para localhost e para cada origem HTTPS de produção aprovada.
3. Configure um provedor SMTP/remetente verificado para e-mails de produção. O fluxo depende dos links PKCE de confirmação e recuperação chegarem ao mesmo domínio configurado.
4. Defina a política de comprimento mínimo de senha do projeto com pelo menos 12 caracteres, consistente com o formulário. A política do provedor é a fonte de validação, pois regras apenas no browser podem ser contornadas.
5. Confirme TOTP como fator permitido no Supabase. A adesão de clientes é voluntária; uma conta com TOTP verificado deve completar AAL2 no login antes de seguir. Não existe envio nem reenvio de código SMS.
6. Reinicie `npm run dev` e valide `/conta`, confirmação, recuperação, inscrição/desinscrição TOTP e entrada com fator habilitado usando uma conta de teste.

Os links de redirecionamento do Supabase precisam corresponder exatamente aos ambientes aprovados; não use `*` amplo em produção. Nenhuma dessas configurações externas foi homologada nesta máquina. Sem URL/chave, a tela local mostra indisponibilidade explícita e bloqueia submissões; isso não representa um login funcional.

## Limites de segurança desta etapa

- TOTP protege autenticação de cliente por opção do titular. Esta feature ainda não implementa API comercial, painel admin nem autorização de operações administrativas.
- A política de admin requer role provisionada fora do cadastro e enforcement server-side + RLS/AAL2 nas operações sensíveis; não inferir role pelo e-mail ou `user_metadata`.
- Recuperação de conta e códigos de contingência/recuperação do fator dependem de procedimento de suporte aprovado. Não desative MFA sem código atual.
- Antes do go-live ainda devem ser aprovados política de privacidade/termos, remetente, URLs canônicas, configurações de proteção antiabuso do Supabase e evidência de teste com contas controladas.
