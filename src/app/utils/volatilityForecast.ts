/**
 * Previsão de Volatilidade (EWMA) — funcionalidade #1 do roadmap da aba
 * "Inteligência de Mercado" (veredito do llm-council, 2026-09-09).
 *
 * O QUE ISTO PREVÊ: amplitude esperada de movimento (volatilidade), NUNCA
 * direção de preço. Isto é a única frente de ML/estatística que o projeto
 * já aprovou (ver CLAUDE.md, "Cérebro de decisão da IA" — busca por edge
 * de sinal técnico clássico não encontrou edge de direção comprovado; ML
 * entra só em previsão de volatilidade).
 *
 * MÉTODO: EWMA (Exponentially Weighted Moving Average) de variância sobre
 * retornos logarítmicos reais — mesmo método usado pelo RiskMetrics da
 * J.P. Morgan (lambda=0.94 padrão pra dado diário/intraday). Não é GARCH
 * completo (exigiria otimização numérica de máxima verossimilhança, fora
 * de escopo do MVP) — é o baseline honesto, documentado como tal.
 *
 * Classificação de regime (BAIXA/NORMAL/ALTA/EXTREMA) é por PERCENTIL da
 * própria distribuição histórica do ativo (janela real, sem número mágico
 * cravado) — evita "threshold universal" que funciona bem num ativo e mal
 * noutro. O percentil de corte é configurável pelo usuário DENTRO de uma
 * faixa travada (70-95), nunca livre — decisão do conselho pra evitar que
 * o usuário recalibre até achar o número que "parece funcionar" numa
 * amostra pequena (p-hacking pelo front-end).
 */

export interface CandleLike {
  time: number; // epoch ms
  close: number;
}

export interface VolatilityPoint {
  time: number;
  ewmaVol: number; // desvio padrão EWMA do retorno log, por barra (não anualizado)
}

export type VolatilityRegime = 'BAIXA' | 'NORMAL' | 'ALTA' | 'EXTREMA';

export interface VolatilityForecastResult {
  series: VolatilityPoint[];
  currentVol: number;
  percentileOfCurrent: number; // 0-100, posição do vol atual na distribuição histórica
  regime: VolatilityRegime;
  sampleSize: number;
}

export const VOLATILITY_PERCENTILE_MIN = 70;
export const VOLATILITY_PERCENTILE_MAX = 95;
export const VOLATILITY_PERCENTILE_DEFAULT = 85;

const EWMA_LAMBDA = 0.94; // padrão RiskMetrics pra dado intraday/diário
const MIN_CANDLES_FOR_FORECAST = 60; // amostra mínima pra a distribuição de percentil fazer sentido

export class VolatilityForecastInsufficientDataError extends Error {
  constructor(symbol: string, got: number) {
    super(`Candles insuficientes pra previsão de volatilidade de ${symbol} (${got}/${MIN_CANDLES_FOR_FORECAST} mínimo) — sem cálculo fabricado.`);
    this.name = 'VolatilityForecastInsufficientDataError';
  }
}

/**
 * Calcula a série de volatilidade EWMA a partir de candles reais.
 * Lança erro explícito se não houver amostra suficiente — nunca preenche
 * com valor inventado.
 */
export function computeVolatilityForecast(
  candles: CandleLike[],
  symbol: string,
  percentileThreshold: number = VOLATILITY_PERCENTILE_DEFAULT,
): VolatilityForecastResult {
  if (candles.length < MIN_CANDLES_FOR_FORECAST) {
    throw new VolatilityForecastInsufficientDataError(symbol, candles.length);
  }

  const clampedThreshold = Math.min(
    VOLATILITY_PERCENTILE_MAX,
    Math.max(VOLATILITY_PERCENTILE_MIN, percentileThreshold),
  );

  const sorted = [...candles].sort((a, b) => a.time - b.time);

  const logReturns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevClose = sorted[i - 1].close;
    const close = sorted[i].close;
    if (prevClose > 0 && close > 0) {
      logReturns.push(Math.log(close / prevClose));
    } else {
      logReturns.push(0);
    }
  }

  // EWMA de variância: sigma_t^2 = lambda * sigma_{t-1}^2 + (1-lambda) * r_{t-1}^2
  // Inicializa com a variância amostral simples dos primeiros retornos.
  const warmupSize = Math.min(20, logReturns.length);
  const warmupMean = logReturns.slice(0, warmupSize).reduce((s, r) => s + r, 0) / warmupSize;
  let variance = logReturns
    .slice(0, warmupSize)
    .reduce((s, r) => s + (r - warmupMean) ** 2, 0) / Math.max(1, warmupSize - 1);

  const series: VolatilityPoint[] = [];
  for (let i = 0; i < logReturns.length; i++) {
    if (i > 0) {
      variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * logReturns[i - 1] ** 2;
    }
    series.push({
      time: sorted[i + 1].time,
      ewmaVol: Math.sqrt(Math.max(0, variance)),
    });
  }

  const currentVol = series[series.length - 1]?.ewmaVol ?? 0;

  const volValues = series.map((p) => p.ewmaVol).sort((a, b) => a - b);
  const countBelow = volValues.filter((v) => v <= currentVol).length;
  const percentileOfCurrent = (countBelow / volValues.length) * 100;

  let regime: VolatilityRegime;
  if (percentileOfCurrent >= clampedThreshold + 5) {
    regime = 'EXTREMA';
  } else if (percentileOfCurrent >= clampedThreshold) {
    regime = 'ALTA';
  } else if (percentileOfCurrent <= 100 - clampedThreshold) {
    regime = 'BAIXA';
  } else {
    regime = 'NORMAL';
  }

  return {
    series,
    currentVol,
    percentileOfCurrent,
    regime,
    sampleSize: series.length,
  };
}

export const VOLATILITY_REGIME_LABEL: Record<VolatilityRegime, string> = {
  BAIXA: 'Volatilidade Baixa',
  NORMAL: 'Volatilidade Normal',
  ALTA: 'Volatilidade Alta',
  EXTREMA: 'Volatilidade Extrema',
};

export const VOLATILITY_REGIME_COLOR: Record<VolatilityRegime, string> = {
  BAIXA: '#3b82f6',
  NORMAL: '#22c55e',
  ALTA: '#f59e0b',
  EXTREMA: '#ef4444',
};
