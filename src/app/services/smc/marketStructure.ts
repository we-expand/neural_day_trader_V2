import type { Candle, SwingPoint, StructureEvent } from './types.ts';

/**
 * Detecta topos/fundos locais (swing points) pelo método fractal clássico:
 * uma vela é topo se seu high é maior que o high de `lookback` velas de cada
 * lado; espelhado para fundo. Pré-requisito de tudo mais no motor SMC.
 */
export function detectSwingPoints(candles: Candle[], lookback = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= current.high) isHigh = false;
      if (candles[j].low <= current.low) isLow = false;
    }

    if (isHigh) {
      swings.push({ kind: 'high', index: i, time: current.timestamp, price: current.high });
    }
    if (isLow) {
      swings.push({ kind: 'low', index: i, time: current.timestamp, price: current.low });
    }
  }

  return swings;
}

/**
 * Detecta eventos de estrutura (BOS/CHoCH) percorrendo os swings em ordem
 * cronológica e acompanhando o viés de tendência vigente:
 * - BOS (Break of Structure): rompimento a favor da tendência atual — continuação.
 * - CHoCH (Change of Character): rompimento contra a tendência atual — sinaliza reversão,
 *   e a partir daí a tendência vigente vira a nova direção.
 *
 * Convenção: viés inicial é indefinido até o primeiro rompimento confirmado.
 */
export function detectStructureEvents(candles: Candle[], swings: SwingPoint[]): StructureEvent[] {
  const events: StructureEvent[] = [];
  if (swings.length < 2 || candles.length === 0) return events;

  const highs = swings.filter((s) => s.kind === 'high').sort((a, b) => a.index - b.index);
  const lows = swings.filter((s) => s.kind === 'low').sort((a, b) => a.index - b.index);

  let bias: 'bullish' | 'bearish' | null = null;
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  // Percorre candle a candle, atualizando o swing de referência mais recente
  // já confirmado até aquele ponto e checando rompimento por fechamento.
  let highPtr = 0;
  let lowPtr = 0;

  for (let i = 0; i < candles.length; i++) {
    while (highPtr < highs.length && highs[highPtr].index <= i) {
      lastSwingHigh = highs[highPtr];
      highPtr++;
    }
    while (lowPtr < lows.length && lows[lowPtr].index <= i) {
      lastSwingLow = lows[lowPtr];
      lowPtr++;
    }

    const candle = candles[i];

    // Rompimento de alta: fechamento acima do último topo confirmado.
    if (lastSwingHigh && candle.timestamp > lastSwingHigh.time && candle.close > lastSwingHigh.price) {
      const kind = bias === 'bearish' || bias === null ? 'CHoCH' : 'BOS';
      // Evita duplicar o mesmo rompimento pro mesmo swing.
      const alreadyBroken = events.some(
        (e) => e.brokenSwingTime === lastSwingHigh!.time && e.direction === 'bullish'
      );
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bullish_${lastSwingHigh.time}_${candle.timestamp}`,
          kind: bias === null ? 'CHoCH' : kind,
          direction: 'bullish',
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingHigh.time
        });
      }
      bias = 'bullish';
    }

    // Rompimento de baixa: fechamento abaixo do último fundo confirmado.
    if (lastSwingLow && candle.timestamp > lastSwingLow.time && candle.close < lastSwingLow.price) {
      const kind = bias === 'bullish' || bias === null ? 'CHoCH' : 'BOS';
      const alreadyBroken = events.some(
        (e) => e.brokenSwingTime === lastSwingLow!.time && e.direction === 'bearish'
      );
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bearish_${lastSwingLow.time}_${candle.timestamp}`,
          kind: bias === null ? 'CHoCH' : kind,
          direction: 'bearish',
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingLow.time
        });
      }
      bias = 'bearish';
    }
  }

  return events;
}

/** Amplitude média (proxy de ATR) das últimas N velas — usada como filtro de "movimento forte". */
export function averageRange(candles: Candle[], period = 14): number {
  if (candles.length === 0) return 0;
  const slice = candles.slice(-period);
  const sum = slice.reduce((acc, c) => acc + (c.high - c.low), 0);
  return sum / slice.length;
}
