# Decisões de design do admin

## Direção escolhida

Adotada proposta **A — Editorial carvão**: navegação admin sólida carvão/navy, conteúdo ivory/cinza quente, tipografia editorial para hierarquia e dourado usado apenas em estados ativos/detalhes. A sidebar não reutiliza a navegação da loja nem seus elementos flutuantes. A decisão favorece reconhecimento de marca, contraste entre navegação e espaço de trabalho e legibilidade em sessões longas.

Foram consideradas também **B — Operação clara** (sidebar clara, mais convencional) e **C — Compacta utilitária** (sidebar estreita de ícones, economiza espaço mas reduz legibilidade). A opção A vence nos critérios de identidade, hierarquia, acessibilidade e densidade sem ruído. Não criar modo colapsado nesta fase; drawer mobile/touch substitui a sidebar esmagada.

## Regras de composição

- Agrupar destinos por Visão geral, Análises, Gestão e Sistema, sem links mortos para pedidos/entregas ainda inexistentes.
- Desktop com navegação estável; mobile/tablet com botão acessível, drawer/off-canvas, overlay, ESC, foco controlado, scroll lock e fechamento após navegar.
- Usar logo original existente ou Brand já estabelecido; não criar marca substituta em forma de letra.
- Ícones Lucide discretos sem cápsulas decorativas individuais; dourado não será fundo de item inteiro.
- Reduzir motion com `prefers-reduced-motion`, mostrar `aria-current`, foco visível e estados de erro/loading/empty.
- Dashboard é fotografia de operação real, não template de analytics com KPIs financeiros vazios. Números atuais sempre indicam “agora”; séries sem fonte mostram estado sem dados.

## Evidência visual requerida

- Antes: `AdminShell` atual e suas rotas existentes; capturas ainda não foram registradas nesta sessão.
- Depois: registrar capturas desktop 1440 px e mobile 390 px após integração local; revisar também 360/768/1024 px.
- Revisor humano visual deve avaliar alinhamento, contraste, hierarquia, densidade, teclado, estados ativos e aparência não genérica. Não declarar `VISUAL_REVIEW=PASS` sem capturas e revisão.

## Lembrete financeiro

> **Analytics Fase 2 — pendência obrigatória:** só quando frete, pedidos, checkout, pagamentos e reembolsos estiverem implementados e homologados, medir fatos financeiros a partir do estado persistido validado no servidor, com webhooks idempotentes e snapshots. Evento `purchase` do browser não prova venda. Até lá, usar “Disponível após ativação de pedidos” ou estado sem dados; não inventar métricas.
