# Testes pendentes antes da abertura ao público (2026-11-26)

A auditoria rodou em Chromium (Playwright), sem carga e sem pagamento real. Os
testes abaixo **ainda não foram feitos** e precisam acontecer antes de abrir a loja.
Nenhum deles exige mudar código; alguns exigem pessoas e aparelhos reais.

Legenda de dono: **Você** = responsável pelo projeto · **Cliente** = Império Sofás ·
**Eu** = posso executar com sua autorização.

## 1. Safari (iPhone e Mac)

- **Onde:** staging, depois de novo no domínio de produção.
- **Dono:** Você (aparelhos reais). Eu posso preparar o roteiro.
- **Aparelhos mínimos:** iPhone com iOS atual (Safari) e um iPhone com a versão
  anterior; Mac com Safari atual.
- **Roteiro:** abrir `/`, `/loja`, um produto; trocar foto da galeria; favoritar;
  adicionar ao carrinho; cadastro e login; troca de senha; CEP/frete; checkout até a
  tela do Mercado Pago; voltar do Mercado Pago; `/conta/pedidos`; admin (upload de
  foto pelo iPhone, inclusive foto HEIC da câmera).
- **Pontos de atenção do Safari:** barra inferior com teclado aberto (usa
  `visualViewport`), cookies de sessão após voltar do Mercado Pago, fotos WebP,
  campos de data/telefone, zoom ao focar campos (fonte 16 px).
- **Critério:** nenhum passo bloqueado; nenhum layout quebrado em 375 e 430 px.

## 2. Firefox (desktop e Android)

- **Onde:** staging.
- **Dono:** Eu posso rodar a suíte E2E também no Firefox (Playwright) com sua
  autorização; o teste em Android é seu.
- **Roteiro:** o mesmo do Safari, sem o upload HEIC.
- **Pontos de atenção:** seletor `:has()` (usado em CSS), foco/contraste,
  formulários com validação própria (`noValidate`).
- **Critério:** suíte E2E QA verde no Firefox; navegação manual sem bloqueio.

## 3. Carga

- **Onde:** staging (nunca em produção com clientes reais), com o mesmo plano da
  Vercel que será usado em produção.
- **Dono:** Eu, com sua autorização explícita (gera tráfego e custo na Vercel e no
  Supabase TESTE).
- **Cenários:**
  - navegação: `/`, `/loja`, `/loja/<categoria>`, produto — subir até ~50 usuários
    simultâneos por 10 min;
  - carrinho e checkout (até a criação do pedido, com pagamento simulado) — ~10
    usuários simultâneos;
  - pico de webhooks do Mercado Pago (simulados) no mesmo pedido e em pedidos
    diferentes.
- **Medir:** tempo de resposta p50/p95, taxa de erro, conexões do Supabase, uso de
  imagens na Vercel, estoque/reservas corretos depois (sem vender a mais).
- **Critério sugerido:** p95 < 2 s nas páginas, 0 erros 5xx, nenhum estoque
  negativo ou pedido duplicado.
- **Já coberto:** concorrência de estoque e pagamentos no banco (C-01 a C-21, 10–15
  rodadas de webhooks simultâneos) — mas não volume de tráfego.

## 4. Pagamento real com estorno

- **Onde:** **produção**, depois das credenciais reais do Mercado Pago, antes de
  divulgar a loja.
- **Dono:** Você + Cliente. **Eu não faço pagamentos reais.**
- **Roteiro:**
  1. Cadastrar um produto de teste barato (ex.: R$ 5) visível só para o teste, ou
     usar um produto real e cancelar depois.
  2. Comprar com cartão real (e, se aceito, Pix e boleto).
  3. Conferir: pedido "pago" em `/conta/pedidos` e no admin; e-mail ao cliente e à
     loja; estoque baixado; webhook registrado.
  4. Estornar pelo Mercado Pago; conferir que o pedido muda para "reembolsado" e
     que o admin consegue registrar/encerrar.
  5. Conferir que o dinheiro foi para a conta certa (`MP_EXPECTED_COLLECTOR_ID`).
- **Critério:** os 5 passos sem intervenção manual no banco.

## 5. Outros itens não testados

- Envio real dos e-mails de pedido (depende do Resend de produção).
- Leitores de tela (VoiceOver/TalkBack) — a auditoria usou axe e teclado.
- Login com Google/Apple (hoje desligados).
