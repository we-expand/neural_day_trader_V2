/**
 * 📊 TECHNICAL INDICATORS MODULE
 * 
 * Cálculos profissionais de indicadores técnicos para trading quantitativo
 * 
 * Implementado:
 * - ATR (Average True Range) - Volatilidade real
 * - Chandelier Exit - Trailing stop baseado em ATR
 * - Parabolic SAR - Stop & Reverse progressivo
 * - Keltner Channels - Bandas de volatilidade
 * - EMA - Exponential Moving Average
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ATRResult {
  atr: number;
  trueRanges: number[];
  period: number;
}

export interface ChandelierExitResult {
  stopLevel: number;
  atr: number;
  highestHigh?: number;
  lowestLow?: number;
  distance: number; // Distância do preço atual
  distancePips: number; // Em pips (4 decimais)
}

export interface ParabolicSARResult {
  sar: number;
  trend: 'UP' | 'DOWN';
  acceleration: number;
}

export interface KeltnerChannelResult {
  upper: number;
  middle: number; // EMA
  lower: number;
  atr: number;
}

// ============================================================================
// 1. ATR (AVERAGE TRUE RANGE)
// ============================================================================

/**
 * Calcula ATR (Average True Range) - Indicador de volatilidade
 * 
 * ATR mede a volatilidade real do mercado considerando gaps e movimentos extremos.
 * Desenvolvido por J. Welles Wilder Jr. (1978)
 * 
 * @param candles - Array de candles (mínimo: period + 1)
 * @param period - Período para cálculo (padrão: 14)
 * @returns ATRResult com ATR e True Ranges
 * 
 * @example
 * const candles = await getCandles('EURUSD', '1h', 30);
 * const { atr } = calculateATR(candles, 14);
 * console.log(`ATR: ${atr.toFixed(5)}`); // 0.00085
 */
export function calculateATR(
  candles: Candle[],
  period: number = 14
): ATRResult {
  if (candles.length < period + 1) {
    console.warn(`[ATR] Candles insuficientes: ${candles.length} (mínimo: ${period + 1})`);
    return { atr: 0, trueRanges: [], period };
  }

  const trueRanges: number[] = [];

  // Calcular True Range para cada candle
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    // True Range = max de:
    // 1. High - Low (range normal)
    // 2. |High - Close anterior| (gap up/down)
    // 3. |Low - Close anterior| (gap up/down)
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    trueRanges.push(tr);
  }

  // ATR = Média dos últimos N true ranges
  // (Wilder usa média móvel suavizada, mas média simples é aceitável)
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / period;

  return {
    atr,
    trueRanges,
    period
  };
}

/**
 * Calcula ATR Suavizado (método original de Wilder)
 * ATR(t) = [(ATR(t-1) × (n-1)) + TR(t)] / n
 * 
 * Mais suave que média simples, menos sensível a picos
 */
export function calculateSmoothedATR(
  candles: Candle[],
  period: number = 14
): ATRResult {
  if (candles.length < period + 1) {
    return { atr: 0, trueRanges: [], period };
  }

  const trueRanges: number[] = [];

  // Calcular todos os True Ranges
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    trueRanges.push(tr);
  }

  // Primeiro ATR = média simples dos primeiros N
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // ATRs subsequentes = suavização de Wilder
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }

  return {
    atr,
    trueRanges,
    period
  };
}

// ============================================================================
// 2. CHANDELIER EXIT (TRAILING STOP ATR)
// ============================================================================

/**
 * Calcula Chandelier Exit - Trailing stop baseado em ATR
 * 
 * Desenvolvido por Chuck LeBeau, este método coloca o stop a uma distância
 * de N × ATR do highest high (long) ou lowest low (short).
 * 
 * Vantagens:
 * - Adapta-se à volatilidade (mercado calmo = stop apertado)
 * - Evita "violínadas" (stop fora do ruído estatístico)
 * - Protege lucros automaticamente
 * 
 * @param candles - Dados de mercado
 * @param side - 'LONG' ou 'SHORT'
 * @param multiplier - Multiplicador de ATR (2.0 = 2× ATR de distância)
 * @param period - Período para ATR e highest/lowest (padrão: 14)
 * @returns Nível do stop e dados relacionados
 * 
 * @example
 * // LONG position
 * const exit = calculateChandelierExit(candles, 'LONG', 2.0, 14);
 * console.log(`Stop em: ${exit.stopLevel}`);
 * console.log(`Distância: ${exit.distancePips} pips`);
 */
export function calculateChandelierExit(
  candles: Candle[],
  side: 'LONG' | 'SHORT',
  multiplier: number = 2.0,
  period: number = 14
): ChandelierExitResult {
  const { atr } = calculateSmoothedATR(candles, period);
  const lastCandle = candles[candles.length - 1];
  const recentCandles = candles.slice(-period);

  let stopLevel: number;
  let referencePrice: number;

  if (side === 'LONG') {
    // LONG: Stop = Highest High - (ATR × Multiplier)
    const highestHigh = Math.max(...recentCandles.map(c => c.high));
    stopLevel = highestHigh - (atr * multiplier);
    referencePrice = highestHigh;

    return {
      stopLevel,
      atr,
      highestHigh,
      distance: lastCandle.close - stopLevel,
      distancePips: (lastCandle.close - stopLevel) * 10000,
      lowestLow: undefined
    };
  } else {
    // SHORT: Stop = Lowest Low + (ATR × Multiplier)
    const lowestLow = Math.min(...recentCandles.map(c => c.low));
    stopLevel = lowestLow + (atr * multiplier);
    referencePrice = lowestLow;

    return {
      stopLevel,
      atr,
      lowestLow,
      distance: stopLevel - lastCandle.close,
      distancePips: (stopLevel - lastCandle.close) * 10000,
      highestHigh: undefined
    };
  }
}

/**
 * Variação: Simple ATR Trailing Stop
 * Stop = Preço Atual ± (ATR × Multiplier)
 * 
 * Mais simples que Chandelier, segue o preço diretamente
 */
export function calculateSimpleATRStop(
  candles: Candle[],
  side: 'LONG' | 'SHORT',
  multiplier: number = 2.0,
  period: number = 14
): ChandelierExitResult {
  const { atr } = calculateSmoothedATR(candles, period);
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  let stopLevel: number;

  if (side === 'LONG') {
    stopLevel = currentPrice - (atr * multiplier);
  } else {
    stopLevel = currentPrice + (atr * multiplier);
  }

  return {
    stopLevel,
    atr,
    distance: Math.abs(currentPrice - stopLevel),
    distancePips: Math.abs(currentPrice - stopLevel) * 10000
  };
}

// ============================================================================
// 3. PARABOLIC SAR (STOP AND REVERSE)
// ============================================================================

/**
 * Calcula Parabolic SAR - Indicador de tendência e trailing stop
 * 
 * Desenvolvido por J. Welles Wilder Jr., o SAR acelera progressivamente
 * conforme a tendência se desenvolve.
 * 
 * @param candles - Dados de mercado
 * @param accelerationFactor - Fator de aceleração inicial (padrão: 0.02)
 * @param maxAcceleration - Aceleração máxima (padrão: 0.20)
 * @returns Nível SAR atual e tendência
 */
export function calculateParabolicSAR(
  candles: Candle[],
  accelerationFactor: number = 0.02,
  maxAcceleration: number = 0.20
): ParabolicSARResult {
  if (candles.length < 3) {
    return {
      sar: candles[candles.length - 1].close,
      trend: 'UP',
      acceleration: accelerationFactor
    };
  }

  // Implementação simplificada
  // (Para produção, usar biblioteca como tulind ou implementação completa)
  
  let sar = candles[0].low;
  let trend: 'UP' | 'DOWN' = 'UP';
  let af = accelerationFactor;
  let ep = candles[0].high; // Extreme Point

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    // Atualizar SAR
    sar = sar + af * (ep - sar);

    // Verificar reversão
    if (trend === 'UP') {
      if (candle.low < sar) {
        trend = 'DOWN';
        sar = ep;
        ep = candle.low;
        af = accelerationFactor;
      } else {
        if (candle.high > ep) {
          ep = candle.high;
          af = Math.min(af + accelerationFactor, maxAcceleration);
        }
      }
    } else {
      if (candle.high > sar) {
        trend = 'UP';
        sar = ep;
        ep = candle.high;
        af = accelerationFactor;
      } else {
        if (candle.low < ep) {
          ep = candle.low;
          af = Math.min(af + accelerationFactor, maxAcceleration);
        }
      }
    }
  }

  return {
    sar,
    trend,
    acceleration: af
  };
}

// ============================================================================
// 4. KELTNER CHANNELS
// ============================================================================

/**
 * Calcula Keltner Channels - Bandas de volatilidade baseadas em ATR
 * 
 * Similar a Bollinger Bands, mas usa ATR ao invés de desvio padrão.
 * Menos sensível a picos de volatilidade.
 * 
 * @param candles - Dados de mercado
 * @param emaPeriod - Período da EMA central (padrão: 20)
 * @param atrPeriod - Período do ATR (padrão: 14)
 * @param multiplier - Multiplicador de ATR para bandas (padrão: 2.0)
 */
export function calculateKeltnerChannels(
  candles: Candle[],
  emaPeriod: number = 20,
  atrPeriod: number = 14,
  multiplier: number = 2.0
): KeltnerChannelResult {
  const { atr } = calculateSmoothedATR(candles, atrPeriod);
  const ema = calculateEMA(candles.map(c => c.close), emaPeriod);

  return {
    middle: ema,
    upper: ema + (atr * multiplier),
    lower: ema - (atr * multiplier),
    atr
  };
}

// ============================================================================
// 5. EMA (EXPONENTIAL MOVING AVERAGE)
// ============================================================================

/**
 * Calcula EMA (Exponential Moving Average)
 * 
 * @param prices - Array de preços
 * @param period - Período
 * @returns Último valor da EMA
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const multiplier = 2 / (period + 1);
  
  // Primeiro EMA = SMA
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // EMAs subsequentes
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converter distância para pips (pares Forex)
 */
export function toPips(distance: number, decimals: number = 5): number {
  if (decimals === 5) return distance * 100000; // EURUSD, GBPUSD
  if (decimals === 3) return distance * 1000;   // USDJPY
  return distance * 10000; // Padrão 4 decimais
}

/**
 * Formatar ATR para display
 */
export function formatATR(atr: number, decimals: number = 5): string {
  return atr.toFixed(decimals);
}

/**
 * Verificar se trailing stop deve mover
 */
export function shouldMoveTrailingStop(
  currentStop: number,
  newStop: number,
  side: 'LONG' | 'SHORT'
): boolean {
  if (side === 'LONG') {
    // LONG: Só mover stop para CIMA (proteger lucro)
    return newStop > currentStop;
  } else {
    // SHORT: Só mover stop para BAIXO (proteger lucro)
    return newStop < currentStop;
  }
}
