/**
 * Repetição do proxy-backtest do scorecard (2026-08-26), com dado real
 * atualizado — ver SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md,
 * "Próximo passo real" (esperar mais amostra e repetir). Reaproveita as
 * funções puras de scorecard.ts, só troca a fonte de dado.
 *
 * Uso: npx tsx rerun_2026-08-26.ts
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  computeScorecardSnapshot,
  walkForwardMultiplierSeries,
  DEFAULT_PARAMS,
  type ClosedTrade,
  type ScorecardParams,
} from './scorecard';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data: ClosedTrade[] = JSON.parse(readFileSync(join(__dirname, 'real_trades_2026-08-26.json'), 'utf-8'));

function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stdDev(xs: number[], avg: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - avg) ** 2, 0) / (xs.length - 1));
}

console.log(`Total de trades no dataset: ${data.length}`);

console.log('\n=== Snapshot atual (janela=12, MIN_AMOSTRA=12) ===');
const snap12 = computeScorecardSnapshot(data, 12, { ...DEFAULT_PARAMS, minSample: 12 });
console.table(snap12.map((r) => ({ symbol: r.symbol, n: r.n, avgPnl: r.avgPnl.toFixed(4), lowerBound: r.lowerBound.toFixed(4), multiplier: r.multiplier.toFixed(3) })));

console.log('\n=== Quantos símbolos batem MIN_AMOSTRA=20 hoje? ===');
const snap20 = computeScorecardSnapshot(data, 20, { ...DEFAULT_PARAMS, minSample: 20 });
console.table(snap20.map((r) => ({ symbol: r.symbol, n: r.n, qualifica: r.n >= 20 ? 'SIM' : 'não' })));

const qualified = data.filter((t) => data.filter((x) => x.symbol === t.symbol).length >= 12);
const qualifiedPnls = qualified.map((t) => t.pnl);
const dataAvg = mean(qualifiedPnls);
const dataDrivenDenominator = stdDev(qualifiedPnls, dataAvg);
console.log(`\nstddev pooled (símbolos com n>=12, ${qualifiedPnls.length} trades): ${dataDrivenDenominator.toFixed(4)}`);

const proxyParams: ScorecardParams = { ...DEFAULT_PARAMS, minSample: 12, scaleDenominator: dataDrivenDenominator };

console.log('\n=== Proxy-backtest: PnL agregado real vs. escalado (out-of-sample, walk-forward) ===');
const bySymbol = new Map<string, ClosedTrade[]>();
for (const t of data) { if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []); bySymbol.get(t.symbol)!.push(t); }

let actualTotal = 0, scaledTotal = 0;
const actualPnls: number[] = [], scaledPnls: number[] = [];
const rows: Record<string, unknown>[] = [];
for (const [symbol, trades] of bySymbol) {
  const wf = walkForwardMultiplierSeries(trades, 12, proxyParams);
  const symActual = wf.reduce((a, r) => a + r.pnl, 0);
  const symScaled = wf.reduce((a, r) => a + r.pnl * r.multiplierAtEntry, 0);
  actualTotal += symActual; scaledTotal += symScaled;
  for (const r of wf) { actualPnls.push(r.pnl); scaledPnls.push(r.pnl * r.multiplierAtEntry); }
  rows.push({ symbol, n: trades.length, pnlReal: symActual.toFixed(3), pnlEscalado: symScaled.toFixed(3), diferenca: (symScaled - symActual).toFixed(3) });
}
console.table(rows);

const actualAvg = mean(actualPnls), scaledAvg = mean(scaledPnls);
const actualSd = stdDev(actualPnls, actualAvg), scaledSd = stdDev(scaledPnls, scaledAvg);
console.log(`\nTotais agregados (${actualPnls.length} trades):`);
console.table([
  { cenario: 'Real (sem scorecard)', pnlTotal: actualTotal.toFixed(3), pnlMedio: actualAvg.toFixed(4), stdDev: actualSd.toFixed(4) },
  { cenario: 'Escalado (com scorecard)', pnlTotal: scaledTotal.toFixed(3), pnlMedio: scaledAvg.toFixed(4), stdDev: scaledSd.toFixed(4) },
]);
console.log(`\nΔ PnL total: ${(scaledTotal - actualTotal).toFixed(3)} | Δ stddev/trade: ${(scaledSd - actualSd).toFixed(4)} (${(((scaledSd - actualSd) / actualSd) * 100).toFixed(1)}%)`);
