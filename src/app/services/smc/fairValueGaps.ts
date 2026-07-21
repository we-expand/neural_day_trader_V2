import type { Candle, SmcZone } from './types';
import { averageRange } from './marketStructure';

/**
 * Fair Value Gap (FVG) / imbalance: gap clássico de 3 velas.
 * Bullish FVG: candle[i-1].high < candle[i+1].low (o "buraco" fica entre esses dois).
 * Bearish FVG: candle[i-1].low > candle[i+1].high.
 *
 * Preenchimento: qualquer sobreposição futura do range do gap conta como preenchido
 * (critério simples e determinístico, documentado — não distingue preenchimento
 * parcial vs total).
 */
export function detectFairValueGaps(candles: Candle[]): SmcZone[] {
  const zones: SmcZone[] = [];
  if (candles.length < 3) return zones;

  const avgRange = averageRange(candles, 14);

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];

    let type: 'fvg_bullish' | 'fvg_bearish' | null = null;
    let priceLow = 0;
    let priceHigh = 0;

    if (prev.high < next.low) {
      type = 'fvg_bullish';
      priceLow = prev.high;
      priceHigh = next.low;
    } else if (prev.low > next.high) {
      type = 'fvg_bearish';
      priceLow = next.high;
      priceHigh = prev.low;
    }

    if (!type) continue;

    const gapSize = priceHigh - priceLow;
    if (gapSize <= 0) continue;

    // Preenchimento: procura, depois do candle[i+1], a primeira vela cujo range
    // sobrepõe o gap.
    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let j = i + 2; j < candles.length; j++) {
      const c = candles[j];
      const overlaps = c.low <= priceHigh && c.high >= priceLow;
      if (overlaps) {
        mitigated = true;
        mitigatedAt = c.timestamp;
        break;
      }
    }

    let strength = 40;
    if (gapSize > avgRange * 0.5) strength += 20;
    if (!mitigated) strength += 20;
    // Confluência com Order Block é marcada depois, no orquestrador (index.ts),
    // que tem acesso às duas listas ao mesmo tempo.

    zones.push({
      id: `${type}_${prev.timestamp}_${next.timestamp}`,
      type,
      priceHigh,
      priceLow,
      startTime: prev.timestamp,
      endTime: mitigatedAt,
      mitigated,
      mitigatedAt,
      strength: Math.min(100, strength),
      confluence: []
    });
  }

  return zones;
}
