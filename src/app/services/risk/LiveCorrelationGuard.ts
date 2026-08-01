/**
 * Guard de correlação ao vivo — Componente 3 do cérebro de execução
 * (`research/RISK_MODULE_SPEC.md` seção 3.5, `CLAUDE.md` pendência #5).
 *
 * Substitui/complementa a heurística estática por grupo (`getCorrelationGroup`
 * em `useApexLogic.ts`, ex: "todo par com USD é correlacionado") por
 * correlação de Pearson REAL, calculada sobre log-returns de candle real do
 * mesmo `backtestDataService` já usado por `TradeEfficiencyDiagnostic.ts` e
 * pelo Replay/Backtest — nunca uma fonte de dado nova.
 *
 * Decisão de design (documentada aqui, não escondida): o guard heurístico
 * antigo (`aiConfig.correlationGuardEnabled` + `getCorrelationGroup`) É
 * MANTIDO como fallback, não removido. Motivo: correlação real depende de
 * rede (busca de candle) e de haver histórico suficiente — se a busca falhar
 * ou não houver barras suficientes para um par, este módulo RECUSA calcular
 * (nunca estima), e nesse caso é melhor cair de volta pro grupo estático
 * (aproximado, mas sempre disponível) do que operar sem nenhum guard de
 * correlação. Ver ponto de integração em `useApexLogic.ts`.
 */
import { backtestDataService, type Timeframe } from '../BacktestDataService';

export interface CorrelationGuardConfig {
  /** Limiar absoluto de correlação acima do qual a nova entrada é bloqueada. Reaproveita aiConfig.correlationThreshold por padrão. */
  thresholdAbs: number;
  /** Barras mínimas de retorno (N-1 candles vira N-2 retornos) exigidas para aceitar o par como calculável — abaixo disso, recusa. */
  minBars: number;
}

export const DEFAULT_CORRELATION_GUARD_CONFIG: CorrelationGuardConfig = {
  thresholdAbs: 0.7,
  minBars: 30,
};

export interface OpenPositionLike {
  symbol: string;
}

export interface LiveCorrelationGuardResult {
  blocked: boolean;
  reason?: string;
  /** Correlação candidato x cada posição aberta calculável, chave = símbolo da posição aberta. */
  pairwiseCorrelations: Record<string, number>;
  /** Pares que não puderam ser calculados (histórico insuficiente) — nunca estimados, só declarados. */
  insufficientData: string[];
}

/**
 * Log-returns de uma série de fechamentos. Requer pelo menos 2 pontos.
 */
export function computeLogReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

/**
 * Correlação de Pearson entre duas séries de retornos. `null` quando as
 * séries não têm o mesmo tamanho (dado desalinhado — não tenta realinhar
 * silenciosamente) ou quando a variância de alguma série é zero (correlação
 * indefinida, não zero — nunca fabrica um número aqui).
 */
export function computePearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length === 0 || a.length !== b.length) return null;

  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  if (varA === 0 || varB === 0) return null;

  return cov / Math.sqrt(varA * varB);
}

/**
 * Função pura testável — Componente 3 do cérebro de execução. Não busca
 * dado, só decide a partir de séries de fechamento já buscadas (candle
 * real ou nenhum dado, nunca sintético — quem chama garante a origem).
 *
 * Recusa (não aprova nem bloqueia silenciosamente) quando um par não tem
 * histórico suficiente para calcular correlação real — registra em
 * `insufficientData`. O fallback heurístico por grupo é decisão de quem
 * chama (`useApexLogic.ts`), não deste módulo.
 */
export function computeLiveCorrelationGuard(
  candidateSymbol: string,
  openPositions: OpenPositionLike[],
  priceHistoryBySymbol: Record<string, number[]>,
  config: CorrelationGuardConfig = DEFAULT_CORRELATION_GUARD_CONFIG,
): LiveCorrelationGuardResult {
  const pairwiseCorrelations: Record<string, number> = {};
  const insufficientData: string[] = [];

  const candidateCloses = priceHistoryBySymbol[candidateSymbol];
  const candidateReturns = candidateCloses ? computeLogReturns(candidateCloses) : [];

  const openSymbols = Array.from(new Set(openPositions.map(p => p.symbol).filter(s => s !== candidateSymbol)));

  if (candidateReturns.length < config.minBars) {
    // Sem histórico do próprio candidato — nenhum par é calculável, recusa geral.
    for (const sym of openSymbols) insufficientData.push(sym);
    return {
      blocked: false,
      reason: `Histórico insuficiente para ${candidateSymbol} (${candidateReturns.length} retornos, mínimo ${config.minBars}) — correlação real não pôde ser calculada`,
      pairwiseCorrelations,
      insufficientData,
    };
  }

  let maxAbsCorrelation = 0;
  let maxAbsCorrelationSymbol: string | null = null;

  for (const sym of openSymbols) {
    const closes = priceHistoryBySymbol[sym];
    const returns = closes ? computeLogReturns(closes) : [];

    if (returns.length < config.minBars) {
      insufficientData.push(sym);
      continue;
    }

    // Alinha pelo tamanho comum mais recente (séries podem ter comprimentos
    // diferentes se os candles foram buscados em momentos distintos).
    const len = Math.min(returns.length, candidateReturns.length);
    const a = candidateReturns.slice(candidateReturns.length - len);
    const b = returns.slice(returns.length - len);

    const correlation = computePearsonCorrelation(a, b);
    if (correlation === null) {
      insufficientData.push(sym);
      continue;
    }

    pairwiseCorrelations[sym] = correlation;
    if (Math.abs(correlation) > maxAbsCorrelation) {
      maxAbsCorrelation = Math.abs(correlation);
      maxAbsCorrelationSymbol = sym;
    }
  }

  if (maxAbsCorrelationSymbol && maxAbsCorrelation > config.thresholdAbs) {
    return {
      blocked: true,
      reason: `Correlação real de ${maxAbsCorrelation.toFixed(2)} entre ${candidateSymbol} e posição aberta em ${maxAbsCorrelationSymbol} (limiar ${config.thresholdAbs})`,
      pairwiseCorrelations,
      insufficientData,
    };
  }

  return {
    blocked: false,
    pairwiseCorrelations,
    insufficientData,
  };
}

/**
 * Busca closes reais recentes de uma lista de símbolos via `backtestDataService`
 * (mesma fonte de `TradeEfficiencyDiagnostic.ts`), sequencialmente por
 * disciplina de rate-limit já documentada no projeto (conta MetaAPI
 * compartilhada). Símbolo sem candle real disponível fica de fora do
 * resultado (não lança pro lote inteiro) — quem chama detecta a ausência via
 * `insufficientData` do guard puro acima.
 */
export async function fetchRecentClosesForCorrelation(
  symbols: string[],
  timeframe: Timeframe = '1h',
  lookbackBars = 60,
): Promise<Record<string, number[]>> {
  const barMs: Record<Timeframe, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
  };
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - lookbackBars * barMs[timeframe]);

  const result: Record<string, number[]> = {};
  for (const symbol of symbols) {
    try {
      const { candles } = await backtestDataService.fetchHistoricalData(symbol, startDate, endDate, timeframe);
      result[symbol] = candles.map(c => c.close);
    } catch (err) {
      console.warn(`[LiveCorrelationGuard] ⚠️ Sem candle real para ${symbol}, excluído do cálculo de correlação:`, err);
    }
  }
  return result;
}
