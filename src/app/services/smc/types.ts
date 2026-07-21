// Tipos compartilhados do motor de Smart Money Concepts (SMC).
// Motor 100% determinístico sobre candle real — nunca prevê preço, só identifica
// zonas de alta probabilidade de reação institucional a partir de padrões conhecidos.

export interface Candle {
  timestamp: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SwingKind = 'high' | 'low';

export interface SwingPoint {
  kind: SwingKind;
  index: number; // índice no array de candles usado
  time: number;
  price: number;
}

export type SmcZoneType =
  | 'order_block_bullish'
  | 'order_block_bearish'
  | 'fvg_bullish'
  | 'fvg_bearish'
  | 'liquidity_pool_buyside'
  | 'liquidity_pool_sellside';

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

export type StructureEventKind = 'BOS' | 'CHoCH';

export interface StructureEvent {
  id: string;
  kind: StructureEventKind;
  direction: 'bullish' | 'bearish';
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

export interface SmcAnalysisOptions {
  swingLookback?: number; // candles de cada lado pro fractal (default 2)
  equalityTolerancePct?: number; // tolerância de "topo/fundo igual" (default 0.001 = 0.1%)
  maxZonesPerCategory?: number; // corte por categoria (default 10)
}
