/**
 * Holdout do BTCUSDT — a anomalia de 68,2% do baseline sobrevive fora de amostra?
 *
 * Ver `hypothesis.md` (escrito ANTES desta execução) para desenho, cortes de
 * período, critérios pré-registrados e a verificação obrigatória da otimização.
 *
 * Rodar:
 *   npx esbuild research/experiments/2026-07-31-btc-holdout/run.ts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/btc-holdout.mjs && \
 *   node /tmp/btc-holdout.mjs
 */
import { writeFileSync } from 'node:fs';
import { backtestDataService, type Timeframe, type CandleData } from '../../../src/app/services/BacktestDataService';
import { computeScoreFromCandles } from '../../../src/app/services/MarketScoreEngine';
import { estimateCostPercent } from '../../CostModel';

const MS_PER_BAR: Record<string, number> = {
  '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000,
};

const FORWARD_BARS = 8;
/** Janela móvel passada ao score. Ver hypothesis.md — SMA200 é o maior lookback. */
const ROLLING_WINDOW = 500;
const MIN_LOOKBACK = 240;

/** Limiares de convicção — IDÊNTICOS aos do MarketScoreValidator, não recalibrados. */
const BUY_SCORE = 68, SELL_SCORE = 32, MIN_CONF = 55;

/** Custo round-trip cripto: 0,26% (tabela 14.3). Ver armadilha de unidade no baseline. */
const ROUND_TRIP_COST_PCT = estimateCostPercent('CRYPTO', 1, 1) * 2 * 100;

/** Início do histórico da Binance com folga. */
const HISTORY_START = new Date('2017-01-01T00:00:00Z');

interface Reading {
  time: number;
  score: number;
  confidence: number;
  fwdRet: number;
}

function binomialTailP(hits: number, n: number): number {
  if (n === 0) return 1;
  const logFact: number[] = [0];
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  let p = 0;
  for (let k = hits; k <= n; k++) {
    p += Math.exp(logFact[n] - logFact[k] - logFact[n - k] + n * Math.log(0.5));
  }
  return Math.min(1, p);
}

/** Estatística de convicção sobre um subconjunto de leituras. */
function convictionStats(readings: Reading[]) {
  const buys = readings.filter(r => r.score >= BUY_SCORE && r.confidence >= MIN_CONF);
  const sells = readings.filter(r => r.score <= SELL_SCORE && r.confidence >= MIN_CONF);
  const buyHits = buys.filter(r => r.fwdRet > 0).length;
  const sellHits = sells.filter(r => r.fwdRet < 0).length;
  const n = buys.length + sells.length;
  const hits = buyHits + sellHits;
  // Retorno bruto orientado pelo lado: compra espera +, venda espera −.
  const gross = n
    ? (buys.reduce((a, r) => a + r.fwdRet, 0) + sells.reduce((a, r) => a - r.fwdRet, 0)) / n
    : 0;
  return {
    samples: n,
    hits,
    hitRate: n ? Number(((hits / n) * 100).toFixed(1)) : 0,
    pValue: Number(binomialTailP(hits, n).toFixed(6)),
    buy: { samples: buys.length, hitRate: buys.length ? Number(((buyHits / buys.length) * 100).toFixed(1)) : 0 },
    sell: { samples: sells.length, hitRate: sells.length ? Number(((sellHits / sells.length) * 100).toFixed(1)) : 0 },
    grossReturnPct: Number(gross.toFixed(4)),
    netEdgePct: Number((gross - ROUND_TRIP_COST_PCT).toFixed(4)),
  };
}

/** Walk-forward com janela móvel — O(n) em vez do O(n²) do baseline. */
async function collectReadings(symbol: string, timeframe: Timeframe): Promise<{ readings: Reading[]; candles: number; firstTime: number; lastTime: number }> {
  const res = await backtestDataService.fetchHistoricalData(symbol, HISTORY_START, new Date(), timeframe);
  const candles: CandleData[] = res.candles;
  const readings: Reading[] = [];

  for (let i = MIN_LOOKBACK; i < candles.length - FORWARD_BARS; i++) {
    const from = Math.max(0, i + 1 - ROLLING_WINDOW);
    const slice = candles.slice(from, i + 1);
    const core = computeScoreFromCandles(slice, slice);
    if (core.provenance === 'unavailable') continue;
    const entry = candles[i].close;
    const exit = candles[i + FORWARD_BARS].close;
    readings.push({
      time: candles[i].time,
      score: core.score,
      confidence: core.confidence,
      fwdRet: ((exit - entry) / entry) * 100,
    });
  }
  return { readings, candles: candles.length, firstTime: candles[0].time, lastTime: candles[candles.length - 1].time };
}

/** Fronteira IS/OOS: mesma janela que o baseline usou (validateScore: 1500 × ms × 2,4). */
function baselineCutoff(timeframe: string): number {
  return Date.now() - 1500 * MS_PER_BAR[timeframe] * 2.4;
}

async function analyze(symbol: string, timeframe: Timeframe) {
  process.stdout.write(`▸ ${symbol} ${timeframe} ... `);
  const { readings, candles, firstTime, lastTime } = await collectReadings(symbol, timeframe);
  const cutoff = baselineCutoff(timeframe);

  const oos = readings.filter(r => r.time < cutoff);
  const is = readings.filter(r => r.time >= cutoff);

  // Estabilidade ano a ano
  const years = [...new Set(readings.map(r => new Date(r.time).getUTCFullYear()))].sort();
  const byYear = years.map(y => {
    const subset = readings.filter(r => new Date(r.time).getUTCFullYear() === y);
    const s = convictionStats(subset);
    return { year: y, samples: s.samples, hitRate: s.hitRate };
  });

  const isStats = convictionStats(is);
  const oosStats = convictionStats(oos);
  const allStats = convictionStats(readings);

  console.log(
    `barras=${candles} | IS n=${isStats.samples} hit=${isStats.hitRate}% | ` +
    `OOS n=${oosStats.samples} hit=${oosStats.hitRate}% p=${oosStats.pValue}`,
  );

  return {
    symbol,
    timeframe,
    totalCandles: candles,
    periodStart: new Date(firstTime).toISOString().slice(0, 10),
    periodEnd: new Date(lastTime).toISOString().slice(0, 10),
    cutoffDate: new Date(cutoff).toISOString().slice(0, 10),
    inSample: isStats,
    outOfSample: oosStats,
    fullPeriod: allStats,
    byYear,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`Custo round-trip aplicado: ${ROUND_TRIP_COST_PCT.toFixed(3)}%\n`);

  // 1) BTC nos dois timeframes que passaram/quase passaram no baseline
  console.log('=== BTCUSDT (alvo) ===');
  const btc4h = await analyze('BTCUSDT', '4h');
  const btc1h = await analyze('BTCUSDT', '1h');

  // 2) Controles: os outros 6 ativos, 4h, histórico completo
  console.log('\n=== Controles (4h, histórico completo) ===');
  const controls = [];
  for (const sym of ['ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT']) {
    controls.push(await analyze(sym, '4h'));
  }

  // 3) Verificação obrigatória: a janela IS reproduz o baseline?
  const reproductionCheck = {
    note: 'A janela IS deve reproduzir o baseline (BTC 4h ~68,2% n=88; BTC 1h ~61,1% n=90). Divergência grande invalida a otimização de janela móvel.',
    btc4h: { baselineHitRate: 68.2, baselineSamples: 88, measuredHitRate: btc4h.inSample.hitRate, measuredSamples: btc4h.inSample.samples },
    btc1h: { baselineHitRate: 61.1, baselineSamples: 90, measuredHitRate: btc1h.inSample.hitRate, measuredSamples: btc1h.inSample.samples },
  };

  // 4) Critérios pré-registrados, aplicados ao OOS
  const ALPHA = 0.05 / 2; // Bonferroni: 2 timeframes de BTC
  const evaluate = (r: typeof btc4h) => ({
    combo: `${r.symbol} ${r.timeframe}`,
    c1_significance: r.outOfSample.hitRate > 50 && r.outOfSample.pValue < ALPHA,
    c2_consistency: r.outOfSample.buy.hitRate > 50 && r.outOfSample.sell.hitRate > 50,
    c3_economic: r.outOfSample.netEdgePct > 0,
    c4_sample: r.outOfSample.samples >= 100,
  });
  const verdicts = [evaluate(btc4h), evaluate(btc1h)];

  // 5) Especificidade: BTC se destaca dos controles no OOS?
  const controlOosHitRates = controls.map(c => ({ symbol: c.symbol, oosHitRate: c.outOfSample.hitRate, oosSamples: c.outOfSample.samples }));

  const summary = {
    experiment: '2026-07-31-btc-holdout',
    startedAt,
    finishedAt: new Date().toISOString(),
    config: { forwardBars: FORWARD_BARS, rollingWindow: ROLLING_WINDOW, minLookback: MIN_LOOKBACK, buyScore: BUY_SCORE, sellScore: SELL_SCORE, minConfidence: MIN_CONF, roundTripCostPct: ROUND_TRIP_COST_PCT, alphaBonferroni: ALPHA },
    reproductionCheck,
    verdicts,
    btc: [btc4h, btc1h],
    controls,
    controlOosHitRates,
  };

  writeFileSync('research/experiments/2026-07-31-btc-holdout/results.json', JSON.stringify(summary, null, 2));

  console.log('\n═══ VERIFICAÇÃO DA OTIMIZAÇÃO ═══');
  console.log(`BTC 4h IS: medido ${btc4h.inSample.hitRate}% (n=${btc4h.inSample.samples}) vs baseline 68,2% (n=88)`);
  console.log(`BTC 1h IS: medido ${btc1h.inSample.hitRate}% (n=${btc1h.inSample.samples}) vs baseline 61,1% (n=90)`);

  console.log('\n═══ HOLDOUT (OOS) ═══');
  for (const r of [btc4h, btc1h]) {
    const o = r.outOfSample;
    console.log(`${r.symbol} ${r.timeframe} [${r.periodStart} → ${r.cutoffDate}]`);
    console.log(`  n=${o.samples} hit=${o.hitRate}% (compra ${o.buy.hitRate}% n=${o.buy.samples} / venda ${o.sell.hitRate}% n=${o.sell.samples}) p=${o.pValue} netEdge=${o.netEdgePct}%`);
  }

  console.log('\n═══ CRITÉRIOS PRÉ-REGISTRADOS (OOS) ═══');
  for (const v of verdicts) {
    const passed = v.c1_significance && v.c2_consistency && v.c3_economic && v.c4_sample;
    console.log(`${v.combo}: ${passed ? '✅ PASSA' : '❌ FALHA'} — c1=${v.c1_significance} c2=${v.c2_consistency} c3=${v.c3_economic} c4=${v.c4_sample}`);
  }

  console.log('\n═══ CONTROLES (OOS, 4h) ═══');
  for (const c of controlOosHitRates) console.log(`  ${c.symbol.padEnd(9)} n=${String(c.oosSamples).padStart(4)} hit=${c.oosHitRate}%`);

  console.log('\n═══ ESTABILIDADE ANO A ANO (BTC 4h) ═══');
  for (const y of btc4h.byYear) console.log(`  ${y.year}: n=${String(y.samples).padStart(3)} hit=${y.hitRate}%`);

  console.log('\nSalvo em: research/experiments/2026-07-31-btc-holdout/results.json');
}

main().catch(err => { console.error(err); process.exit(1); });
