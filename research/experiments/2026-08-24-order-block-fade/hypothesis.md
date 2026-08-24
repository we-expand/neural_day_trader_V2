# Order Block Fade — hipótese e regra de teste (2026-08-24)

## Origem

Cleber usa no MT5 o indicador de terceiro "Order Block Finder 3.8" (loja MT5,
Anton Lombard). Ele desenha zonas de Order Block (conceito padrão de Smart
Money Concepts, não é método proprietário do autor — o próprio texto do
produto admite "no fancy algorithms"). Observação empírica dele: quando o
preço retorna a uma dessas zonas, reage com frequência alta o suficiente
para ele suspeitar de edge operando contra o movimento que trouxe o preço
até a zona.

**Achado importante antes de programar qualquer coisa**: essa lógica já
existe no próprio produto — [`src/app/services/smc/orderBlocks.ts`](../../../src/app/services/smc/orderBlocks.ts),
construído em sessão anterior (ver `CLAUDE_HISTORY.md`) pro card "Detector
de Liquidez" do Dashboard, mas **nunca foi ligado a uma decisão de entrada
nem testado quanto a edge** — só exibição visual. Este experimento reusa o
motor de detecção já existente (não reimplementa do zero), mas escreve a
REGRA DE ENTRADA que nunca existiu.

## Regra de entrada (fechada com o Cleber via pergunta, 2026-08-24)

- **Direção**: fade — contra o movimento que formou a zona. Zona
  `order_block_bearish` (formada antes de rompimento de baixa, fica acima do
  preço subsequente = resistência) → **VENDE** quando o preço sobe até ela.
  Zona `order_block_bullish` (formada antes de rompimento de alta, fica
  abaixo do preço subsequente = suporte) → **COMPRA** quando o preço cai até
  ela.
- **Gatilho**: candle fecha DENTRO da zona (não só toque de pavio).
- **Elegibilidade**: qualquer zona ainda não mitigada no histórico
  disponível até aquele candle — não só a mais recente.
- **Stop**: além da borda oposta da zona + buffer de 0.5x ATR(14) (mesma
  métrica de amplitude que `orderBlocks.ts` já usa pro filtro de
  deslocamento — não inventa constante nova).
- **Alvo**: como "100 pontos" só faz sentido nativo em índice (SPX500,
  ativo do print) e o escopo pedido é a cesta toda do motor (forex, cripto,
  metal, índice), o alvo é expresso como múltiplo de R:R sobre o risco da
  própria zona, com varredura de 1:1 / 1:1.5 / 1:2 / 1:3 — mesmo padrão já
  usado nas buscas de edge anteriores do projeto.
- **Custo**: `research/CostModel.ts`, mesma tabela dos gates de produção.
- **Validação estatística**: split treino/holdout com embargo
  (`research/DataSplit.ts`), R:R escolhido pelo TREINO avaliado no HOLDOUT
  (disciplina anti-cherry-pick), Deflated Sharpe Ratio
  (`research/DeflatedSharpe.ts`) corrigindo pelo número de combinações R:R
  testadas.

## Bug de look-ahead encontrado no motor de exibição (não corrigido em produção)

`detectStructureEvents` (`marketStructure.ts`) usa `swing.index` como o
momento em que aquele topo/fundo fica "conhecido" — mas o método fractal
(`detectSwingPoints`, lookback=2) só CONFIRMA um swing 2 candles depois
(precisa comparar contra `lookback` candles de cada lado). Ou seja: o motor
de exibição atual sabe de um rompimento de estrutura 2 candles antes do que
seria fisicamente possível em tempo real — um viés de look-ahead pequeno
mas real. Não afeta a exibição visual (é só um adiantamento de ~2 candles
de uma linha no gráfico), mas afetaria um backtest se usado sem correção.
**Este experimento usa uma cópia local corrigida** (`scripts/structureCausal.ts`)
que desloca a disponibilidade do swing em `+lookback` candles antes de
alimentar `detectOrderBlocks` (importado sem alteração da produção). Reportado
aqui como achado, não corrigido no motor de produção — decisão de corrigir ou
não fica com o Cleber (a exibição visual não teve nenhum problema
prático relatado até hoje).

## Cesta de teste

Mesmos 9 códigos/timeframes já usados na medição de taxa base
(`2026-08-05-taxa-base`) — cesta real do produto, não escolhida por
conveniência: BTCUSD, XBNUSD, EURUSD, XAUUSD, XAGUSD, US30, NAS100, SPX500,
GER40 × {5m, 15m, 1h}. Dado buscado de novo (não reusa o cache de 08-05,
que já tem quase 3 semanas) via as mesmas fontes reais (Binance / MetaAPI
`/mt5-candles-history`), mesma disciplina "sem dado real = SEM DADO REAL",
nunca fabricado.
