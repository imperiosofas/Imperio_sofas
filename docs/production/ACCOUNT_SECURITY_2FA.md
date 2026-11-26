# Segurança das contas — autenticação em dois fatores (2FA)

Toda conta que controla a loja precisa de 2FA antes do lançamento. Em 26/11/2026 o
painel da Vercel mostrava o aviso "Enable 2FA" nas duas contas (time Império Sofás e
conta pessoal). As demais contas não foram conferidas (**NÃO VERIFICADO**).

Regras gerais:

- Use um **aplicativo autenticador** (Google Authenticator, Microsoft Authenticator,
  1Password, Authy) ou uma **chave de segurança/passkey**. Evite SMS quando houver
  alternativa.
- **Guarde os códigos de recuperação** fora do computador (gerenciador de senhas ou
  papel em local seguro). Sem eles, perder o celular pode significar perder a conta.
- Cada pessoa tem o próprio login. Não compartilhar senha nem o mesmo autenticador.
- Os caminhos abaixo podem mudar de nome nos painéis; a função é a mesma.

## Ordem recomendada (do mais crítico ao menos)

| #   | Conta                                             | Por que é crítica                       | Quem             |
| --- | ------------------------------------------------- | --------------------------------------- | ---------------- |
| 1   | E-mail usado nos cadastros (Google/Outlook)       | recupera todas as outras contas         | Você e o cliente |
| 2   | GitHub (pessoal **e** organização `imperiosofas`) | código e deploys                        | Você             |
| 3   | Vercel (time "Imperio Sofas" e conta pessoal)     | site, variáveis e domínio               | Você             |
| 4   | Supabase                                          | banco, clientes e pedidos               | Você             |
| 5   | Mercado Pago                                      | dinheiro e estornos                     | Cliente          |
| 6   | Resend                                            | e-mails da loja                         | Você             |
| 7   | Registro do domínio (ex.: Registro.br)            | quem controla o domínio controla o site | Cliente/Você     |

## Passo a passo

### 1. E-mail (Google)

Conta Google → **Segurança** → **Verificação em duas etapas** → ativar →
adicionar app autenticador ou passkey → salvar códigos de backup.

### 2. GitHub

- **Pessoal:** foto → **Settings** → **Password and authentication** →
  **Enable two-factor authentication** → app autenticador → salvar os _recovery codes_.
  Adicionar também uma passkey, se possível.
- **Organização `imperiosofas`:** **Settings** da organização →
  **Authentication security** → marcar **Require two-factor authentication for
  everyone** (só depois que todos os membros ativarem, senão quem não tiver 2FA é
  removido da organização).

### 3. Vercel (fazer nas duas contas)

Avatar → **Account Settings** → **Authentication** → **Two-Factor Authentication**
→ ativar com app autenticador → salvar códigos. Alternativa: clicar no aviso
"Enable 2FA" que aparece no painel.

### 4. Supabase

Avatar → **Account preferences** → **Multi-Factor Authentication** → adicionar app
autenticador. Na organização, conferir **quem é membro** e remover acessos que não
são mais usados.

### 5. Mercado Pago (cliente)

**Seu perfil** → **Segurança** → **Verificação em duas etapas** → ativar.
Recomendado também para quem acessar o painel de desenvolvedor (Suas integrações).

### 6. Resend

**Settings** → **Account**/**Security** → **Two-factor authentication** → ativar.

### 7. Registro do domínio

No Registro.br (se for o registrador): **Configurações da conta** → **Autenticação em
dois fatores** → ativar. Confirmar também quem é o titular e o contato técnico.

## Depois de ativar

- Anotar em lugar seguro: conta, quem tem acesso, onde estão os códigos de recuperação.
- Revisar os membros de cada conta e remover acessos antigos.
- No lançamento, conferir esta lista de novo (critério 12 de
  `INDEPENDENT_PRODUCTION_REVIEW.md`).
