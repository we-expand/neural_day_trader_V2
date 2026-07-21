import type { Candle, SmcZone, SwingPoint } from './types';

/**
 * Liquidity Pool: topos (ou fundos) locais aproximadamente iguais, onde stops de
 * traders costumam se acumular ("aonde o dinheiro está"). Topos iguais = liquidez
 * do lado vendedor (sellside, stops de quem vendeu acima); fundos iguais =
 * liquidez do lado comprador (buyside, stops de quem comprou abaixo).
 *
 * Varredura (sweep): a piscina é marcada como mitigada quando um candle
 * posterior rompe o nível (high acima, pro sellside; low abaixo, pro buyside) —
 * é o momento clássico de "caça aos stops" antes de reversão.
 */
export function detectLiquidityPools(
  candles: Candle[],
  swings: SwingPoint[],
  equalityTolerancePct = 0.001
): SmcZone[] {
  const zones: SmcZone[] = [];
  if (candles.length === 0) return zones;

  const highs = swings.filter((s) => s.kind === 'high');
  const lows = swings.filter((s) => s.kind === 'low');

  zones.push(...clusterAndBuildZones(candles, highs, equalityTolerancePct, 'liquidity_pool_sellside'));
  zones.push(...clusterAndBuildZones(candles, lows, equalityTolerancePct, 'liquidity_pool_buyside'));

  return zones;
}

function clusterAndBuildZones(
  candles: Candle[],
  points: SwingPoint[],
  tolerancePct: number,
  type: 'liquidity_pool_sellside' | 'liquidity_pool_buyside'
): SmcZone[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];
  let current: SwingPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const point = sorted[i];
    const tolerance = prev.price * tolerancePct;
    if (Math.abs(point.price - prev.price) <= tolerance) {
      current.push(point);
    } else {
      clusters.push(current);
      current = [point];
    }
  }
  clusters.push(current);

  const zones: SmcZone[] = [];
  for (const cluster of clusters) {
    if (cluster.length < 2) continue;

    const prices = cluster.map((p) => p.price);
    const priceHigh = Math.max(...prices);
    const priceLow = Math.min(...prices);
    const referencePrice = type === 'liquidity_pool_sellside' ? priceHigh : priceLow;
    const startTime = Math.min(...cluster.map((p) => p.time));
    const lastPointIndex = Math.max(...cluster.map((p) => p.index));

    // Sweep: procura, depois do último ponto do cluster, o primeiro candle que
    // rompe o nível de referência.
    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let i = lastPointIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      const swept =
        type === 'liquidity_pool_sellside' ? c.high > referencePrice : c.low < referencePrice;
      if (swept) {
        mitigated = true;
        mitigatedAt = c.timestamp;
        break;
      }
    }

    let strength = 50 + Math.min(30, (cluster.length - 2) * 10);
    if (!mitigated) strength += 20;

    zones.push({
      id: `${type}_${startTime}_${referencePrice.toFixed(5)}`,
      type,
      priceHigh,
      priceLow,
      startTime,
      endTime: mitigatedAt,
      mitigated,
      mitigatedAt,
      strength: Math.min(100, strength),
      confluence: [],
      touches: cluster.length
    });
  }

  return zones;
}
