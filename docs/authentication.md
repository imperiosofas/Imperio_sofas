# Autenticação de clientes

## Fluxos implementados

- `/conta`: login, cadastro somente de cliente, confirmação por e-mail, recuperação de acesso e desafio TOTP quando a conta já possui fator verificado.
- `/conta`: login/cadastro visualmente progressivos; o e-mail é informado antes da senha. OAuth Google/Apple usa `signInWithOAuth` e permanece oculto até a configuração explícita do provedor.
- `/conta`: composição mobile-first marinho/marfim/dourado, marca centralizada, seletor Entrar/Criar conta com indicador compartilhado e cartão único. A etapa de e-mail não consulta se a conta existe; normaliza e valida localmente antes de avançar. Login, cadastro, recuperação, redefinição e MFA compartilham os mesmos tokens e campos.
- `/conta/redefinir-senha`: atualização da senha após a confirmação server-side do token hash de recuperação.
- `/conta/seguranca`: adesão opcional a TOTP por QR ou chave manual, verificação antes de ativar e novo código exigido antes de desativar.
- `/auth/confirm`: verifica no servidor os `token_hash` de confirmação e recuperação do e-mail; restringe destinos ao allowlist interno compartilhado com os callbacks OAuth.
- `/auth/callback`: troca de código OAuth PKCE por sessão em cookies SSR e redirect sem cache; permite somente destinos internos allowlisted por `getSafeAuthReturnTo`.
- `proxy.ts`: atualiza cookies/sessão em cada requisição quando o Supabase está configurado. A autorização continua sendo verificada nas rotas de servidor; Proxy não é a barreira de permissão.
- `/conta`, `/conta/seguranca` e `/conta/redefinir-senha` validam claims assinadas com `getClaims()` e, no servidor, exigem AAL2 quando o projeto sinaliza `nextLevel=aal2`. Sessões em AAL1 são mantidas na tela de desafio TOTP; falha ao consultar claims/AAL resulta em negação (fail closed).

Não existe cadastro público, papel ou painel de administrador nesta etapa. O cadastro não pede nem grava nome: `full_name` era apenas metadata sem consumidor no produto. Nenhum dado do usuário ou fator é usado como autorização administrativa. O bootstrap de admin continua seguindo D-009 e depende de provisionamento operacional e políticas RLS próprias.

O estado das credenciais e passos de habilitação do OAuth social está em [`auth-provider-setup.md`](./auth-provider-setup.md). Até a confirmação do Google Cloud/Apple Developer e dos providers no Supabase, os estados são `GOOGLE_OAUTH_STATUS = WAITING_FOR_PROVIDER_CONFIGURATION` e `APPLE_OAUTH_STATUS = WAITING_FOR_APPLE_DEVELOPER_CONFIGURATION`.

## Ativação local e do projeto Supabase

1. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.local`, criado a partir de `.env.example`. A chave publicável é apropriada para o navegador com RLS; **não** coloque `SUPABASE_SERVICE_ROLE_KEY` no bundle, em formulário, ou em variável `NEXT_PUBLIC_*`.
2. Na configuração de Auth do projeto Supabase, habilite confirmação de e-mail e defina a URL de site. Inclua `/auth/confirm` e `/auth/callback` na lista de redirect URLs para localhost e para cada origem HTTPS de produção aprovada.
3. Configure um provedor SMTP/remetente verificado para e-mails de produção. Os links de confirmação e recuperação precisam chegar ao mesmo domínio configurado.
4. Altere os templates de e-mail no Dashboard para que a verificação aconteça por token hash no servidor:

   - **Confirm signup:** use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/conta`.
   - **Reset password:** use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/conta/redefinir-senha`.

   Os links acima são exemplos de template; personalize o texto e preserve esses parâmetros. O callback valida o tipo e o destino permitido antes de criar a sessão.

5. Confira a política efetiva de senha em Auth > Settings antes de documentar requisitos numéricos. A interface não impõe comprimento mínimo inventado; o Supabase valida a política configurada e devolve um erro genérico de senha fraca. A configuração remota não pôde ser inspecionada nesta sessão.
6. Confirme TOTP como fator permitido no Supabase. A adesão de clientes é voluntária; uma conta com TOTP verificado deve completar AAL2 no login antes de seguir. Não existe envio nem reenvio de código SMS.
7. Reinicie `npm run dev` e valide `/conta`, confirmação, recuperação, inscrição/desinscrição TOTP e entrada com fator habilitado usando uma conta de teste.

Os links de redirecionamento do Supabase precisam corresponder exatamente aos ambientes aprovados; não use `*` amplo em produção. Nenhuma dessas configurações externas foi homologada nesta máquina. Sem URL/chave, a tela local mostra indisponibilidade explícita e bloqueia submissões; isso não representa um login funcional.

## Limites de segurança desta etapa

- Login, cadastro e recuperação usam Supabase Auth diretamente pelo SDK oficial; respostas de login/cadastro não revelam se um endereço existe, e recuperação usa uma mensagem genérica. Um bloqueio de submissão no componente evita duplo envio acidental.
- A limitação principal de tentativas é a nativa do Supabase Auth. Não há endpoint próprio de autenticação que precise de rate limiter adicional. Revise/ajuste os limites no projeto Supabase quando homologar.
- CAPTCHA/Turnstile não está habilitado porque não há chaves/domínio homologados. O controle anti-bot adicional continua pendente de configuração externa; não há chave fictícia no código.
- O frontend não contém service-role key. Cookies SSR são gerenciados pelo `@supabase/ssr`; páginas de conta nunca autorizam com `getSession()` nem com estado React. Rotas customizadas de callback validam destinos relativos internos.

- TOTP protege autenticação de cliente por opção do titular. Esta feature ainda não implementa API comercial, painel admin nem autorização de operações administrativas.
- A política de admin requer role provisionada fora do cadastro e enforcement server-side + RLS/AAL2 nas operações sensíveis; não inferir role pelo e-mail ou `user_metadata`.
- Recuperação de conta e códigos de contingência/recuperação do fator dependem de procedimento de suporte aprovado. Não desative MFA sem código atual.
- Antes do go-live ainda devem ser aprovados política de privacidade/termos, remetente, URLs canônicas, configurações de proteção antiabuso do Supabase e evidência de teste com contas controladas.
