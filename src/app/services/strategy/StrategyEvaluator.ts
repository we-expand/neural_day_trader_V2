import {
  Candle,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateADX,
  calculateATR,
  calculateVWAP,
  calculateOBV,
  calculateCCI,
  calculateWilliamsR,
  calculateSAR,
  calculateDonchian,
} from '../indicators/TechnicalIndicators';
import { IndicatorType, OperatorType, Strategy, StrategyBlock, StrategySignal } from '../../types/strategy';

/**
 * Cache de séries de indicador por (indicador, período) para não recalcular
 * a mesma série várias vezes ao avaliar vários blocos da mesma estratégia.
 */
export class IndicatorCache {
  private cache = new Map<string, (number | null)[]>();
  private donchianCache = new Map<number, { upper: (number | null)[]; lower: (number | null)[] }>();

  constructor(private candles: Candle[]) {}

  private key(indicator: IndicatorType, period?: number): string {
    return `${indicator}_${period ?? 'default'}`;
  }

  /** upper/lower do Donchian nascem do mesmo cálculo — cacheados juntos por período. */
  private donchian(period: number): { upper: (number | null)[]; lower: (number | null)[] } {
    const cached = this.donchianCache.get(period);
    if (cached) return cached;
    const result = calculateDonchian(this.candles, period);
    this.donchianCache.set(period, result);
    return result;
  }

  get(indicator: IndicatorType, period?: number): (number | null)[] {
    const key = this.key(indicator, period);
    if (this.cache.has(key)) return this.cache.get(key)!;

    let series: (number | null)[];
    switch (indicator) {
      case 'SMA':
        series = calculateSMA(this.candles, period ?? 20);
        break;
      case 'EMA':
        series = calculateEMA(this.candles, period ?? 20);
        break;
      case 'RSI':
        series = calculateRSI(this.candles, period ?? 14);
        break;
      case 'MACD':
        series = calculateMACD(this.candles).histogram;
        break;
      case 'BB':
        series = calculateBollingerBands(this.candles, period ?? 20).middle;
        break;
      case 'BB_UPPER':
        series = calculateBollingerBands(this.candles, period ?? 20).upper;
        break;
      case 'BB_LOWER':
        series = calculateBollingerBands(this.candles, period ?? 20).lower;
        break;
      case 'STOCH':
        series = calculateStochastic(this.candles, period ?? 14).k;
        break;
      case 'ADX':
        series = calculateADX(this.candles, period ?? 14);
        break;
      case 'ATR':
        series = calculateATR(this.candles, period ?? 14);
        break;
      case 'VWAP':
        series = calculateVWAP(this.candles);
        break;
      case 'OBV':
        series = calculateOBV(this.candles);
        break;
      case 'CCI':
        series = calculateCCI(this.candles, period ?? 20);
        break;
      case 'WILLIAMS':
        series = calculateWilliamsR(this.candles, period ?? 14);
        break;
      case 'SAR':
        series = calculateSAR(this.candles);
        break;
      case 'DONCHIAN_UPPER':
        series = this.donchian(period ?? 20).upper;
        break;
      case 'DONCHIAN_LOWER':
        series = this.donchian(period ?? 20).lower;
        break;
      case 'PRICE':
        series = this.candles.map(c => c.close);
        break;
      default:
        series = new Array(this.candles.length).fill(null);
    }

    this.cache.set(key, series);
    return series;
  }
}

function crossedAbove(series: (number | null)[], ref: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const prevA = series[i - 1];
  const currA = series[i];
  const prevB = ref[i - 1];
  const currB = ref[i];
  if (prevA === null || currA === null || prevB === null || currB === null) return false;
  return prevA <= prevB && currA > currB;
}

function crossedBelow(series: (number | null)[], ref: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const prevA = series[i - 1];
  const currA = series[i];
  const prevB = ref[i - 1];
  const currB = ref[i];
  if (prevA === null || currA === null || prevB === null || currB === null) return false;
  return prevA >= prevB && currA < currB;
}

/**
 * Avalia um único bloco no índice `i` (candle "atual" fechado).
 * Retorna true se a condição do bloco está satisfeita naquele candle.
 */
function evaluateBlock(block: StrategyBlock, cache: IndicatorCache, i: number, candleCount: number): boolean {
  if (!block.enabled) return true; // bloco desabilitado não bloqueia nada
  if (i < 2) return false; // precisa de histórico mínimo pra cross/rising/falling

  const series = cache.get(block.indicator, block.period);
  const curr = series[i];
  const prev = series[i - 1];
  if (curr === null) return false;

  switch (block.operator) {
    case 'ABOVE':
      return block.value !== undefined && curr > block.value;
    case 'BELOW':
      return block.value !== undefined && curr < block.value;
    case 'BETWEEN':
      return (
        block.value !== undefined &&
        block.value2 !== undefined &&
        curr >= Math.min(block.value, block.value2) &&
        curr <= Math.max(block.value, block.value2)
      );
    case 'RISING':
      return prev !== null && curr > prev;
    case 'FALLING':
      return prev !== null && curr < prev;
    case 'CROSS_ABOVE': {
      const ref = block.compareIndicator
        ? cache.get(block.compareIndicator, block.comparePeriod)
        : series.map(() => block.value ?? null);
      return crossedAbove(series, ref, i);
    }
    case 'CROSS_BELOW': {
      const ref = block.compareIndicator
        ? cache.get(block.compareIndicator, block.comparePeriod)
        : series.map(() => block.value ?? null);
      return crossedBelow(series, ref, i);
    }
    default:
      return false;
  }
}

/**
 * Avalia uma estratégia completa no índice `i` do array de candles (candle fechado
 * mais recente disponível no momento da decisão — nunca olha candles futuros).
 *
 * Regra: TODOS os blocos habilitados de `entryBlocks` precisam bater (AND lógico)
 * para gerar sinal de compra; o mesmo conjunto avaliado do lado inverso via
 * `exitBlocks` para saída. `filterBlocks` são gates adicionais que também
 * precisam bater (ex.: ADX > 25 pra confirmar tendência) antes de qualquer entrada.
 */
export function evaluateStrategyAt(
  strategy: Strategy,
  candles: Candle[],
  i: number,
  cache?: IndicatorCache
): StrategySignal {
  const indicatorCache = cache ?? new IndicatorCache(candles);
  const reasons: string[] = [];

  const activeFilters = strategy.filterBlocks.filter(b => b.enabled);
  for (const block of activeFilters) {
    if (!evaluateBlock(block, indicatorCache, i, candles.length)) {
      return { signal: null, confidence: 0, reasons: [`Filtro "${block.label}" não satisfeito`] };
    }
    reasons.push(`Filtro OK: ${block.label}`);
  }

  const activeEntry = strategy.entryBlocks.filter(b => b.enabled);
  if (activeEntry.length === 0) {
    return { signal: null, confidence: 0, reasons: ['Nenhum bloco de entrada configurado'] };
  }

  const entryResults = activeEntry.map(block => evaluateBlock(block, indicatorCache, i, candles.length));
  const entryHits = entryResults.filter(Boolean).length;
  const allEntryPass = entryHits === activeEntry.length;

  if (!allEntryPass) {
    return { signal: null, confidence: 0, reasons: [] };
  }

  activeEntry.forEach(block => reasons.push(`Entrada OK: ${block.label}`));

  // Direção do sinal: usa strategy.entrySignal quando declarado explicitamente
  // (todos os presets do catálogo declaram — ver types/strategy.ts). Cai para
  // a inferência antiga por contagem de operador só em estratégias
  // customizadas legadas sem o campo (StrategyBuilderPro.tsx) — mantida por
  // retrocompatibilidade, mas é uma aproximação sujeita ao mesmo tipo de erro
  // que inverteu o preset 3 (ver comentário em types/strategy.ts).
  let signal: 'BUY' | 'SELL';
  if (strategy.entrySignal) {
    signal = strategy.entrySignal;
  } else {
    const bearishOps: OperatorType[] = ['CROSS_BELOW', 'BELOW', 'FALLING'];
    const bearishCount = activeEntry.filter(b => bearishOps.includes(b.operator)).length;
    signal = bearishCount > activeEntry.length / 2 ? 'SELL' : 'BUY';
  }

  // Direção travada pela estratégia (equivalente ao filtro `direction` do useApexLogic)
  if (strategy.direction === 'LONG' && signal === 'SELL') {
    return { signal: null, confidence: 0, reasons: ['Sinal SELL descartado: estratégia travada em LONG'] };
  }
  if (strategy.direction === 'SHORT' && signal === 'BUY') {
    return { signal: null, confidence: 0, reasons: ['Sinal BUY descartado: estratégia travada em SHORT'] };
  }

  const confidence = Math.round(50 + (entryHits / activeEntry.length) * 30 + Math.min(activeFilters.length, 5) * 4);

  return { signal, confidence: Math.min(confidence, 99), reasons };
}

/**
 * Avalia uma estratégia sobre a série completa de candles, retornando o sinal
 * gerado em cada candle fechado (usado pelo backtest para varrer o histórico
 * inteiro sem recalcular os indicadores do zero a cada passo).
 */
export function evaluateStrategySeries(strategy: Strategy, candles: Candle[]): StrategySignal[] {
  const cache = new IndicatorCache(candles);
  return candles.map((_, i) => evaluateStrategyAt(strategy, candles, i, cache));
}

/** Checa se algum bloco de saída da estratégia está satisfeito no candle `i` (uso do backtest/live para fechar posição por regra, além de TP/SL). */
export function evaluateExitAt(strategy: Strategy, candles: Candle[], i: number, cache?: IndicatorCache): boolean {
  const indicatorCache = cache ?? new IndicatorCache(candles);
  const activeExit = strategy.exitBlocks.filter(b => b.enabled);
  if (activeExit.length === 0) return false;
  return activeExit.some(block => evaluateBlock(block, indicatorCache, i, candles.length));
}
