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
} from '../indicators/TechnicalIndicators.ts';
import { IndicatorType, OperatorType, Strategy, StrategyBlock, StrategySignal } from '../../types/strategy.ts';

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

const CROSS_SCORE_LOOKBACK = 10;
const CROSS_SCORE_DECAY_PER_CANDLE = 10;

/**
 * Distância (em candles) do cruzamento mais recente dentro da janela de
 * `CROSS_SCORE_LOOKBACK` candles, decaindo `CROSS_SCORE_DECAY_PER_CANDLE`
 * pontos por candle — cruzamento no candle atual pontua 100, cruzamento há 3
 * candles pontua 70, nenhum cruzamento na janela pontua 0.
 */
function crossRecencyScore(
  series: (number | null)[],
  ref: (number | null)[],
  i: number,
  direction: 'above' | 'below'
): number {
  for (let back = 0; back < CROSS_SCORE_LOOKBACK; back++) {
    const idx = i - back;
    if (idx < 1) break;
    const crossed = direction === 'above' ? crossedAbove(series, ref, idx) : crossedBelow(series, ref, idx);
    if (crossed) return Math.max(0, 100 - back * CROSS_SCORE_DECAY_PER_CANDLE);
  }
  return 0;
}

/**
 * Score parcial (0-100) de um único bloco de entrada no índice `i` —
 * generalização graduada de `evaluateBlock` (que só retorna booleano).
 *
 * Espec. técnica de 2026-08-16 (SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md):
 * ABOVE/BELOW/BETWEEN/RISING/FALLING são booleanos por natureza — permanecem
 * 100/0. CROSS_ABOVE/CROSS_BELOW ganham gradação por recência (mais perto do
 * cruzamento = score mais alto, decai com o tempo) em vez de só o candle exato.
 * `filterBlocks` NÃO usam esta função — continuam gate binário rígido via
 * `evaluateBlock` (filtro é "não opere neste regime", não "opere um pouco
 * menos neste regime" — não misturar as duas semânticas).
 */
export function scoreBlock(block: StrategyBlock, cache: IndicatorCache, i: number): number {
  if (!block.enabled) return 100; // mesmo comportamento de evaluateBlock: bloco desabilitado não pesa contra
  if (i < 2) return 0;

  const series = cache.get(block.indicator, block.period);
  const curr = series[i];
  const prev = series[i - 1];
  if (curr === null) return 0;

  switch (block.operator) {
    case 'ABOVE':
      return block.value !== undefined && curr > block.value ? 100 : 0;
    case 'BELOW':
      return block.value !== undefined && curr < block.value ? 100 : 0;
    case 'BETWEEN':
      return block.value !== undefined &&
        block.value2 !== undefined &&
        curr >= Math.min(block.value, block.value2) &&
        curr <= Math.max(block.value, block.value2)
        ? 100
        : 0;
    case 'RISING':
      return prev !== null && curr > prev ? 100 : 0;
    case 'FALLING':
      return prev !== null && curr < prev ? 100 : 0;
    case 'CROSS_ABOVE': {
      const ref = block.compareIndicator
        ? cache.get(block.compareIndicator, block.comparePeriod)
        : series.map(() => block.value ?? null);
      return crossRecencyScore(series, ref, i, 'above');
    }
    case 'CROSS_BELOW': {
      const ref = block.compareIndicator
        ? cache.get(block.compareIndicator, block.comparePeriod)
        : series.map(() => block.value ?? null);
      return crossRecencyScore(series, ref, i, 'below');
    }
    default:
      return 0;
  }
}

export interface StrategyScoreResult {
  /** Média simples (0-100) dos scores de `entryBlocks` — pesos iguais por decisão do Cleber em 2026-08-16, não medição. */
  score: number;
  signal: 'BUY' | 'SELL' | null;
  blockScores: { label: string; score: number }[];
  reasons: string[];
}

/**
 * Score contínuo de uma estratégia no índice `i` — NÃO substitui
 * `evaluateStrategyAt` (gate binário, ainda o caminho usado em produção via
 * `runTradingCycle.ts`). Adicionada em 2026-08-16 como item 1 do redesenho do
 * cérebro (ver NEXT_SESSION.md): calcular o score ANTES de decidir piso,
 * pra medir score contínuo vs. gate binário nos dados reais em cache antes
 * de promover. Ainda não ligada em nenhum caminho de execução.
 */
export function evaluateStrategyScoreAt(
  strategy: Strategy,
  candles: Candle[],
  i: number,
  cache?: IndicatorCache
): StrategyScoreResult {
  const indicatorCache = cache ?? new IndicatorCache(candles);
  const reasons: string[] = [];

  const activeFilters = strategy.filterBlocks.filter(b => b.enabled);
  for (const block of activeFilters) {
    if (!evaluateBlock(block, indicatorCache, i, candles.length)) {
      return { score: 0, signal: null, blockScores: [], reasons: [`Filtro "${block.label}" não satisfeito`] };
    }
    reasons.push(`Filtro OK: ${block.label}`);
  }

  const activeEntry = strategy.entryBlocks.filter(b => b.enabled);
  if (activeEntry.length === 0) {
    return { score: 0, signal: null, blockScores: [], reasons: ['Nenhum bloco de entrada configurado'] };
  }

  const blockScores = activeEntry.map(block => ({
    label: block.label,
    score: scoreBlock(block, indicatorCache, i),
  }));
  const score = blockScores.reduce((sum, b) => sum + b.score, 0) / blockScores.length;

  let signal: 'BUY' | 'SELL';
  if (strategy.entrySignal) {
    signal = strategy.entrySignal;
  } else {
    const bearishOps: OperatorType[] = ['CROSS_BELOW', 'BELOW', 'FALLING'];
    const bearishCount = activeEntry.filter(b => bearishOps.includes(b.operator)).length;
    signal = bearishCount > activeEntry.length / 2 ? 'SELL' : 'BUY';
  }

  if (strategy.direction === 'LONG' && signal === 'SELL') {
    return { score, signal: null, blockScores, reasons: [...reasons, 'Sinal SELL descartado: estratégia travada em LONG'] };
  }
  if (strategy.direction === 'SHORT' && signal === 'BUY') {
    return { score, signal: null, blockScores, reasons: [...reasons, 'Sinal BUY descartado: estratégia travada em SHORT'] };
  }

  blockScores.forEach(b => reasons.push(`${b.label}: score ${b.score.toFixed(0)}`));

  return { score, signal, blockScores, reasons };
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
