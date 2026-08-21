# Sessão 2026-08-21 — Contador de candle sumindo atrás da boleta

**Relato inicial**: Cleber perguntou por que não conseguia ver "o cronômetro
de cada sessão" no Gráfico.

**1ª tentativa (errada)**: interpretei como o `SessionTimer`
(`src/app/components/tools/SessionTimer.tsx`) — um Pomodoro Trader (25min
foco / 5min pausa) que estava **importado mas nunca renderizado em lugar
nenhum do app** (import morto em `AITrader.tsx`). Adicionei ele na barra de
ferramentas do Gráfico e depois, a pedido do Cleber, abaixo da boleta. Cleber
corrigiu: não era isso — o Pomodoro foi revertido por completo.

**Pedido real**: um contador **regressivo de candle** — quanto tempo falta,
de forma retroativa, pro candle atual do timeframe selecionado fechar e o
próximo começar. Esse recurso **já existia** (`candleCountdown` state +
`formatCountdown`, calculado a partir do timeframe ativo), só que:
1. tinha um visual "cru" (badge azul simples, sem alinhamento com o padrão
   visual do resto do produto);
2. **bug real**: vivia num offset absoluto fixo (`top-[142px] right-[99px]`,
   calibrado pra altura da boleta *recolhida* e sem avisos). Quando a boleta
   cresce — banners "⚠ posição aberta em X" empilhados no topo, um por ativo
   com posição aberta — o contador ficava posicionalmente **atrás** da
   boleta (z-index menor), escondido mesmo estando no DOM. Isso explica por
   que "desapareceu": nunca foi removido, ficou coberto assim que havia mais
   de uma posição aberta simultânea (situação comum, visível no screenshot
   original do Cleber — 3 avisos empilhados).

**Fix aplicado** (`src/app/components/ChartView.tsx`):
- Contador e boleta (`OrderTicket`) agora dividem um único wrapper
  `flex flex-col items-end gap-2` em vez de dois `absolute` independentes com
  offset hardcoded — o contador sempre fica colado embaixo da altura real da
  boleta, recolhida ou expandida, com qualquer quantidade de avisos.
- Visual redesenhado pra bater com a linguagem do resto do produto (mesmo
  padrão usado na boleta): `bg-black/90 backdrop-blur-sm border-white/10
  rounded-lg shadow-2xl`, label do timeframe (`1H`) + tempo em mono
  (`38:46`), barra de progresso azul fina embaixo mostrando fração do candle
  já decorrida.
- Removida a duplicação do cálculo do intervalo por timeframe (map
  `TIMEFRAME_INTERVALS_MS` extraído do `useEffect` pra constante do
  componente, reusado também no cálculo da barra de progresso).

**Verificação**: `npm run validate` (37/37) limpo em cada rodada. Testado
visualmente no browser com 3 posições abertas simultâneas (mesmo cenário do
screenshot original) — contador aparece corretamente abaixo da boleta, sem
sobreposição, timeframe 1H mostrando "38:46" contando.

**Commit pendente do Cleber rodar** — ver mensagem sugerida no fim da
conversa (`fix: contador de candle sumia atrás da boleta quando ela cresce
com avisos de posição`).
