/**
 * Variante experimental de `runBacktest` (src/app/services/strategy/BacktestEngine.ts)
 * que troca o gate binário (`evaluateStrategyAt`) pelo score contínuo
 * (`evaluateStrategyScoreAt`, adicionado em 2026-08-16). VIVE FORA do motor de
 * produção de propósito — item 2 do redesenho do cérebro exige medir score
 * contínuo vs. gate atual ANTES de tocar em qualquer caminho de execução (ver
 * NEXT_SESSION.md). `BacktestEngine.ts` não foi modificado.
 *
 * Mecânica de saída (TP/SL/trailing/regra de saída) é IDÊNTICA ao motor de
 * produção — só a decisão de ENTRADA muda: em vez de "todos os blocos batem",
 * entra quando `score >= scoreThreshold`.
 */
import { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';
import { IndicatorCache, evaluateStrategyScoreAt, evaluateExitAt } from '../../../../src/app/services/strategy/StrategyEvaluator';
import { calculatePositionSize, getPointValue, trailStopLoss, resolveTpSl } from '../../../../src/app/services/strategy/TradeSizing';
import { Strategy } from '../../../../src/app/types/strategy';

export interface ScoredTrade {
  entryIndex: number;
  candleIndex: number;
  profitPercent: number;
  status: 'win' | 'loss';
  entryScore: number;
}

export function runScoredBacktest(
  candles: Candle[],
  strategy: Strategy,
  symbol: string,
  direction: 'long' | 'short' | 'both',
  initialCapital: number,
  roundTripCostPercent: number,
  scoreThreshold: number
) {
  const cache = new IndicatorCache(candles);
  const trades: ScoredTrade[] = [];

  let equity = initialCapital;
  let openPosition: null | {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    entryIndex: number;
    tp: number | null;
    sl: number;
    originalSl: number;
    tradeCapital: number;
    entryScore: number;
  } = null;

  const pointValue = getPointValue(symbol);
  const warmup = 60;

  for (let i = warmup; i < candles.length; i++) {
    if (openPosition) {
      const candle = candles[i];

      if (strategy.trailingStop) {
        const prevClose = candles[i - 1].close;
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, prevClose);
      }

      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      const ruleExit = evaluateExitAt(strategy, candles, i, cache);

      if (hitTp || hitSl || ruleExit) {
        const exitPrice = hitSl ? openPosition.sl : hitTp ? openPosition.tp! : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPercent * 100;
        const profit = (openPosition.tradeCapital * profitPercent) / 100;
        equity += profit;

        trades.push({
          entryIndex: openPosition.entryIndex,
          candleIndex: i,
          profitPercent,
          status: profit >= 0 ? 'win' : 'loss',
          entryScore: openPosition.entryScore,
        });

        openPosition = null;
      }
      continue;
    }

    const result = evaluateStrategyScoreAt(strategy, candles, i, cache);
    if (result.score < scoreThreshold || !result.signal) continue;

    const side: 'LONG' | 'SHORT' = result.signal === 'BUY' ? 'LONG' : 'SHORT';
    if (direction === 'long' && side !== 'LONG') continue;
    if (direction === 'short' && side !== 'SHORT') continue;

    const entryPrice = candles[i].close;
    const atrAtEntry = cache.get('ATR', 14)[i];
    const { tp, sl, slDistance } = resolveTpSl(strategy, side, entryPrice, pointValue, atrAtEntry);

    const stopDistancePercent = slDistance / entryPrice;
    const tradeCapital = calculatePositionSize({
      currentBalance: equity,
      allocatedCapital: equity,
      riskPerTradePercent: strategy.positionSizePercent,
      riskProfile: strategy.riskProfile,
      stopDistancePercent,
    });
    if (tradeCapital === null) continue; // nocional abaixo do mínimo executável — pula o trade

    openPosition = {
      side, entryPrice, entryIndex: i, tp, sl, originalSl: sl,
      tradeCapital, entryScore: result.score,
    };
  }

  return { trades, finalEquity: equity };
}
