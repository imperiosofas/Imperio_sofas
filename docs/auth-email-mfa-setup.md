# Segundo fator por e-mail — desativado

> Estado atual (02/10/2026): o proprietário pediu para desativar MFA por e-mail. A Edge Function `email-password-mfa` versão 3 responde `410 email_mfa_disabled`; as RPCs client de consulta foram revogadas. Este documento descreve o fluxo legado e não é um procedimento ativo. Usuários, fatores TOTP e registros antigos não foram apagados.

O login com senha exige um código de seis dígitos enviado ao e-mail confirmado da conta. O código vence em cinco minutos, permite até cinco tentativas e o envio tem intervalo de 60 segundos e limite de cinco por hora. Google OAuth não recebe esse código; o MFA nativo já configurado continua sendo exigido nas rotas administrativas.

O código é gerado e verificado por uma Supabase Edge Function, enviado pela API Resend e persistido somente como HMAC em tabelas privadas. A confirmação fica vinculada ao `session_id` do Supabase. Não alteramos nem fabricamos a claim `aal`; a autorização da aplicação consulta a sessão verificada. As tabelas privadas não são acessíveis pelo cliente.

## Estado de configuração e validação

As migrations `20261001200845_password_email_mfa_sessions` e `20261001201156_email_mfa_session_fk_indexes` permanecem aplicadas no projeto Supabase `imperiosofas`. A função foi mantida implantada com validação JWT, mas seu handler não envia nem valida códigos. Os secrets de Resend podem permanecer no Supabase sem uso; não copie esses valores para o frontend ou para o Git.

Resta validar manualmente o recebimento do código e a conclusão do login com uma conta de teste de e-mail/senha. Ainda não foi feito envio ponta a ponta nesta sessão.

## Configuração de remetente e segurança

1. Revogue no painel Resend a chave API que foi compartilhada na conversa e crie uma nova. Não a coloque no chat, no `.env` do Next.js ou em variável `NEXT_PUBLIC_*`.
2. Verifique no Resend um domínio/remetente e escolha um `from` autorizado, por exemplo `Império Sofás <acesso@seudominio.com>`.
3. No Supabase, em **Edge Functions → Secrets**, salve `RESEND_API_KEY` com a nova chave e `RESEND_FROM_EMAIL` com o remetente aprovado.
4. Aplique a migration e publique a função `email-password-mfa` com verificação JWT habilitada. A função usa os segredos padrão do Supabase para validar a sessão e acessar os RPCs protegidos.
5. Faça login com uma conta de teste de e-mail confirmado, confira recebimento, validade, limite de tentativas, reenvio e acesso após confirmação. Teste também Google OAuth e confirme que não recebe o código.

Os segredos da Edge Function não são variáveis do frontend e não precisam ser copiados para `.env.local`. Para desenvolvimento local, use o fluxo de secrets local do Supabase e nunca adicione esse arquivo ao Git.

## Limite importante

Código por e-mail é mais acessível, mas oferece proteção inferior a um autenticador TOTP porque a mesma caixa postal pode participar de recuperação de conta. A confirmação implementada protege as rotas da aplicação e o admin, mas não eleva a sessão Supabase para AAL2 nem substitui uma configuração nativa de MFA em produtos que dependam especificamente dessa claim.
