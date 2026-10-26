# Segurança e privacidade de Analytics

## Fronteiras obrigatórias

- Página, ações, APIs e RPCs revalidam membership de admin; esconder link no shell não é autorização.
- Supabase usa a sessão autenticada normal do servidor. `SUPABASE_SECRET_KEY`/service-role não entra no bundle, route output, logs ou export.
- Agregados operacionais executam como `SECURITY INVOKER`; negar `public`/`anon`, autorizar `authenticated` e checar `private.is_catalog_admin()` no RPC. Não usar `user_metadata` em decisão de autorização.
- RLS atual de catálogo, carrinho, favoritos, Storage e administração não será enfraquecida. A quantidade exata continua somente no admin.
- Exportação compartilha os guards e o serviço da tela, limita paginação/memória e remove dados pessoais/signed URLs.
- Sanitizar formula injection em células de texto sem converter números negativos válidos em strings.

## Privacidade e coleta

- Neste checkout não foi encontrado mecanismo de consentimento de analytics nem política aprovada de retenção. Portanto não habilitar tracking first-party não essencial, não coletar IP/email/token/fingerprint nem guardar busca livre nesta entrega antes da decisão do proprietário.
- Sessão pseudônima, caso aprovada em futuro escopo, precisará de opt-in/opt-out, rotação/expiração, retenção limitada, rate limit, payload allowlist, dedupe e agregação.
- Eventos do browser são indicadores de interesse, nunca prova de venda/pagamento.
- LGPD: aprovar base legal, aviso, consentimento e retenção antes de ativar instrumentação. Estado padrão é não coletar.

## Verificação de segurança integrada — 15/10/2026

- **Autorização estática e DB:** layout, serviço e export usam `requireCatalogAdmin`; a nova RPC usa `SECURITY INVOKER`, `search_path` vazio e verifica membership por `private.is_catalog_admin()`. A migration revoga `PUBLIC`/`anon` e concede `authenticated`. A chamada de leitura autorizada foi confirmada no projeto TEST; não foi simulada permissão por `user_metadata`.
- **HTTP negativo:** E2E local confirma categoria inválida e categoria duplicada com HTTP 400 e visitante sem sessão com HTTP 401. Testes do handler isolado confirmam 403 para uma negativa do guard e 200 para workbook real, incluindo filtro e headers privados. A integração com sessão real de admin/não-admin não foi testada no browser nesta sessão.
- **Chaves e browser:** nenhum nome de secret Supabase foi encontrado no código Analytics/client examinado, `.env.local` está ignorado pelo Git e o build recém-gerado não contém padrões `sb_secret_*`, `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` em chunks de cliente. Valores do arquivo não foram lidos para log nem registrados.
- **Workbook:** allowlist de campos exclui dados pessoais, IDs de cliente, descrições livres, caminhos de Storage e URLs assinadas; teste reabre o XLSX gerado e verifica escaping de prefixos de fórmula, mantendo números negativos como números. Erros e download têm `private, no-store` e `nosniff`.
- **Consultas:** o dashboard usa uma RPC agregada, sem N+1 por item e sem assinatura de imagem. O export pagina sequencialmente, até 20 páginas, e rejeita totais inconsistentes/duplicatas. **Risco P2 de escala:** a RPC de listagem existente ainda transfere campos de descrição/mídia que o export descarta e o teto de bytes é verificado após montar o arquivo em memória; adequar projeção/streaming antes de crescer muito o catálogo.
- **Banco e testes SQL:** pgTAP oficial no Supabase TEST passou 63/63 em transação com `ROLLBACK`. Nenhum fixture persistiu. As sequências PostgreSQL não são transacionais, então IDs consumidos podem deixar lacunas; nenhuma linha comercial ou de cliente foi alterada.

## Advisors Supabase: baseline e pós-migration

Em 15/10/2026, antes de qualquer DDL, Security Advisor reportou tabelas `private` com RLS sem policies (sem acesso aos papéis API), RPCs `SECURITY DEFINER` preexistentes deliberadamente expostas para catálogo público e outras protegidas por seus checks de sessão/membership, além de leaked-password protection desativada. Performance Advisor reportou um índice de outbox ainda não utilizado e políticas permissivas múltiplas em `product_reviews`. Após aplicar a RPC aditiva de Analytics ao Supabase TEST, a verificação de Advisor retornou os mesmos findings preexistentes; nenhum finding novo foi atribuído à função. Esses avisos não foram corrigidos por não pertencerem ao escopo nem serem introduzidos pela feature.
