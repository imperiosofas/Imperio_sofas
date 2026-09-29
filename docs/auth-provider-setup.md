# Configuração dos provedores de acesso social

## Estado atual

```text
GOOGLE_OAUTH_STATUS = WAITING_FOR_PROVIDER_CONFIGURATION
APPLE_OAUTH_STATUS = WAITING_FOR_APPLE_DEVELOPER_CONFIGURATION
```

O projeto Supabase `imperiosofas` está ativo, mas os metadados disponíveis não expõem a configuração dos provedores externos. O repositório não contém credenciais OAuth nem configuração local de Google/Apple. Por isso, os botões ficam ocultos por padrão e não devem ser marcados como funcionais ainda.

Ative cada botão somente após configurar e verificar o respectivo provedor no Supabase Auth:

```env
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
NEXT_PUBLIC_AUTH_APPLE_ENABLED=true
```

Essas flags só controlam a apresentação. Client secret, chave privada Apple e demais credenciais ficam exclusivamente nas configurações protegidas do provedor no Supabase — nunca em variáveis `NEXT_PUBLIC_*`, no navegador ou no Git.

## Google

1. Crie um OAuth client do tipo Web na Google Auth Platform e conclua as configurações de consentimento, domínio e marca necessárias.
2. No Supabase, habilite Google em Auth → Providers e cadastre o Client ID e Client Secret.
3. Cadastre na Google Auth Platform o callback exibido pelo provedor Google no painel Supabase. Esse é o endpoint `https://<project-ref>.supabase.co/auth/v1/callback`, não a rota Next.js.
4. Na lista de redirect URLs do Supabase Auth, permita a origem local e a origem de produção efetivamente usadas, incluindo `/auth/callback`.
5. Só então configure `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` no ambiente desejado e teste login/cadastro e retorno seguro.

O controle visual usa o G oficial sem recoloração. A aplicação inicia `signInWithOAuth({ provider: "google" })` via cliente SSR/PKCE; nenhum segredo Google é enviado ao bundle.

## Apple

1. Configure Sign in with Apple no Apple Developer Program, com App ID, Services ID, domínio/return URL e chave privada apropriados para web.
2. No Supabase, habilite Apple em Auth → Providers e insira a configuração solicitada diretamente no painel.
3. Permita no Supabase o redirect de aplicação usado para `/auth/callback` nos ambientes efetivamente existentes.
4. Mantenha a chave privada Apple fora do repositório, dos logs e de variáveis públicas.
5. Só então configure `NEXT_PUBLIC_AUTH_APPLE_ENABLED=true` e teste o fluxo real em ambiente autorizado.

O artwork do botão é fornecido pelo endpoint oficial da Apple, localizado em `public/auth/apple-continue-pt-br.png`; não redesenhar, recolorir, recortar nem substituir sua arte.

## Callback, destino e MFA

Ambos os botões retornam a `/auth/callback`. A rota usa o cliente Supabase server-side para trocar o código PKCE por sessão/cookies, envia headers `no-store`/`no-referrer` e aceita apenas destinos internos validados por `getSafeAuthReturnTo`. O parâmetro `next=/carrinho` continua permitido; URLs externas e variantes ambíguas continuam rejeitadas. O destino resultante mantém os guards existentes, inclusive a verificação MFA de `/carrinho`.

Se o provedor retornar erro, a interface mostra uma mensagem genérica; detalhes técnicos do Auth não são repassados ao usuário. Linking/merge manual de contas não foi implementado. Use apenas o comportamento de vinculação automática documentado e suportado pelo Supabase para identidade com e-mail verificado; não una usuários manualmente com base apenas em e-mail informado por um cliente.

## Identidade e nome

O campo `full_name` da tela antiga apenas gravava metadata no signup. Não há leitura desse dado, requisito de banco, perfil consumidor ou trigger no projeto. Portanto, o novo signup não pede nem grava nome e não adiciona onboarding pós-cadastro sem uso concreto.

## Referências oficiais

- [Supabase — Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase — `signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
- [Supabase — Account linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Google Identity branding guidelines](https://developers.google.com/identity/branding-guidelines)
- [Apple — Sign in with Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple/)
- [Apple — Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)
