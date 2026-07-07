export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out[i] = seed;
    } else if (i >= period) {
      prev = values[i] * k + (prev as number) * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function calculateSMA(candles: Candle[], period: number): (number | null)[] {
  return sma(candles.map(c => c.close), period);
}

export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  return ema(candles.map(c => c.close), period);
}

export function calculateRSI(candles: Candle[], period = 14): (number | null)[] {
  const closes = candles.map(c => c.close);
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const closes = candles.map(c => c.close);
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine: (number | null)[] = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  const firstValid = macdLine.findIndex(v => v !== null);
  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  if (firstValid !== -1) {
    const macdValues = macdLine.slice(firstValid).map(v => v as number);
    const signalEma = ema(macdValues, signalPeriod);
    signalEma.forEach((v, idx) => {
      signalLine[firstValid + idx] = v;
    });
  }

  const histogram: (number | null)[] = closes.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return m !== null && s !== null ? m - s : null;
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMultiplier = 2
): BollingerBandsResult {
  const closes = candles.map(c => c.close);
  const middle = sma(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
  }

  return { upper, middle, lower };
}

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export function calculateStochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): StochasticResult {
  const k: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window.map(c => c.high));
    const lowest = Math.min(...window.map(c => c.low));
    const close = candles[i].close;
    k[i] = highest === lowest ? 100 : ((close - lowest) / (highest - lowest)) * 100;
  }
  const firstValid = k.findIndex(v => v !== null);
  const d: (number | null)[] = new Array(candles.length).fill(null);
  if (firstValid !== -1) {
    const kValues = k.slice(firstValid).map(v => v as number);
    const dSma = sma(kValues, dPeriod);
    dSma.forEach((v, idx) => {
      d[firstValid + idx] = v;
    });
  }
  return { k, d };
}

export function calculateATR(candles: Candle[], period = 14): (number | null)[] {
  const trueRanges: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  const out: (number | null)[] = new Array(candles.length).fill(null);
  let prevAtr: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    if (i === period - 1) {
      const seed = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prevAtr = seed;
      out[i] = seed;
    } else if (i >= period) {
      prevAtr = ((prevAtr as number) * (period - 1) + trueRanges[i]) / period;
      out[i] = prevAtr;
    }
  }
  return out;
}

export function calculateADX(candles: Candle[], period = 14): (number | null)[] {
  const len = candles.length;
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);
  const tr: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
  }

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const dx: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const trv = smoothedTR[i];
    const pdm = smoothedPlusDM[i];
    const mdm = smoothedMinusDM[i];
    if (trv === null || pdm === null || mdm === null || trv === 0) continue;
    const plusDI = (pdm / trv) * 100;
    const minusDI = (mdm / trv) * 100;
    const sum = plusDI + minusDI;
    dx[i] = sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100;
  }

  const firstValid = dx.findIndex(v => v !== null);
  const out: (number | null)[] = new Array(len).fill(null);
  if (firstValid !== -1) {
    const dxValues = dx.slice(firstValid).map(v => v as number);
    const adxSmoothed = sma(dxValues, period);
    adxSmoothed.forEach((v, idx) => {
      out[firstValid + idx] = v;
    });
  }
  return out;
}

function wilderSmooth(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period) {
      const seed = values.slice(1, period + 1).reduce((a, b) => a + b, 0);
      prev = seed;
      out[i] = seed;
    } else if (i > period) {
      prev = (prev as number) - (prev as number) / period + values[i];
      out[i] = prev;
    }
  }
  return out;
}

export function calculateVWAP(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumPV += typicalPrice * candles[i].volume;
    cumVol += candles[i].volume;
    out[i] = cumVol === 0 ? null : cumPV / cumVol;
  }
  return out;
}

export function calculateOBV(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let obv = 0;
  out[0] = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    out[i] = obv;
  }
  return out;
}

export function calculateCCI(candles: Candle[], period = 20): (number | null)[] {
  const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const window = typicalPrices.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = window.reduce((sum, v) => sum + Math.abs(v - mean), 0) / period;
    out[i] = meanDeviation === 0 ? 0 : (typicalPrices[i] - mean) / (0.015 * meanDeviation);
  }
  return out;
}

export function calculateWilliamsR(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const highest = Math.max(...window.map(c => c.high));
    const lowest = Math.min(...window.map(c => c.low));
    const close = candles[i].close;
    out[i] = highest === lowest ? 0 : ((highest - close) / (highest - lowest)) * -100;
  }
  return out;
}

export function calculateSAR(
  candles: Candle[],
  accelerationStep = 0.02,
  accelerationMax = 0.2
): (number | null)[] {
  const len = candles.length;
  const out: (number | null)[] = new Array(len).fill(null);
  if (len < 2) return out;

  let isUpTrend = candles[1].close >= candles[0].close;
  let sar = isUpTrend ? candles[0].low : candles[0].high;
  let extremePoint = isUpTrend ? candles[0].high : candles[0].low;
  let acceleration = accelerationStep;
  out[0] = sar;

  for (let i = 1; i < len; i++) {
    let nextSar = sar + acceleration * (extremePoint - sar);

    if (isUpTrend) {
      nextSar = Math.min(nextSar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low);
      if (candles[i].low < nextSar) {
        isUpTrend = false;
        nextSar = extremePoint;
        extremePoint = candles[i].low;
        acceleration = accelerationStep;
      } else if (candles[i].high > extremePoint) {
        extremePoint = candles[i].high;
        acceleration = Math.min(acceleration + accelerationStep, accelerationMax);
      }
    } else {
      nextSar = Math.max(nextSar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high);
      if (candles[i].high > nextSar) {
        isUpTrend = true;
        nextSar = extremePoint;
        extremePoint = candles[i].high;
        acceleration = accelerationStep;
      } else if (candles[i].low < extremePoint) {
        extremePoint = candles[i].low;
        acceleration = Math.min(acceleration + accelerationStep, accelerationMax);
      }
    }

    sar = nextSar;
    out[i] = sar;
  }

  return out;
}

export type IndicatorSeriesMap = {
  SMA: (candles: Candle[], period: number) => (number | null)[];
  EMA: (candles: Candle[], period: number) => (number | null)[];
  RSI: (candles: Candle[], period: number) => (number | null)[];
  ATR: (candles: Candle[], period: number) => (number | null)[];
  ADX: (candles: Candle[], period: number) => (number | null)[];
  VWAP: (candles: Candle[]) => (number | null)[];
  OBV: (candles: Candle[]) => (number | null)[];
  CCI: (candles: Candle[], period: number) => (number | null)[];
  WILLIAMS: (candles: Candle[], period: number) => (number | null)[];
  SAR: (candles: Candle[]) => (number | null)[];
};
