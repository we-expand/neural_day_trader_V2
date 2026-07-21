import type { Candle, SmcZone, StructureEvent } from './types';
import { averageRange } from './marketStructure';

/**
 * Order Block: última vela de cor oposta ao movimento, imediatamente antes de
 * uma perna impulsiva que rompeu estrutura (BOS/CHoCH). Vela baixista antes de
 * rompimento de alta = OB bullish; vela altista antes de rompimento de baixa = OB bearish.
 *
 * Filtro de "movimento forte": o deslocamento total da perna (do candle-base até
 * o candle de rompimento) precisa exceder 1.5x a amplitude média das últimas 14 velas —
 * evita marcar ruído como Order Block.
 */
export function detectOrderBlocks(candles: Candle[], structureEvents: StructureEvent[]): SmcZone[] {
  if (candles.length === 0 || structureEvents.length === 0) return [];

  const avgRange = averageRange(candles, 14);
  const displacementThreshold = avgRange * 1.5;
  const timeToIndex = new Map<number, number>();
  candles.forEach((c, i) => timeToIndex.set(c.timestamp, i));

  const zones: SmcZone[] = [];

  for (const event of structureEvents) {
    const breakIndex = timeToIndex.get(event.time);
    if (breakIndex === undefined || breakIndex < 1) continue;

    // Acha o índice do candle cujo close/timestamp originou o swing rompido,
    // procurando pra trás a partir do rompimento a última vela de cor oposta.
    const isBullishBreak = event.direction === 'bullish';
    let baseIndex = -1;

    for (let i = breakIndex - 1; i >= Math.max(0, breakIndex - 20); i--) {
      const candle = candles[i];
      const isBearishCandle = candle.close < candle.open;
      const isBullishCandle = candle.close > candle.open;

      if (isBullishBreak && isBearishCandle) {
        baseIndex = i;
        break;
      }
      if (!isBullishBreak && isBullishCandle) {
        baseIndex = i;
        break;
      }
    }

    if (baseIndex === -1) continue;

    const baseCandle = candles[baseIndex];
    const breakCandle = candles[breakIndex];
    const displacement = Math.abs(breakCandle.close - baseCandle.close);
    if (displacement < displacementThreshold) continue;

    // Mitigação: primeira vela subsequente cujo range fecha de volta dentro da zona.
    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let i = baseIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      const inside = c.close >= baseCandle.low && c.close <= baseCandle.high;
      if (inside) {
        mitigated = true;
        mitigatedAt = c.timestamp;
        break;
      }
    }

    const avgVolume =
      candles.slice(Math.max(0, baseIndex - 20), baseIndex).reduce((s, c) => s + (c.volume || 0), 0) /
      Math.max(1, Math.min(20, baseIndex));

    let strength = 50;
    if (displacement > avgRange * 2) strength += 20;
    if (baseCandle.volume && baseCandle.volume > avgVolume) strength += 15;
    if (!mitigated) strength += 15;

    zones.push({
      id: `order_block_${isBullishBreak ? 'bullish' : 'bearish'}_${baseCandle.timestamp}`,
      type: isBullishBreak ? 'order_block_bullish' : 'order_block_bearish',
      priceHigh: baseCandle.high,
      priceLow: baseCandle.low,
      startTime: baseCandle.timestamp,
      endTime: mitigatedAt,
      mitigated,
      mitigatedAt,
      strength: Math.min(100, strength),
      confluence: []
    });
  }

  return zones;
}
