/**
 * Opção "reformular a função objetivo" da pendência #1 (seções 11.12→11.14):
 * em vez de trocar instrumento/timeframe de novo, muda o CRITÉRIO DE SUCESSO.
 * Toda a investigação até aqui (11.5→11.14) mediu Sharpe — que penaliza
 * variância de GANHO igual a variância de PERDA. A seção 1 do
 * AI_BRAIN_SPEC.md já declara o objetivo formal como "Sharpe/Sortino da curva
 * de capital sujeito a restrição de sobrevivência" — nunca medimos Sortino de
 * fato. Isso importa especialmente pro Donchian (melhor resultado da
 * investigação, seção 11.13: DSR 52% em cripto 4h) — é trend-following por
 * desenho: muitas perdas pequenas capadas por stop, raros ganhos grandes de
 * tendência. Essa assimetria positiva é exatamente o que Sharpe pune e
 * Sortino não.
 *
 * Mesma disciplina de sempre: ZERO ajuste de parâmetro no Donchian, mesma
 * cesta de 7 pares cripto (Binance público), mesmos 3 timeframes já testados
 * (4h — 11.13, 1d e 1w — 11.14) — só recalcula a métrica sobre o mesmo tipo
 * de trade, não escolhe entre configurações novas.
 *
 * Duas medidas de significância, uma mais forte que a outra:
 * 1. Deflated Sortino (aproximação heurística, ver aviso em DeflatedSharpe.ts
 *    — a derivação formal do DSR é pro Sharpe, não pro Sortino).
 * 2. Bootstrap empírico (reamostragem determinística, sem assumir forma de
 *    distribuição) — mais robusto, é o que decide de fato.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-26-sortino-objective/donchian-sortino.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/donchian-sortino.mjs && node /tmp/donchian-sortino.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import {
  sharpeRatio,
  sortinoRatio,
  expectedMaxSharpeUnderNull,
  deflatedSortinoRatio,
  bootstrapSortinoSignificance,
} from '../../DeflatedSharpe';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBinancePaginated(symbol: string, interval: string, pages: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (let p = 0; p < pages; p++) {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
    if (!res.ok) break;
    const raw: any[] = await res.json();
    if (raw.length === 0) break;
    const page: Candle[] = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    all.unshift(...page);
    endTime = page[0].time - 1;
    if (raw.length < 1000) break;
    await sleep(150);
  }
  return all;
}

function threeWindows(candles: Candle[]): Array<{ train: Candle[]; holdout: Candle[] }> {
  const chunk = Math.floor(candles.length / 3);
  const windows: Array<{ train: Candle[]; holdout: Candle[] }> = [];
  for (let w = 0; w < 3; w++) {
    const slice = candles.slice(w * chunk, w === 2 ? candles.length : (w + 1) * chunk);
    const splitAt = Math.floor(slice.length * 0.7);
    windows.push({ train: slice.slice(0, splitAt), holdout: slice.slice(Math.max(0, splitAt - 20)) });
  }
  return windows;
}

function netTradeReturns(candles: Candle[], strategy: Strategy, symbol: string): number[] {
  const pointValue = getPointValue(symbol);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;
  const res = runBacktest(candles, strategy, symbol, 'both', 10000, roundTripCostPct);
  return res.trades.map(t => t.profitPercent);
}

async function evaluateTimeframe(strategy: Strategy, timeframe: string, pages: number) {
  console.log(`\n═══ Donchian (produção, zero ajuste) em ${timeframe} — Sortino pooled sobre ${SYMBOLS.length} pares cripto ═══\n`);

  const perSymbol: Array<{ symbol: string; holdoutReturns: number[] }> = [];
  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`  buscando ${symbol} ${timeframe}... `);
    const candles = await fetchBinancePaginated(symbol, timeframe, pages);
    console.log(`${candles.length} candles`);
    const windows = threeWindows(candles);
    const holdoutReturns = windows.flatMap(w => netTradeReturns(w.holdout, strategy, symbol));
    perSymbol.push({ symbol, holdoutReturns });
    if (i < SYMBOLS.length - 1) await sleep(500);
  }

  console.log('\n  ── Por ativo: Sharpe vs. Sortino (diagnóstico) ──');
  for (const r of perSymbol) {
    const sh = sharpeRatio(r.holdoutReturns);
    const so = sortinoRatio(r.holdoutReturns);
    console.log(`  ${r.symbol.padEnd(9)} n=${String(r.holdoutReturns.length).padEnd(4)} Sharpe=${sh.toFixed(3).padStart(7)}  Sortino=${isFinite(so) ? so.toFixed(3).padStart(7) : '∞ (sem downside)'}`);
  }

  const pooledHoldout = perSymbol.flatMap(r => r.holdoutReturns);
  const pooledSharpe = sharpeRatio(pooledHoldout);
  const pooledSortino = sortinoRatio(pooledHoldout);
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dSortino = deflatedSortinoRatio(pooledSortino, sr0, pooledHoldout.length);
  const bootstrap = bootstrapSortinoSignificance(pooledHoldout);

  console.log(`\n  ── Pooled (n=${pooledHoldout.length}) ──`);
  console.log(`  Sharpe pooled (referência, já medido em 11.13/11.14): ${pooledSharpe.toFixed(3)}`);
  console.log(`  Sortino pooled: ${isFinite(pooledSortino) ? pooledSortino.toFixed(3) : '∞ (sem trade de downside)'}`);
  console.log(`  Deflated Sortino (heurístico, ver aviso): ${(dSortino * 100).toFixed(1)}%`);
  console.log(`  Bootstrap (2000 reamostras): P(Sortino real > 0) = ${(bootstrap.probPositive * 100).toFixed(1)}%`);
  if (pooledHoldout.length < 100) {
    console.log(`  ⚠️ n=${pooledHoldout.length} < 100 — abaixo da amostra mínima da seção 8, resultado inconclusivo por desenho independente da métrica.`);
  }

  return { timeframe, pooledSharpe, pooledSortino, dSortino, bootstrapProb: bootstrap.probPositive, n: pooledHoldout.length };
}

async function main() {
  const donchian = PRESET_STRATEGIES.find(s => s.id === '1')!;
  const results = [];
  results.push(await evaluateTimeframe(donchian, '4h', 22));
  await sleep(1500);
  results.push(await evaluateTimeframe(donchian, '1d', 4));
  await sleep(1500);
  results.push(await evaluateTimeframe(donchian, '1w', 1));

  console.log('\n═══ Resumo — Sharpe vs. Sortino, Donchian, mesma cesta cripto ═══\n');
  for (const r of results) {
    console.log(
      `  ${r.timeframe.padEnd(4)} n=${String(r.n).padEnd(5)} Sharpe=${r.pooledSharpe.toFixed(3).padStart(7)}  Sortino=${isFinite(r.pooledSortino) ? r.pooledSortino.toFixed(3).padStart(7) : '      ∞'}  ` +
      `DeflatedSortino=${(r.dSortino * 100).toFixed(1).padStart(5)}%  Bootstrap_P(>0)=${(r.bootstrapProb * 100).toFixed(1).padStart(5)}%`
    );
  }
}

main().catch(err => { console.error(err); process.exit(1); });
