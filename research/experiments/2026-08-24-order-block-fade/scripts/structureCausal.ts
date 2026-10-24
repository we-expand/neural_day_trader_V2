/**
 * Cópia local, corrigida quanto a look-ahead, de `detectStructureEvents`
 * (src/app/services/smc/marketStructure.ts). NÃO altera o arquivo de
 * produção — ver achado documentado em ../hypothesis.md.
 *
 * Diferença única contra o original: um swing só é tratado como "conhecido"
 * a partir de `swing.index + lookback` (quando o método fractal realmente o
 * confirma), não em `swing.index` puro. Sem essa correção, o backtest
 * saberia de um rompimento de estrutura ~`lookback` candles antes do que
 * seria fisicamente possível em execução real.
 */
import type { Candle, SwingPoint, StructureEvent } from '../../../../src/app/services/smc/types';

export function detectStructureEventsCausal(candles: Candle[], swings: SwingPoint[], lookback = 2): StructureEvent[] {
  const events: StructureEvent[] = [];
  if (swings.length < 2 || candles.length === 0) return events;

  const highs = swings.filter((s) => s.kind === 'high').sort((a, b) => a.index - b.index);
  const lows = swings.filter((s) => s.kind === 'low').sort((a, b) => a.index - b.index);

  let bias: 'bullish' | 'bearish' | null = null;
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;
  let highPtr = 0;
  let lowPtr = 0;

  for (let i = 0; i < candles.length; i++) {
    while (highPtr < highs.length && highs[highPtr].index + lookback <= i) {
      lastSwingHigh = highs[highPtr];
      highPtr++;
    }
    while (lowPtr < lows.length && lows[lowPtr].index + lookback <= i) {
      lastSwingLow = lows[lowPtr];
      lowPtr++;
    }

    const candle = candles[i];

    if (lastSwingHigh && candle.timestamp > lastSwingHigh.time && candle.close > lastSwingHigh.price) {
      const kind = bias === 'bearish' || bias === null ? 'CHoCH' : 'BOS';
      const alreadyBroken = events.some((e) => e.brokenSwingTime === lastSwingHigh!.time && e.direction === 'bullish');
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bullish_${lastSwingHigh.time}_${candle.timestamp}`,
          kind: bias === null ? 'CHoCH' : kind,
          direction: 'bullish',
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingHigh.time,
        });
      }
      bias = 'bullish';
    }

    if (lastSwingLow && candle.timestamp > lastSwingLow.time && candle.close < lastSwingLow.price) {
      const kind = bias === 'bullish' || bias === null ? 'CHoCH' : 'BOS';
      const alreadyBroken = events.some((e) => e.brokenSwingTime === lastSwingLow!.time && e.direction === 'bearish');
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bearish_${lastSwingLow.time}_${candle.timestamp}`,
          kind: bias === null ? 'CHoCH' : kind,
          direction: 'bearish',
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingLow.time,
        });
      }
      bias = 'bearish';
    }
  }

  return events;
}
