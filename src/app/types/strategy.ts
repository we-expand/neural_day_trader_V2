export type IndicatorType =
  | 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'BB_UPPER' | 'BB_LOWER' | 'STOCH' | 'ADX' | 'ATR'
  | 'VWAP' | 'OBV' | 'CCI' | 'WILLIAMS' | 'SAR' | 'PRICE';

export type OperatorType =
  | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'ABOVE' | 'BELOW'
  | 'BETWEEN' | 'RISING' | 'FALLING';

export type BlockKind = 'ENTRY' | 'EXIT' | 'FILTER';

export interface StrategyBlock {
  id: string;
  type: BlockKind;
  category: string;
  indicator: IndicatorType;
  period?: number;
  /** Segundo indicador para comparações indicador-vs-indicador (ex: EMA9 CROSS_ABOVE EMA21) */
  compareIndicator?: IndicatorType;
  comparePeriod?: number;
  operator: OperatorType;
  value?: number;
  value2?: number;
  label: string;
  description?: string;
  enabled: boolean;
}

export type RiskProfileType =
  | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'INSTITUTIONAL' | 'INSTITUTIONAL_SMC'
  | 'EQUILIBRADO' | 'DEGEN';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  entryBlocks: StrategyBlock[];
  exitBlocks: StrategyBlock[];
  filterBlocks: StrategyBlock[];
  direction: 'AUTO' | 'LONG' | 'SHORT';
  stopLoss: number;
  takeProfit: number;
  trailingStop: boolean;
  riskProfile: RiskProfileType;
  positionSizePercent: number;
  timeframe: Timeframe;
  maxConcurrentTrades: number;
  createdBy?: string | null;
  updatedAt?: string;
}

export interface StrategySignal {
  signal: 'BUY' | 'SELL' | null;
  confidence: number;
  reasons: string[];
}
