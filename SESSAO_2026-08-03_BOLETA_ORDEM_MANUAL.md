# Handoff — Boleta de ordem manual no gráfico (sessão 2026-08-03)

> **Ponto de entrada pra retomar.** Não é preciso reler a conversa — este
> arquivo tem tudo. Estado no fim da sessão: **boleta construída e com
> várias camadas de código corrigidas, mas o clique em COMPRAR/VENDER em
> modo DEMO ainda não abre posição nenhuma** — nem no gráfico, nem em
> lugar nenhum do app. Causa raiz **não confirmada**. Próximo passo já
> definido no fim deste arquivo.

## O que foi pedido originalmente

Boleta de envio de ordens manuais **dentro do gráfico** (não ao lado), com
direção de arte no nível mais alto do produto, pesquisando como
concorrentes (MT5/TradingView/cTrader) fazem, com todos os campos de
utilidade reais — e "tudo tem que estar funcionando de verdade".

## O que foi construído (arquivos e o que cada um faz)

- **`src/app/components/trading/OrderTicket.tsx`** (novo) — a boleta em si.
  Dois modos:
  - **Recolhido**: barra compacta estilo "one-click trading" de MT5 — stepper
    de volume + botões SELL/BUY lado a lado mostrando o preço, clique
    executa a mercado na hora.
  - **Expandido**: ficha com abas laterais (Execução de Mercado / Ordem
    Limit / Ordem Stop / Ordem Stop Limit — pedido explícito do Cleber,
    baseado em captura de tela do New Order do MT5), campos Volume/Perda
    máxima/Lucro máximo/Comentário, risco/margem calculados em tempo real.
  - DEMO chama `openManualPosition`/`openManualPendingOrder` (via
    `useTradingContext()`); LIVE chama `createMarketBuyOrder` etc. de
    `BrokerClient.ts`.
- **`src/app/hooks/useApexLogic.ts`** — novas funções expostas pelo hook:
  `openManualPosition` (abre posição DEMO, mesmo caminho que a IA usa:
  `TradeVisual` + `setActiveOrders` + persistência em `ai_trades`),
  `closeManualPosition`, `openManualPendingOrder`/`cancelManualPendingOrder`
  (ordem pendente DEMO, virtual, guardada em `pendingOrders` state),
  `checkPendingOrderTriggers(symbol, price)` (chamada a cada tick de preço,
  dispara ordens pendentes cujo gatilho foi cruzado).
- **`src/app/contexts/TradingContext.tsx`** — expõe tudo isso no contexto
  global (`useTradingContext()`), único provider (`ApexTradingProvider`,
  montado uma vez em `App.tsx`, não há duplicidade de instância).
- **`src/app/components/ChartView.tsx`** — monta `<OrderTicket
  symbol={selectedSymbol} currentPrice={currentPrice} />` dentro do canvas
  do gráfico (`absolute top-[17px] right-[99px] z-[220] pointer-events-auto`
  — canto superior direito, 2px à esquerda da régua de preço do eixo Y,
  bem acima de qualquer camada do klinecharts). Também tem
  `renderPositionOverlays()` — desenha linha de entrada (verde/vermelha,
  rotulada "▲ COMPRA"/"▼ VENDA … MANUAL") + linhas tracejadas de SL/TP no
  gráfico pra toda posição em `activeOrders`, e linha cinza tracejada pra
  ordem pendente ainda não disparada. Roda num `useEffect` disparado por
  `[activeOrders, pendingOrders, selectedSymbol]` — **nunca testado de
  verdade porque nenhuma posição chegou a abrir**.
- **`src/app/services/BrokerClient.ts`** — novas funções pro caminho LIVE:
  `createLimitBuyOrder/SellOrder`, `createStopBuyOrder/SellOrder`,
  `createStopLimitBuyOrder/SellOrder`, `cancelPendingOrder`,
  `getPendingOrders`.
- **`supabase/functions/server/index.ts`** — rota `/broker/execute` ganhou
  os `action` novos (`createLimitBuyOrder` etc., mapeados pra
  `ORDER_TYPE_BUY_LIMIT` etc. da MetaAPI) + `getOrders`. Risco fail-closed
  do servidor (`validateTradeRisk`) agora cobre essas ações também.
  **⚠️ Isto precisa de `supabase functions deploy server` — não sobe
  sozinho com `git push`, é uma Edge Function separada.** Não sei se isso
  já foi rodado nesta sessão — confirmar antes de assumir que o caminho
  LIVE de limit/stop está ativo em produção.
- **`src/app/config/figmaErrorSuppressor.ts`** — bug real corrigido:
  `element.className.includes(...)` quebrava em todo elemento `<svg>`
  (className de SVG é `SVGAnimatedString`, não string) — jogava
  `TypeError: t.includes is not a function` no console a cada ícone
  lucide-react renderizado. Trocado por `element.getAttribute('class')`.
  **Confirmado corrigido**: esse erro específico sumiu do console do
  Cleber depois do deploy dessa correção.

## O bug que ainda não foi resolvido

**Sintoma**: em modo DEMO, clicar em COMPRAR ou VENDER na boleta não abre
posição em lugar nenhum — nem marcação no gráfico, nem no Dashboard/
portfolio. Sem toast de erro, sem toast de sucesso.

### Hipóteses já eliminadas (com evidência)

1. ~~Volume fora do range do ativo ao trocar de símbolo~~ — era um bug real
   (`volume` só inicializava uma vez no mount, não resincronizava ao trocar
   de ativo), **corrigido** (commit `7afede675`), mas não resolveu o
   sintoma principal.
2. ~~Deploy antigo / URL de preview desatualizada~~ — descartado via
   `vercel ls`: confirmado que a URL testada pelo Cleber era o deploy mais
   recente (3min de idade na hora do teste).
3. ~~Projeto Vercel errado~~ — descartado: `.vercel/project.json` bate com
   a URL testada (`neural-day-trader-v2`).
4. ~~`console.log` sendo removido no build~~ — descartado:
   `vite.config.ts` tem `drop_console: false` explícito.
5. ~~Múltiplas instâncias do `TradingContext`~~ — descartado: só existe um
   `<ApexTradingProvider>` no app inteiro (`App.tsx` linha ~409).
6. **Ainda não descartada, mas endereçada sem confirmação**: sobreposição
   de z-index/pointer-events bloqueando o clique fisicamente — subi o
   z-index da boleta pra `z-[220]` (acima do próprio modo tela cheia do
   gráfico) + `pointer-events-auto` explícito (commit `c5ea20843`). **Não
   sei se isso resolveu** porque o teste seguinte ainda não mostrou os
   logs de diagnóstico (ver abaixo) — não dá pra saber se o clique passou
   a chegar no botão ou não.
7. **Hipótese levantada mas não confirmada**: filtro do DevTools do
   Cleber escondendo `console.log` (só apareciam erros/avisos nos 3 dumps
   de console que ele colou, nunca um log puro). Troquei os logs de
   diagnóstico pra `console.error` (commit `83ec50f52`, ⚠️ **HEAD atual,
   confirmado pushado — `git status` limpo, `up to date with
   origin/dev`** — mas não confirmado se o Cleber já testou DEPOIS desse
   commit específico). Isto é o mais recente e ainda sem resposta do
   Cleber quando a sessão foi interrompida.

### Instrumentação já no código (pronta pra usar)

Logs `console.error` com prefixo **🟢** em:
- `OrderTicket.tsx` linha ~191: `🟢[OrderTicket] executeOrder chamado` —
  loga `{ side, symbol, orderType, executionMode, currentPrice, volume,
  canTrade, asset: !!asset }` **antes** de qualquer guarda. Se esta linha
  NUNCA aparecer no console mesmo clicando, é prova definitiva de que o
  clique não está chegando no handler (bug de DOM/overlay, não de lógica).
- `OrderTicket.tsx` linha ~193-194: `console.warn` explicando qual guarda
  abortou (`currentPrice`, `asset`, `canTrade` ausentes) se a função for
  chamada mas retornar cedo.
- `OrderTicket.tsx` linha ~216: `🟢[OrderTicket] openManualPosition
  retornou` com o resultado.
- `useApexLogic.ts` linha ~2484: `🟢[useApexLogic] openManualPosition
  chamado` com os params.
- `useApexLogic.ts` linha ~2525: `🟢[useApexLogic] openManualPosition:
  setActiveOrders` com contagem antes/depois.

Também existe um aviso visível na própria UI (não só console): variável
`blockedReason` em `OrderTicket.tsx` (~linha 159) mostra debaixo dos botões
o motivo exato de bloqueio ("Aguardando preço do ativo…", "Volume fora do
intervalo…", etc.) sempre que `canTrade` for `false` — vale checar se esse
texto aparece na tela antes de qualquer outra coisa.

## Próximo passo (retomar exatamente daqui)

1. **Pedir pro Cleber**: hard refresh (`Cmd+Shift+R`) na URL de preview
   mais recente, abrir DevTools → Console, clicar em COMPRAR, e copiar
   literalmente TUDO que aparecer — inclusive se aparecer o texto do
   `blockedReason` na própria tela da boleta (pedir print/descrição da UI
   da boleta em si, não só do console, ainda não temos isso).
2. **Se a linha 🟢 aparecer**: o clique está chegando — o resto do log
   (guarda que abortou, ou resultado do `openManualPosition`) vai apontar
   o problema exato, e a partir daí é debug normal de lógica.
3. **Se a linha 🟢 continuar NÃO aparecendo mesmo depois do
   `console.error` + z-[220]**: o problema é mais fundamental do que
   z-index — cogitar:
   - Testar clicar em QUALQUER outro botão do app (não só a boleta) e ver
     se aparece algum log conhecido daquele botão — isolar se é global
     (nada no app responde a clique, algo mais grave tipo JS travado) ou
     específico da boleta.
   - Pedir uma screenshot real da tela com a boleta visível, pra confirmar
     que ela está renderizando onde eu acho que está (todo o
     reposicionamento em pixels foi feito às cegas, sem eu nunca ter
     conseguido ver a tela — ver seção "Limitação desta sessão" abaixo).
   - Checar se existe algum `<iframe>` ou elemento por cima (o
     `figmaMessagePortShield.ts`/`figmaErrorSuppressor.ts` sugerem que este
     app já teve problema histórico de iframe/overlay do Figma Make — vale
     abrir esses dois arquivos e entender se algum overlay deles pode
     estar cobrindo a área do gráfico em produção).
4. **Depois de resolver o clique em si**: confirmar que
   `renderPositionOverlays` desenha a linha no gráfico corretamente (nunca
   testado), e testar o fluxo de ordem pendente (Limit/Stop) em DEMO
   (`checkPendingOrderTriggers`, também nunca testado de ponta a ponta).
5. **Não esquecer**: `supabase functions deploy server` pode não ter sido
   rodado ainda — o caminho LIVE de limit/stop/stop-limit depende disso.

## Limitação desta sessão (por que tanto chute)

O Claude Browser (ferramenta de navegador deste ambiente) ficou bloqueado
o tempo inteiro nesta sessão — todo `navigate` pra `localhost` retornou
"denied or failed", e a URL de preview da Vercel está atrás de
autenticação (`vercel.com/login`, confirmado via screenshot) que eu não
tenho como passar. Ou seja: **nada do que foi feito nesta sessão foi
visualmente verificado por mim** — todo o reposicionamento em pixels e
toda a tentativa de correção do bug de clique foi feita só por leitura de
código + os console logs que o Cleber colou manualmente, sem nunca ver a tela
real rodando. Isso é a explicação mais provável de por que tantas
tentativas (volume, figma suppressor, z-index, filtro de console) não
resolveram ainda — cada uma era plausível pela evidência disponível, mas
nenhuma foi confirmada visualmente. **Se a próxima sessão tiver acesso a
navegador funcional (local ou com login na Vercel), isso encurta o
diagnóstico de horas pra minutos.**

## Regra do projeto (lembrete)

Claude nunca faz `git commit`/`push` nem `supabase functions deploy`
sozinho — sempre entregar comando pronto pro Cleber rodar. Todos os
commits desta sessão já foram passados e confirmados pushados (branch
`dev`, `git status` limpo no fim da sessão).
