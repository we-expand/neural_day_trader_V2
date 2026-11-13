import type { Candle, SmcZone, StructureEvent } from '../../../../src/app/services/smc/types';
import { averageRange } from '../../../../src/app/services/smc/marketStructure';

/**
 * Réplica local de `detectOrderBlocks` (src/app/services/smc/orderBlocks.ts),
 * SEM alterar produção, com uma correção necessária pro backtest: expõe
 * `knownFromTime` = timestamp do candle de rompimento que confirma a zona.
 *
 * BUG DE LOOK-AHEAD ENCONTRADO NO PRÓPRIO BACKTEST (não em produção — lá o
 * campo nunca é usado pra decidir uma entrada, só pra desenhar): o scan de
 * mitigação de `orderBlocks.ts` começa em `baseIndex + 1`, que fica ANTES do
 * candle de rompimento (`breakIndex`) que confirma a existência da zona (o
 * `baseIndex` pode ficar até 20 candles atrás do rompimento). Ou seja, uma
 * zona pode aparecer "mitigada" — e portanto gerar um "gatilho de entrada" no
 * backtest — num instante em que ela ainda nem seria detectável em tempo
 * real (o rompimento que a confirma só acontece depois). Usar
 * `zone.mitigatedAt` puro como timestamp de entrada, como a primeira versão
 * deste backtest fazia, é olhar o futuro.
 *
 * Fix: só conta como trade válido se `mitigatedAt` (o "fechou dentro da
 * zona") acontecer DEPOIS de `knownFromTime` (o candle de rompimento). Se a
 * zona já tiver sido "mitigada" antes disso, ela nunca gerou um gatilho de
 * entrada real — é descartada, não reagendada pra mais tarde.
 */
export interface CausalZone extends SmcZone {
  knownFromTime: number;
}

export function detectOrderBlocksCausal(candles: Candle[], structureEvents: StructureEvent[]): CausalZone[] {
  if (candles.length === 0 || structureEvents.length === 0) return [];

  const avgRange = averageRange(candles, 14);
  const displacementThreshold = avgRange * 1.5;
  const timeToIndex = new Map<number, number>();
  candles.forEach((c, i) => timeToIndex.set(c.timestamp, i));

  const zones: CausalZone[] = [];

  for (const event of structureEvents) {
    const breakIndex = timeToIndex.get(event.time);
    if (breakIndex === undefined || breakIndex < 1) continue;

    const isBullishBreak = event.direction === 'bullish';
    let baseIndex = -1;
    for (let i = breakIndex - 1; i >= Math.max(0, breakIndex - 20); i--) {
      const candle = candles[i];
      const isBearishCandle = candle.close < candle.open;
      const isBullishCandle = candle.close > candle.open;
      if (isBullishBreak && isBearishCandle) { baseIndex = i; break; }
      if (!isBullishBreak && isBullishCandle) { baseIndex = i; break; }
    }
    if (baseIndex === -1) continue;

    const baseCandle = candles[baseIndex];
    const breakCandle = candles[breakIndex];
    const displacement = Math.abs(breakCandle.close - baseCandle.close);
    if (displacement < displacementThreshold) continue;

    // Mitigação: primeira vela cujo close fecha dentro da zona — mas só a
    // partir do candle de rompimento (breakIndex), nunca antes: candles
    // entre baseIndex e breakIndex são parte da própria perna impulsiva que
    // ainda está formando a zona, a zona não "existe" pra ninguém até o
    // rompimento confirmar.
    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let i = breakIndex; i < candles.length; i++) {
      const c = candles[i];
      const inside = c.close >= baseCandle.low && c.close <= baseCandle.high;
      if (inside) { mitigated = true; mitigatedAt = c.timestamp; break; }
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
      confluence: [],
      knownFromTime: breakCandle.timestamp,
    });
  }

  return zones;
}
