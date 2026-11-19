/**
 * Scorecard de performance por ativo — realoca PRIORIDADE de ranking pro
 * ativo que está indo bem AGORA, sem nunca excluir nenhum. Ver desenho
 * completo em SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md.
 *
 * Motor puro (mesmo princípio do `runTradingCycle.ts` — "um motor, dois
 * lugares que o chamam"): usado pelo job periódico
 * (`supabase/functions/asset-performance-scorecard/`, que grava o resultado
 * em `asset_performance_scorecard`) e testável isoladamente. Portado do
 * protótipo validado em
 * research/experiments/2026-08-21-asset-scorecard/scorecard.ts (mesma
 * fórmula, mesmos parâmetros default).
 *
 * STATUS (2026-08-21): mecânica validada, efeito líquido ainda não —
 * proxy-backtest sobre 112 trades reais deu Δ ≈ -$0,02 (ruído) e só 2 de 12
 * ativos atingem hoje a amostra mínima de 12. Por isso `ASSET_SCORECARD_ACTIVE`
 * em `runTradingCycle.ts` está `false`: o job roda e grava dado real, mas o
 * motor de decisão IGNORA o multiplicador até uma validação futura (repetir
 * o proxy-backtest com mais dado acumulado) liberar. Não mude esse switch
 * sem repetir a validação — é a regra fixa do projeto contra prometer
 * melhora sem prova estatística.
 */

export interface ClosedTradeForScorecard {
  symbol: string;
  pnl: number;
  closedAt: string; // ISO
}

export interface AssetScorecardResult {
  symbol: string;
  n: number;
  avgPnl: number;
  stdDev: number;
  stdErr: number;
  lowerBound: number; // limite inferior do intervalo de confiança
  multiplier: number;
}

export interface AssetScorecardParams {
  minSample: number;
  zScore: number; // ex: 1.645 para IC 90% de um lado
  multiplierMin: number;
  multiplierMax: number;
  /** desvio-padrão (em unidades de lowerBound) que mapeia pro multiplicador máx/mín */
  scaleDenominator: number;
}

export const DEFAULT_SCORECARD_PARAMS: AssetScorecardParams = {
  minSample: 12,
  zScore: 1.645,
  multiplierMin: 0.6,
  multiplierMax: 1.5,
  scaleDenominator: 5,
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], avg: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((acc, x) => acc + (x - avg) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calcula o scorecard de um símbolo a partir da janela de trades fechados
 * (já filtrada/ordenada por quem chama, mais recentes por último). Abaixo de
 * `minSample`, multiplicador é sempre 1.0 (neutro) — trava contra ruído, sem
 * exceção (mesmo princípio de "amostra pequena não vira sinal" do item 6 do
 * CLAUDE.md sobre o `confidence` heurístico).
 */
export function computeSymbolScorecard(
  symbol: string,
  trades: ClosedTradeForScorecard[],
  params: AssetScorecardParams = DEFAULT_SCORECARD_PARAMS,
): AssetScorecardResult {
  const n = trades.length;
  const pnls = trades.map((t) => t.pnl);
  const avgPnl = n > 0 ? mean(pnls) : 0;
  const sd = stdDev(pnls, avgPnl);
  const stdErr = n > 0 ? sd / Math.sqrt(n) : 0;
  const lowerBound = avgPnl - params.zScore * stdErr;

  if (n < params.minSample) {
    return { symbol, n, avgPnl, stdDev: sd, stdErr, lowerBound, multiplier: 1.0 };
  }

  // Mapeia lowerBound (em unidades de PnL) pro multiplicador via tanh,
  // saturando suavemente nos limites [multiplierMin, multiplierMax] em vez
  // de clamp abrupto.
  const normalized = lowerBound / params.scaleDenominator; // adimensional
  const shape = Math.tanh(normalized); // [-1, 1]
  const mid = (params.multiplierMax + params.multiplierMin) / 2;
  const halfRange = (params.multiplierMax - params.multiplierMin) / 2;
  const multiplier = mid + shape * halfRange;

  return { symbol, n, avgPnl, stdDev: sd, stdErr, lowerBound, multiplier };
}

/**
 * Aplica a janela rolante por contagem (últimos `windowSize` trades fechados
 * de cada símbolo, cronológico) e calcula o scorecard "hoje" de toda a
 * cesta recebida.
 */
export function computeScorecardSnapshot(
  allTrades: ClosedTradeForScorecard[],
  windowSize: number,
  params: AssetScorecardParams = DEFAULT_SCORECARD_PARAMS,
): AssetScorecardResult[] {
  const bySymbol = new Map<string, ClosedTradeForScorecard[]>();
  for (const t of allTrades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }

  const results: AssetScorecardResult[] = [];
  for (const [symbol, trades] of bySymbol) {
    const sorted = [...trades].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
    const window = sorted.slice(-windowSize);
    results.push(computeSymbolScorecard(symbol, window, params));
  }
  return results.sort((a, b) => b.multiplier - a.multiplier);
}
