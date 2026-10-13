# Autenticação de clientes

## Fluxos implementados

- `/conta`: login por senha e OAuth criam sessão normal e seguem para o destino interno validado; nenhum código MFA/TOTP é enviado ou solicitado automaticamente, inclusive quando a conta já possui fator.
- `/conta`: login/cadastro visualmente progressivos; o e-mail é informado antes da senha. OAuth Google/Apple usa `signInWithOAuth` e permanece oculto até a configuração explícita do provedor.
- `/conta`: composição mobile-first marinho/marfim/dourado, marca centralizada, seletor Entrar/Criar conta com indicador compartilhado e cartão único. A etapa de e-mail não consulta se a conta existe; normaliza e valida localmente antes de avançar. Login, cadastro, recuperação e redefinição compartilham os mesmos tokens e campos.
- `/conta/redefinir-senha`: atualização da senha após a confirmação server-side do token hash de recuperação.
- `/conta/seguranca`: adesão opcional a TOTP por QR ou chave manual, verificação antes de ativar e novo código exigido antes de desativar.
- `/auth/confirm`: verifica no servidor os `token_hash` de confirmação e recuperação do e-mail; restringe destinos ao allowlist interno compartilhado com os callbacks OAuth.
- `/auth/callback`: troca de código OAuth PKCE por sessão em cookies SSR e redirect sem cache; permite somente destinos internos allowlisted por `getSafeAuthReturnTo`.
- `proxy.ts`: atualiza cookies/sessão em cada requisição quando o Supabase está configurado. A autorização continua sendo verificada nas rotas de servidor; Proxy não é a barreira de permissão.
- Páginas privadas validam claims assinadas com `getClaims()`. MFA/AAL2 não é gate para conta, carrinho ou administração. `/admin` e mutações continuam exigindo sessão válida e membership explícita em `public.catalog_admins`, verificada também por RLS.

O cadastro público nunca concede papel administrativo. O cadastro não pede nem grava nome: `full_name` era apenas metadata sem consumidor no produto. Nenhum dado de `user_metadata` ou fator é usado como autorização administrativa. A membership de admin continua provisionada operacionalmente e protegida por RLS.

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
6. A gestão TOTP em `/conta/seguranca` permanece opcional. A decisão atual do proprietário desativa qualquer exigência de MFA/AAL2 para login e admin; fatores cadastrados não são removidos automaticamente.
7. Reinicie `npm run dev` e valide `/conta`, confirmação e recuperação com uma conta de teste; acesso administrativo exige sessão + membership, sem etapa TOTP.

Os links de redirecionamento do Supabase precisam corresponder exatamente aos ambientes aprovados; não use `*` amplo em produção. Nenhuma dessas configurações externas foi homologada nesta máquina. Sem URL/chave, a tela local mostra indisponibilidade explícita e bloqueia submissões; isso não representa um login funcional.

## Limites de segurança desta etapa

- Login, cadastro e recuperação usam Supabase Auth diretamente pelo SDK oficial; respostas de login/cadastro não revelam se um endereço existe, e recuperação usa uma mensagem genérica. Um bloqueio de submissão no componente evita duplo envio acidental.
- A limitação principal de tentativas é a nativa do Supabase Auth. Não há endpoint próprio de autenticação que precise de rate limiter adicional. Revise/ajuste os limites no projeto Supabase quando homologar.
- CAPTCHA/Turnstile não está habilitado porque não há chaves/domínio homologados. O controle anti-bot adicional continua pendente de configuração externa; não há chave fictícia no código.
- O frontend não contém service-role key. Cookies SSR são gerenciados pelo `@supabase/ssr`; páginas de conta nunca autorizam com `getSession()` nem com estado React. Rotas customizadas de callback validam destinos relativos internos.

- MFA administrativo está temporariamente desativado por decisão explícita do proprietário. A página de gestão de TOTP permanece opcional; fatores existentes são preservados e não são exigidos no login.
- O fluxo de código por e-mail está desativado: a Edge Function `email-password-mfa` responde `410 email_mfa_disabled` e a RPC de consulta não está disponível para roles cliente. Tabelas e desafios históricos não foram apagados.
- A política de admin requer sessão autenticada e membership provisionada fora do cadastro; guard server-side e RLS validam a mesma membership. Não inferir role pelo e-mail ou `user_metadata`.
- A mudança não apaga fatores, usuários nem roles. Se o usuário voluntariamente configurar TOTP, a própria tela de gestão pode exigir challenge para ativar/remover esse fator.
- Antes do go-live ainda devem ser aprovados política de privacidade/termos, remetente, URLs canônicas, configurações de proteção antiabuso do Supabase e evidência de teste com contas controladas.
