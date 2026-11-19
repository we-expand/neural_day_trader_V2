/**
 * Protótipo do cálculo do scorecard de performance por ativo — função pura,
 * sem nenhuma integração com o motor. Ver
 * SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md pro desenho.
 *
 * Uso: npx tsx scorecard.ts
 */

interface ClosedTrade {
  symbol: string;
  pnl: number;
  closedAt: string; // ISO
}

interface ScorecardResult {
  symbol: string;
  n: number;
  avgPnl: number;
  stdDev: number;
  stdErr: number;
  lowerBound: number; // limite inferior do IC a (1-alpha)
  multiplier: number;
}

interface ScorecardParams {
  minSample: number;
  zScore: number; // ex: 1.645 para IC 90% de um lado
  multiplierMin: number;
  multiplierMax: number;
  /** desvio-padrão (em unidades de lowerBound) que mapeia pro multiplicador máx/mín */
  scaleDenominator: number;
}

const DEFAULT_PARAMS: ScorecardParams = {
  minSample: 12,
  zScore: 1.645,
  multiplierMin: 0.6,
  multiplierMax: 1.5,
  scaleDenominator: 5, // achado empiricamente abaixo, ver saída do script
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
 * (já filtrada/ordenada por quem chama). Abaixo de minSample, multiplicador
 * é sempre 1.0 (neutro) — sem exceção, essa é a trava contra ruído.
 */
function computeSymbolScorecard(
  symbol: string,
  trades: ClosedTrade[],
  params: ScorecardParams = DEFAULT_PARAMS,
): ScorecardResult {
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
 * Aplica a janela rolante por contagem (últimos windowSize trades fechados,
 * cronológico) e calcula o scorecard resultante — visão "hoje" (usa toda a
 * janela mais recente disponível).
 */
function computeScorecardSnapshot(
  allTrades: ClosedTrade[],
  windowSize: number,
  params: ScorecardParams = DEFAULT_PARAMS,
): ScorecardResult[] {
  const bySymbol = new Map<string, ClosedTrade[]>();
  for (const t of allTrades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }

  const results: ScorecardResult[] = [];
  for (const [symbol, trades] of bySymbol) {
    const sorted = [...trades].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
    const window = sorted.slice(-windowSize);
    results.push(computeSymbolScorecard(symbol, window, params));
  }
  return results.sort((a, b) => b.multiplier - a.multiplier);
}

/**
 * Walk-forward puro (out-of-sample): pra cada trade N de um símbolo, calcula
 * o multiplicador que TERIA sido usado a partir só dos N-1 trades anteriores
 * (nunca olha o próprio resultado do trade). Serve pra ver a série temporal
 * do multiplicador — não é um backtest de PnL contrafactual (isso exigiria
 * dado de candidatos rejeitados por ciclo, que ai_trades não tem — só trades
 * executados existem na tabela).
 */
function walkForwardMultiplierSeries(
  symbolTrades: ClosedTrade[],
  windowSize: number,
  params: ScorecardParams = DEFAULT_PARAMS,
): { closedAt: string; pnl: number; multiplierAtEntry: number; nAtEntry: number }[] {
  const sorted = [...symbolTrades].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const out: { closedAt: string; pnl: number; multiplierAtEntry: number; nAtEntry: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const priorWindow = sorted.slice(Math.max(0, i - windowSize), i);
    const sc = computeSymbolScorecard(sorted[i].symbol, priorWindow, params);
    out.push({
      closedAt: sorted[i].closedAt,
      pnl: sorted[i].pnl,
      multiplierAtEntry: sc.multiplier,
      nAtEntry: priorWindow.length,
    });
  }
  return out;
}

export { computeSymbolScorecard, computeScorecardSnapshot, walkForwardMultiplierSeries, DEFAULT_PARAMS };
export type { ClosedTrade, ScorecardResult, ScorecardParams };

// ---------------------------------------------------------------------------
// Execução direta contra o dado real puxado do Supabase em 2026-08-21
// (ai_trades, status=CLOSED, pnl not null, updated_at >= 2026-08-03 —
// exclui SPX500/BTCUSDT/ETHUSDT de julho por bug de escala confirmado nesta
// sessão: ver SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md)
// ---------------------------------------------------------------------------
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isMain = process.argv[1] === __filename;

if (isMain) {
  const data: ClosedTrade[] = JSON.parse(
    readFileSync(join(__dirname, 'real_trades_2026-08-21.json'), 'utf-8'),
  );

  console.log('=== Snapshot atual (janela = 12 trades, MIN_AMOSTRA = 12) ===');
  const snap = computeScorecardSnapshot(data, 12, { ...DEFAULT_PARAMS, minSample: 12 });
  console.table(
    snap.map((r) => ({
      symbol: r.symbol,
      n: r.n,
      avgPnl: r.avgPnl.toFixed(4),
      stdDev: r.stdDev.toFixed(4),
      lowerBound: r.lowerBound.toFixed(4),
      multiplier: r.multiplier.toFixed(3),
    })),
  );

  console.log('\n=== Mesmo snapshot com MIN_AMOSTRA = 20 (proposta original do plano) ===');
  const snap20 = computeScorecardSnapshot(data, 20, { ...DEFAULT_PARAMS, minSample: 20 });
  console.table(
    snap20.map((r) => ({
      symbol: r.symbol,
      n: r.n,
      multiplier: r.multiplier.toFixed(3),
      neutro: r.n < 20 ? 'SIM (amostra insuficiente)' : 'não',
    })),
  );

  console.log('\n=== Sensibilidade do scaleDenominator (janela=12, minSample=12) ===');
  // Candidatos: valores fixos arbitrários vs. um valor derivado do próprio
  // dado (desvio-padrão do PnL agregado de todos os trades qualificados,
  // n>=minSample — dá ao denominador a mesma escala do ruído real do motor
  // em vez de um chute).
  const qualified = data.filter((t) => {
    const symCount = data.filter((x) => x.symbol === t.symbol).length;
    return symCount >= 12;
  });
  const qualifiedPnls = qualified.map((t) => t.pnl);
  const dataAvg = mean(qualifiedPnls);
  const dataDrivenDenominator = stdDev(qualifiedPnls, dataAvg);

  const candidates = [1, 2, 3, 5, 8, Number(dataDrivenDenominator.toFixed(3))];
  const rows: Record<string, unknown>[] = [];
  for (const denom of candidates) {
    const snapD = computeScorecardSnapshot(data, 12, {
      ...DEFAULT_PARAMS,
      minSample: 12,
      scaleDenominator: denom,
    }).filter((r) => r.n >= 12);
    const row: Record<string, unknown> = {
      scaleDenominator: denom === dataDrivenDenominator ? `${denom} (dado: stddev pooled)` : denom,
    };
    for (const r of snapD) row[r.symbol] = r.multiplier.toFixed(3);
    rows.push(row);
  }
  console.table(rows);
  console.log(
    `\nstddev agregado do PnL (pooled, símbolos com n>=12, n=${qualifiedPnls.length} trades): ${dataDrivenDenominator.toFixed(4)}`,
  );

  console.log('\n=== Walk-forward XAUUSD (série temporal do multiplicador out-of-sample) ===');
  const xau = data.filter((t) => t.symbol === 'XAUUSD');
  const wf = walkForwardMultiplierSeries(xau, 12);
  console.table(
    wf.map((r) => ({
      closedAt: r.closedAt,
      pnl: r.pnl.toFixed(3),
      nAtEntry: r.nAtEntry,
      multiplierAtEntry: r.multiplierAtEntry.toFixed(3),
    })),
  );

  // -------------------------------------------------------------------------
  // "Backtest" — na verdade um PROXY, não o contrafactual completo do plano.
  // ai_trades só tem trades EXECUTADOS, não os candidatos descartados em cada
  // ciclo — não dá pra saber se, sem o scorecard, um candidato diferente
  // teria sido escolhido (isso exigiria replay do runTradingCycle contra
  // preço histórico, que não existe hoje). O que dá pra medir honestamente:
  // aplicar o multiplicador walk-forward (out-of-sample) como escala de
  // TAMANHO sobre o PnL de cada trade que de fato aconteceu, e comparar
  // agregado/variância com vs. sem. Não valida a integração final (que
  // reordena candidatos, não redimensiona posição) — só testa se a direção
  // do sinal (symbol indo mal → menos peso) teria ajudado nos trades que já
  // rolaram.
  // -------------------------------------------------------------------------
  console.log('\n=== Proxy-backtest: PnL agregado real vs. escalado pelo multiplicador (out-of-sample) ===');
  const bySymbolProxy = new Map<string, ClosedTrade[]>();
  for (const t of data) {
    if (!bySymbolProxy.has(t.symbol)) bySymbolProxy.set(t.symbol, []);
    bySymbolProxy.get(t.symbol)!.push(t);
  }

  const proxyParams: ScorecardParams = {
    ...DEFAULT_PARAMS,
    minSample: 12,
    scaleDenominator: dataDrivenDenominator,
  };

  let actualTotal = 0;
  let scaledTotal = 0;
  const actualPnls: number[] = [];
  const scaledPnls: number[] = [];
  const perSymbolRows: Record<string, unknown>[] = [];

  for (const [symbol, trades] of bySymbolProxy) {
    const wfSeries = walkForwardMultiplierSeries(trades, 12, proxyParams);
    const symActual = wfSeries.reduce((a, r) => a + r.pnl, 0);
    const symScaled = wfSeries.reduce((a, r) => a + r.pnl * r.multiplierAtEntry, 0);
    actualTotal += symActual;
    scaledTotal += symScaled;
    for (const r of wfSeries) {
      actualPnls.push(r.pnl);
      scaledPnls.push(r.pnl * r.multiplierAtEntry);
    }
    perSymbolRows.push({
      symbol,
      n: trades.length,
      pnlReal: symActual.toFixed(3),
      pnlEscalado: symScaled.toFixed(3),
      diferenca: (symScaled - symActual).toFixed(3),
    });
  }

  console.table(perSymbolRows);

  const actualAvg = mean(actualPnls);
  const scaledAvg = mean(scaledPnls);
  const actualSd = stdDev(actualPnls, actualAvg);
  const scaledSd = stdDev(scaledPnls, scaledAvg);

  console.log(`\nTotais agregados (todos os símbolos, ${actualPnls.length} trades):`);
  console.table([
    {
      cenario: 'Real (sem scorecard)',
      pnlTotal: actualTotal.toFixed(3),
      pnlMedioPorTrade: actualAvg.toFixed(4),
      stdDevPorTrade: actualSd.toFixed(4),
    },
    {
      cenario: 'Escalado (com scorecard, proxy de tamanho)',
      pnlTotal: scaledTotal.toFixed(3),
      pnlMedioPorTrade: scaledAvg.toFixed(4),
      stdDevPorTrade: scaledSd.toFixed(4),
    },
  ]);
  console.log(
    `\nΔ PnL total: ${(scaledTotal - actualTotal).toFixed(3)} | Δ stddev por trade: ${(scaledSd - actualSd).toFixed(4)}`,
  );
}
