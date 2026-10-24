/**
 * Motor de Smart Money Concepts (SMC) — 100% determinístico sobre candle
 * real. Nunca prevê preço: identifica zonas de alta probabilidade de reação
 * de preço (Order Blocks, Fair Value Gaps, Liquidity Pools) a partir de
 * padrões técnicos conhecidos, e eventos de estrutura (BOS/CHoCH).
 *
 * Portado de `src/app/services/smc/` (frontend, já em produção há semanas
 * desenhando zonas no ChartView) pra este motor em 2026-09-09, a pedido do
 * Cleber ("nosso motor utilizará essas tecnologias pra ajudar na tomada de
 * decisões") — veredito do llm-council: entra só como CONTEXTO adicional
 * pro LLM, nunca como gatilho mecânico novo de entrada/saída (mesma
 * disciplina de `getMarketRegime`/`getSupportResistance` já usados aqui).
 * Lógica idêntica ao original — qualquer fix de bug deveria ser replicado
 * nos dois lados até existir um pacote compartilhado real.
 */

export interface SmcCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type SwingKind = "high" | "low";

export interface SwingPoint {
  kind: SwingKind;
  index: number;
  time: number;
  price: number;
}

export type SmcZoneType =
  | "order_block_bullish"
  | "order_block_bearish"
  | "fvg_bullish"
  | "fvg_bearish"
  | "liquidity_pool_buyside"
  | "liquidity_pool_sellside";

export interface SmcZone {
  id: string;
  type: SmcZoneType;
  priceHigh: number;
  priceLow: number;
  startTime: number;
  endTime: number | null;
  mitigated: boolean;
  mitigatedAt: number | null;
  strength: number; // 0-100
  confluence: string[];
  touches?: number;
}

export type StructureEventKind = "BOS" | "CHoCH";

export interface StructureEvent {
  id: string;
  kind: StructureEventKind;
  direction: "bullish" | "bearish";
  time: number;
  price: number;
  brokenSwingTime: number;
}

export interface SmcAnalysisResult {
  symbol: string;
  timeframe: string;
  orderBlocks: SmcZone[];
  fairValueGaps: SmcZone[];
  liquidityPools: SmcZone[];
  structureEvents: StructureEvent[];
  lastStructureEvent: StructureEvent | null;
  computedAt: number;
}

function detectSwingPoints(candles: SmcCandle[], lookback = 2): SwingPoint[] {
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

    if (isHigh) swings.push({ kind: "high", index: i, time: current.timestamp, price: current.high });
    if (isLow) swings.push({ kind: "low", index: i, time: current.timestamp, price: current.low });
  }

  return swings;
}

function detectStructureEvents(candles: SmcCandle[], swings: SwingPoint[]): StructureEvent[] {
  const events: StructureEvent[] = [];
  if (swings.length < 2 || candles.length === 0) return events;

  const highs = swings.filter((s) => s.kind === "high").sort((a, b) => a.index - b.index);
  const lows = swings.filter((s) => s.kind === "low").sort((a, b) => a.index - b.index);

  let bias: "bullish" | "bearish" | null = null;
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;
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

    if (lastSwingHigh && candle.timestamp > lastSwingHigh.time && candle.close > lastSwingHigh.price) {
      const kind = bias === "bearish" || bias === null ? "CHoCH" : "BOS";
      const alreadyBroken = events.some((e) => e.brokenSwingTime === lastSwingHigh!.time && e.direction === "bullish");
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bullish_${lastSwingHigh.time}_${candle.timestamp}`,
          kind: bias === null ? "CHoCH" : kind,
          direction: "bullish",
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingHigh.time,
        });
      }
      bias = "bullish";
    }

    if (lastSwingLow && candle.timestamp > lastSwingLow.time && candle.close < lastSwingLow.price) {
      const kind = bias === "bullish" || bias === null ? "CHoCH" : "BOS";
      const alreadyBroken = events.some((e) => e.brokenSwingTime === lastSwingLow!.time && e.direction === "bearish");
      if (!alreadyBroken) {
        events.push({
          id: `${kind}_bearish_${lastSwingLow.time}_${candle.timestamp}`,
          kind: bias === null ? "CHoCH" : kind,
          direction: "bearish",
          time: candle.timestamp,
          price: candle.close,
          brokenSwingTime: lastSwingLow.time,
        });
      }
      bias = "bearish";
    }
  }

  return events;
}

function averageRange(candles: SmcCandle[], period = 14): number {
  if (candles.length === 0) return 0;
  const slice = candles.slice(-period);
  const sum = slice.reduce((acc, c) => acc + (c.high - c.low), 0);
  return sum / slice.length;
}

function detectOrderBlocks(candles: SmcCandle[], structureEvents: StructureEvent[]): SmcZone[] {
  if (candles.length === 0 || structureEvents.length === 0) return [];

  const avgRange = averageRange(candles, 14);
  const displacementThreshold = avgRange * 1.5;
  const timeToIndex = new Map<number, number>();
  candles.forEach((c, i) => timeToIndex.set(c.timestamp, i));

  const zones: SmcZone[] = [];

  for (const event of structureEvents) {
    const breakIndex = timeToIndex.get(event.time);
    if (breakIndex === undefined || breakIndex < 1) continue;

    const isBullishBreak = event.direction === "bullish";
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

    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let i = baseIndex + 1; i < candles.length; i++) {
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
      id: `order_block_${isBullishBreak ? "bullish" : "bearish"}_${baseCandle.timestamp}`,
      type: isBullishBreak ? "order_block_bullish" : "order_block_bearish",
      priceHigh: baseCandle.high,
      priceLow: baseCandle.low,
      startTime: baseCandle.timestamp,
      endTime: mitigatedAt,
      mitigated,
      mitigatedAt,
      strength: Math.min(100, strength),
      confluence: [],
    });
  }

  return zones;
}

function detectFairValueGaps(candles: SmcCandle[]): SmcZone[] {
  const zones: SmcZone[] = [];
  if (candles.length < 3) return zones;

  const avgRange = averageRange(candles, 14);

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];

    let type: "fvg_bullish" | "fvg_bearish" | null = null;
    let priceLow = 0;
    let priceHigh = 0;

    if (prev.high < next.low) {
      type = "fvg_bullish";
      priceLow = prev.high;
      priceHigh = next.low;
    } else if (prev.low > next.high) {
      type = "fvg_bearish";
      priceLow = next.high;
      priceHigh = prev.low;
    }

    if (!type) continue;

    const gapSize = priceHigh - priceLow;
    if (gapSize <= 0) continue;

    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let j = i + 2; j < candles.length; j++) {
      const c = candles[j];
      const overlaps = c.low <= priceHigh && c.high >= priceLow;
      if (overlaps) { mitigated = true; mitigatedAt = c.timestamp; break; }
    }

    let strength = 40;
    if (gapSize > avgRange * 0.5) strength += 20;
    if (!mitigated) strength += 20;

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
      confluence: [],
    });
  }

  return zones;
}

function clusterAndBuildZones(
  candles: SmcCandle[],
  points: SwingPoint[],
  tolerancePct: number,
  type: "liquidity_pool_sellside" | "liquidity_pool_buyside",
): SmcZone[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];
  let current: SwingPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const anchor = current[0];
    const point = sorted[i];
    const tolerance = anchor.price * tolerancePct;
    if (Math.abs(point.price - anchor.price) <= tolerance) {
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
    const referencePrice = type === "liquidity_pool_sellside" ? priceHigh : priceLow;
    const startTime = Math.min(...cluster.map((p) => p.time));
    const lastPointIndex = Math.max(...cluster.map((p) => p.index));

    let mitigated = false;
    let mitigatedAt: number | null = null;
    for (let i = lastPointIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      const swept = type === "liquidity_pool_sellside" ? c.high > referencePrice : c.low < referencePrice;
      if (swept) { mitigated = true; mitigatedAt = c.timestamp; break; }
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
      touches: cluster.length,
    });
  }

  return zones;
}

function detectLiquidityPools(candles: SmcCandle[], swings: SwingPoint[], equalityTolerancePct = 0.001): SmcZone[] {
  const zones: SmcZone[] = [];
  if (candles.length === 0) return zones;

  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");

  zones.push(...clusterAndBuildZones(candles, highs, equalityTolerancePct, "liquidity_pool_sellside"));
  zones.push(...clusterAndBuildZones(candles, lows, equalityTolerancePct, "liquidity_pool_buyside"));

  return zones;
}

function overlaps(a: SmcZone, b: SmcZone): boolean {
  return a.priceLow <= b.priceHigh && a.priceHigh >= b.priceLow;
}

function markConfluence(target: SmcZone[], others: SmcZone[], label: string): void {
  for (const zone of target) {
    const hasOverlap = others.some((other) => overlaps(zone, other));
    if (hasOverlap && !zone.confluence.includes(label)) zone.confluence.push(label);
  }
}

const DEFAULT_OPTIONS = { swingLookback: 2, equalityTolerancePct: 0.001, maxZonesPerCategory: 10 };

/** Motor SMC completo — orquestra os 3 detectores + eventos de estrutura + confluência. */
export function analyzeSmc(
  candles: SmcCandle[],
  symbol: string,
  timeframe: string,
  options?: Partial<typeof DEFAULT_OPTIONS>,
): SmcAnalysisResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (candles.length < 10) {
    return {
      symbol, timeframe, orderBlocks: [], fairValueGaps: [], liquidityPools: [],
      structureEvents: [], lastStructureEvent: null, computedAt: Date.now(),
    };
  }

  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const swings = detectSwingPoints(sorted, opts.swingLookback);
  const structureEvents = detectStructureEvents(sorted, swings);

  const orderBlocks = detectOrderBlocks(sorted, structureEvents);
  const fairValueGaps = detectFairValueGaps(sorted);
  const liquidityPools = detectLiquidityPools(sorted, swings, opts.equalityTolerancePct);

  markConfluence(orderBlocks, fairValueGaps, "fvg");
  markConfluence(fairValueGaps, orderBlocks, "order_block");
  markConfluence(orderBlocks, liquidityPools, "liquidity_pool");
  markConfluence(liquidityPools, orderBlocks, "order_block");
  markConfluence(fairValueGaps, liquidityPools, "liquidity_pool");
  markConfluence(liquidityPools, fairValueGaps, "fvg");

  const sortByStrength = (a: SmcZone, b: SmcZone) => b.strength - a.strength;

  const cappedOrderBlocks = orderBlocks.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);
  const cappedFvgs = fairValueGaps.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);
  const cappedPools = liquidityPools.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);

  const lastStructureEvent = structureEvents.length > 0 ? structureEvents[structureEvents.length - 1] : null;

  return {
    symbol, timeframe,
    orderBlocks: cappedOrderBlocks,
    fairValueGaps: cappedFvgs,
    liquidityPools: cappedPools,
    structureEvents,
    lastStructureEvent,
    computedAt: Date.now(),
  };
}
