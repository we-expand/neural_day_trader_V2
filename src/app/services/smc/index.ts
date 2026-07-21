import type { Candle, SmcAnalysisResult, SmcAnalysisOptions, SmcZone } from './types';
import { detectSwingPoints, detectStructureEvents } from './marketStructure';
import { detectOrderBlocks } from './orderBlocks';
import { detectFairValueGaps } from './fairValueGaps';
import { detectLiquidityPools } from './liquidityPools';

export * from './types';
export { detectSwingPoints, detectStructureEvents } from './marketStructure';
export { detectOrderBlocks } from './orderBlocks';
export { detectFairValueGaps } from './fairValueGaps';
export { detectLiquidityPools } from './liquidityPools';

const DEFAULT_OPTIONS: Required<SmcAnalysisOptions> = {
  swingLookback: 2,
  equalityTolerancePct: 0.001,
  maxZonesPerCategory: 10
};

/** Duas zonas se sobrepõem se seus ranges de preço se cruzam. */
function overlaps(a: SmcZone, b: SmcZone): boolean {
  return a.priceLow <= b.priceHigh && a.priceHigh >= b.priceLow;
}

/**
 * Motor de Smart Money Concepts — 100% determinístico sobre candle real.
 * Nunca prevê preço: identifica zonas de alta probabilidade de reação
 * institucional (Order Blocks, Fair Value Gaps, Liquidity Pools) e os
 * últimos eventos de estrutura de mercado (BOS/CHoCH).
 */
export function analyzeSmc(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  options?: SmcAnalysisOptions
): SmcAnalysisResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (candles.length < 10) {
    return {
      symbol,
      timeframe,
      orderBlocks: [],
      fairValueGaps: [],
      liquidityPools: [],
      structureEvents: [],
      lastStructureEvent: null,
      computedAt: Date.now()
    };
  }

  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const swings = detectSwingPoints(sorted, opts.swingLookback);
  const structureEvents = detectStructureEvents(sorted, swings);

  const orderBlocks = detectOrderBlocks(sorted, structureEvents);
  const fairValueGaps = detectFairValueGaps(sorted);
  const liquidityPools = detectLiquidityPools(sorted, swings, opts.equalityTolerancePct);

  // Confluência: marca zonas cujo range se sobrepõe a uma zona de outra categoria.
  markConfluence(orderBlocks, fairValueGaps, 'fvg');
  markConfluence(fairValueGaps, orderBlocks, 'order_block');
  markConfluence(orderBlocks, liquidityPools, 'liquidity_pool');
  markConfluence(liquidityPools, orderBlocks, 'order_block');
  markConfluence(fairValueGaps, liquidityPools, 'liquidity_pool');
  markConfluence(liquidityPools, fairValueGaps, 'fvg');

  const sortByStrength = (a: SmcZone, b: SmcZone) => b.strength - a.strength;

  const cappedOrderBlocks = orderBlocks.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);
  const cappedFvgs = fairValueGaps.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);
  const cappedPools = liquidityPools.sort(sortByStrength).slice(0, opts.maxZonesPerCategory);

  const lastStructureEvent =
    structureEvents.length > 0 ? structureEvents[structureEvents.length - 1] : null;

  return {
    symbol,
    timeframe,
    orderBlocks: cappedOrderBlocks,
    fairValueGaps: cappedFvgs,
    liquidityPools: cappedPools,
    structureEvents,
    lastStructureEvent,
    computedAt: Date.now()
  };
}

function markConfluence(target: SmcZone[], others: SmcZone[], label: string): void {
  for (const zone of target) {
    const hasOverlap = others.some((other) => overlaps(zone, other));
    if (hasOverlap && !zone.confluence.includes(label)) {
      zone.confluence.push(label);
    }
  }
}
