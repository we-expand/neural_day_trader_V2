/**
 * Motor de backtest — extraído de useBacktestLiveProgress.ts (2026-07-24) para
 * um módulo puro, sem React, reutilizável tanto pela UI (hook) quanto por
 * scripts de validação em Node (research/experiments/*). Antes desta extração,
 * `runBacktest` só existia dentro do hook — não dava pra medir uma estratégia
 * fora do navegador sem duplicar a lógica (risco real de o número mostrado ao
 * usuário divergir do número medido em pesquisa).
 *
 * Determinístico: mesma estratégia + mesmo período + mesmos dados = mesmo
 * resultado, sempre — nenhum Math.random() em qualquer ponto do cálculo.
 */
import { Candle } from '../indicators/TechnicalIndicators';
import { IndicatorCache, evaluateStrategyAt, evaluateExitAt } from './StrategyEvaluator';
import { calculatePositionSize, getPointValue, trailStopLoss, resolveTpSl } from './TradeSizing';
import { Strategy } from '../../types/strategy';

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  timestamp: number;
  status: 'win' | 'loss';
  /** Índice do candle de ENTRADA (não confundir com candleIndex, que é o de saída). Necessário pra filtrar trades cuja entrada caiu dentro da região de warmup — ver research/DataSplit.ts. */
  entryIndex: number;
  candleIndex: number;
  aiAnalysis: {
    confidence: number;
    mainReason: string;
    supportingFactors: string[];
    indicators: { name: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }[];
    marketContext: string;
  };
  result?: {
    exitPrice: number;
    profit: number;
    profitPercent: number;
    status: 'win' | 'loss';
    exitReason: string;
  };
}

export function indicatorSnapshot(cache: IndicatorCache, i: number) {
  const rsi = cache.get('RSI', 14)[i];
  const macd = cache.get('MACD')[i];
  const ema = cache.get('EMA', 21)[i];
  return [
    { name: 'RSI(14)', value: rsi !== null ? rsi.toFixed(1) : 'n/d', signal: (rsi !== null ? (rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral') : 'neutral') as 'bullish' | 'bearish' | 'neutral' },
    { name: 'MACD', value: macd !== null ? macd.toFixed(4) : 'n/d', signal: (macd !== null ? (macd > 0 ? 'bullish' : 'bearish') : 'neutral') as 'bullish' | 'bearish' | 'neutral' },
    { name: 'EMA(21)', value: ema !== null ? `$${ema.toFixed(2)}` : 'n/d', signal: 'neutral' as const },
  ];
}

/**
 * Roda a estratégia sobre a série de candles inteira e retorna os trades
 * (cálculo 100% determinístico — sem aleatoriedade em nenhum passo).
 *
 * `roundTripCostPercent` (opcional): custo estimado de ida+volta em % do valor
 * da posição (ver research/CostModel.ts, estimateCostPercent()*2) — quando
 * fornecido, é descontado de CADA trade antes de computar profit/profitPercent.
 * Ausente = retorno BRUTO (comportamento antigo, usado pela UI de backtest ao
 * vivo, que já mostra custo como informação separada em outro lugar da tela).
 * Scripts de validação/pesquisa devem SEMPRE passar este valor — retorno bruto
 * sem custo é o erro #1 de rigor que a Fase 1 do research/AI_BRAIN_SPEC.md
 * existe pra fechar.
 */
export function runBacktest(
  candles: Candle[],
  strategy: Strategy,
  symbol: string,
  direction: 'long' | 'short' | 'both',
  initialCapital: number,
  roundTripCostPercent = 0
) {
  const cache = new IndicatorCache(candles);
  const trades: Trade[] = [];
  const equityCurve: Array<{ time: number; equity: number }> = [{ time: 0, equity: initialCapital }];

  let equity = initialCapital;
  let openPosition: null | {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    entryIndex: number;
    tp: number | null; // null = TRAILING_ONLY, sem alvo fixo (ver Strategy.takeProfitMode)
    sl: number;
    originalSl: number;
    tradeCapital: number;
    reasons: string[];
    confidence: number;
  } = null;

  const pointValue = getPointValue(symbol);
  const warmup = 60; // candles mínimos pra indicadores lentos (EMA200 etc.) estabilizarem

  for (let i = warmup; i < candles.length; i++) {
    if (openPosition) {
      const candle = candles[i];

      // 2026-07-30: FIX DE BUG (look-ahead leve) — a versão anterior movia o
      // trailing stop usando o CLOSE da barra `i` e, na mesma iteração,
      // testava esse stop contra o LOW/HIGH da MESMA barra `i`. Isso usa uma
      // informação (o fechamento de i) que só existe DEPOIS que a barra i já
      // aconteceu inteira — inclusive o low/high que está sendo testado
      // contra ela. Corrigido: o trailing usa o close da barra ANTERIOR
      // (i-1, já conhecido no início de i), testado contra o low/high da
      // barra atual — ordem causal correta. Afeta materialmente presets com
      // stop apertado (3,4,5 — k=1-1,5×ATR); desprezível nos de stop largo
      // (1,2 — k=4-4,5×ATR), onde `close(i) - low(i) > distância do stop`
      // é uma condição rara.
      if (strategy.trailingStop) {
        const prevClose = candles[i - 1].close;
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, prevClose);
      }

      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      const ruleExit = evaluateExitAt(strategy, candles, i, cache);

      if (hitTp || hitSl || ruleExit) {
        // 2026-07-30: FIX DE BUG (viés otimista) — quando TP e SL são
        // atingidos na MESMA barra (high >= tp E low <= sl simultaneamente),
        // a versão anterior sempre escolhia o TP — não há como saber, a
        // partir de OHLC, qual dos dois o preço tocou primeiro dentro da
        // barra. Assumir sempre o melhor caso é viés otimista sistemático.
        // Corrigido: prioriza o SL (pior caso) no empate — conservador por
        // desenho, consistente com a disciplina de "nunca fabricar dado
        // favorável" do projeto.
        const exitPrice = hitSl ? openPosition.sl : hitTp ? openPosition.tp! : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        // Custo de ida+volta descontado aqui — nunca só na entrada ou só na
        // saída, o round-trip inteiro onera o resultado do trade fechado.
        const profitPercent = grossProfitPercent - roundTripCostPercent * 100;
        const profit = (openPosition.tradeCapital * profitPercent) / 100;
        const isWin = profit >= 0;
        equity += profit;

        trades.push({
          id: `bt-${openPosition.entryIndex}-${i}`,
          symbol,
          type: openPosition.side === 'LONG' ? 'BUY' : 'SELL',
          entryPrice: openPosition.entryPrice,
          exitPrice,
          profit,
          profitPercent,
          timestamp: candle.time,
          status: isWin ? 'win' : 'loss',
          entryIndex: openPosition.entryIndex,
          candleIndex: i,
          aiAnalysis: {
            confidence: openPosition.confidence,
            mainReason: openPosition.reasons[0] || `${strategy.name}: sinal de ${openPosition.side === 'LONG' ? 'compra' : 'venda'}`,
            supportingFactors: openPosition.reasons.slice(1),
            indicators: indicatorSnapshot(cache, openPosition.entryIndex),
            marketContext: `Estratégia "${strategy.name}" em ${symbol}`,
          },
          result: {
            exitPrice,
            profit,
            profitPercent,
            status: isWin ? 'win' : 'loss',
            // Mesma prioridade do exitPrice acima (SL primeiro no empate).
            exitReason: hitSl ? 'Stop loss acionado' : hitTp ? 'Take profit atingido' : 'Regra de saída da estratégia satisfeita',
          },
        });

        equityCurve.push({ time: i, equity });
        openPosition = null;
      }
      continue;
    }

    const result = evaluateStrategyAt(strategy, candles, i, cache);
    if (!result.signal) continue;

    const side: 'LONG' | 'SHORT' = result.signal === 'BUY' ? 'LONG' : 'SHORT';
    if (direction === 'long' && side !== 'LONG') continue;
    if (direction === 'short' && side !== 'SHORT') continue;

    const entryPrice = candles[i].close;
    // ATR(14) do próprio candle de entrada — dimensiona SL/TP pela volatilidade
    // real do ativo/momento quando a estratégia pede stopLossMode/takeProfitMode
    // 'ATR' (ver TradeSizing.resolveTpSl); cai para pontos fixos senão.
    const atrAtEntry = cache.get('ATR', 14)[i];
    const { tp, sl, slDistance } = resolveTpSl(strategy, side, entryPrice, pointValue, atrAtEntry);

    // 2026-07-30: passa a distância real do stop pro sizing (fix de bug —
    // ver comentário em TradeSizing.calculatePositionSize) — o nocional
    // agora é dimensionado pra que perder o stop perca exatamente
    // `positionSizePercent%` do capital, não um % fixo de capital
    // independente de quão largo o stop está.
    const stopDistancePercent = slDistance / entryPrice;
    const tradeCapital = calculatePositionSize({
      currentBalance: equity,
      allocatedCapital: equity,
      riskPerTradePercent: strategy.positionSizePercent,
      riskProfile: strategy.riskProfile,
      stopDistancePercent,
    });

    openPosition = {
      side, entryPrice, entryIndex: i, tp, sl, originalSl: sl,
      tradeCapital, reasons: result.reasons, confidence: result.confidence,
    };
  }

  return { trades, equityCurve, finalEquity: equity };
}
