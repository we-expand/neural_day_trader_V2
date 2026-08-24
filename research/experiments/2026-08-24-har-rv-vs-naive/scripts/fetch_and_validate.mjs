/**
 * HAR-RV vs. naive (vol realizada recente) — validação barata pedida na
 * pesquisa de 2026-08-23 (seção 5.2, único item de ML alinhado ao objetivo
 * já decidido do projeto: ML só entra em previsão de VOLATILIDADE, nunca
 * de direção — ver CLAUDE.md). A literatura afirma HAR-RV > GARCH, mas
 * nunca comparado ao benchmark mais simples possível (naive) — é esse teste
 * que decide se vale construir algo mais sofisticado.
 *
 * Dado real, sem infra nova: klines públicos da Binance (BTCUSDT, 5m),
 * mesma fonte já usada em research/experiments/2026-08-16-scalp-cost-gate-
 * calibration/scripts/fetch_candles.mjs. Nada fabricado — ativo sem dado
 * real vira erro explícito, não é preenchido.
 *
 * Metodologia (Corsi 2009, HAR-RV clássico):
 *   RV_dia = soma dos retornos log ao quadrado dentro do dia (candles de 5m)
 *   HAR-RV: RV_t = β0 + β1·RV_{t-1} + β2·RV_semana(t-1) + β3·RV_mês(t-1) + ε
 *   Naive:  RV_t = RV_{t-1}
 *
 * Avaliação out-of-sample (sem look-ahead): treina só no período de treino,
 * testa só no holdout — RMSE e QLIKE (perda padrão pra vol, robusta a
 * heterocedasticidade) dos dois modelos, mais teste pareado (paired t-test)
 * na diferença de perda pra saber se a diferença é estatisticamente real.
 *
 * Uso: node research/experiments/2026-08-24-har-rv-vs-naive/scripts/fetch_and_validate.mjs
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

const SYMBOL = 'BTCUSDT';
const INTERVAL = '5m';
// 2026-08-24: estendido de 180 pra 730 dias (~2 anos) — resultado anterior
// (n=40 dias de holdout) favoreceu HAR-RV direcionalmente mas não passou no
// teste t pareado (|t|=1.53). Mais dado = holdout maior = mais poder pra
// separar "genuinamente melhor" de "essa amostra deu sorte".
const DAYS = 730;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBinance(ticker, interval, startMs, endMs) {
  const out = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&startTime=${cursor}&endTime=${endMs}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status} para ${ticker} ${interval}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const k of chunk) {
      out.push({ time: k[0], close: parseFloat(k[4]) });
    }
    const last = chunk[chunk.length - 1][0];
    if (last <= cursor) break;
    cursor = last + 1;
    await sleep(150);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// 1. Fetch (com cache em disco — não reflete a cada rerun)
// ────────────────────────────────────────────────────────────────────────

const cacheFile = join(DATA_DIR, `${SYMBOL}_${INTERVAL}_${DAYS}d.json`);
let candles;
if (existsSync(cacheFile)) {
  candles = JSON.parse(readFileSync(cacheFile, 'utf8')).candles;
  console.log(`✓ cache: ${candles.length} candles de ${SYMBOL} ${INTERVAL}`);
} else {
  const now = Date.now();
  const startMs = now - DAYS * 86_400_000;
  console.log(`… buscando ${DAYS}d de ${SYMBOL} ${INTERVAL} na Binance (real, sem key)...`);
  candles = await fetchBinance(SYMBOL, INTERVAL, startMs, now);
  if (!candles.length) throw new Error('0 candles retornados — sem dado real, abortando (nada fabricado)');
  writeFileSync(cacheFile, JSON.stringify({ symbol: SYMBOL, interval: INTERVAL, fetchedAt: new Date().toISOString(), candles }));
  console.log(`✓ ${candles.length} candles buscados e cacheados`);
}

// ────────────────────────────────────────────────────────────────────────
// 2. Realized variance diária (soma dos retornos log² dentro do dia UTC)
// ────────────────────────────────────────────────────────────────────────

const byDay = new Map(); // 'YYYY-MM-DD' -> [close, close, ...]
for (const c of candles) {
  const day = new Date(c.time).toISOString().slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, []);
  byDay.get(day).push(c.close);
}

const days = [...byDay.keys()].sort();
const rvByDay = [];
for (const day of days) {
  const closes = byDay.get(day);
  if (closes.length < 50) continue; // dia incompleto (ex: primeiro/último da amostra) — descarta, não interpola
  let sumSq = 0;
  for (let i = 1; i < closes.length; i++) {
    const ret = Math.log(closes[i] / closes[i - 1]);
    sumSq += ret * ret;
  }
  rvByDay.push({ day, rv: sumSq });
}

console.log(`✓ ${rvByDay.length} dias completos com RV calculada (de ${days.length} dias no range bruto)`);

if (rvByDay.length < 60) {
  throw new Error(`Amostra insuficiente pra HAR-RV (${rvByDay.length} dias) — precisa de pelo menos ~60 pra ter lag mensal + holdout com poder mínimo.`);
}

// ────────────────────────────────────────────────────────────────────────
// 3. Features HAR-RV (lags diário/semanal/mensal, sem look-ahead — todo
//    lag usa só RV até t-1)
// ────────────────────────────────────────────────────────────────────────

const rv = rvByDay.map((d) => d.rv);
const rows = []; // { target: RV_t, daily: RV_{t-1}, weekly: mean(RV_{t-5..t-1}), monthly: mean(RV_{t-22..t-1}) }
for (let t = 22; t < rv.length; t++) {
  const daily = rv[t - 1];
  const weekly = rv.slice(t - 5, t).reduce((s, v) => s + v, 0) / 5;
  const monthly = rv.slice(t - 22, t).reduce((s, v) => s + v, 0) / 22;
  rows.push({ day: rvByDay[t].day, target: rv[t], daily, weekly, monthly, naive: daily });
}

console.log(`✓ ${rows.length} observações utilizáveis (após consumir 22 dias de lag mensal)`);

// ────────────────────────────────────────────────────────────────────────
// 4. Split treino/holdout (SEM look-ahead — treina só até o corte, testa só
//    depois; holdout = últimos 25% dos dias)
// ────────────────────────────────────────────────────────────────────────

const splitIdx = Math.floor(rows.length * 0.75);
const train = rows.slice(0, splitIdx);
const test = rows.slice(splitIdx);
console.log(`✓ treino: ${train.length} dias | holdout: ${test.length} dias`);

// OLS simples (3 regressores + intercepto) via equações normais
function fitOLS(trainRows) {
  const X = trainRows.map((r) => [1, r.daily, r.weekly, r.monthly]);
  const y = trainRows.map((r) => r.target);
  const n = X.length, p = X[0].length;

  // XtX (p x p) e Xty (p)
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  // Resolve XtX·β = Xty via eliminação de Gauss
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const pv = A[col][col];
    if (Math.abs(pv) < 1e-12) throw new Error('Matriz singular no OLS do HAR-RV (colinearidade entre lags?)');
    for (let c = col; c <= p; c++) A[col][c] /= pv;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      for (let c = col; c <= p; c++) A[r][c] -= factor * A[col][c];
    }
  }
  return A.map((row) => row[p]); // [β0, β1, β2, β3]
}

const beta = fitOLS(train);
console.log(`✓ HAR-RV ajustado no treino: β0=${beta[0].toExponential(3)} β1(daily)=${beta[1].toFixed(3)} β2(weekly)=${beta[2].toFixed(3)} β3(monthly)=${beta[3].toFixed(3)}`);

function harForecast(r) {
  return beta[0] + beta[1] * r.daily + beta[2] * r.weekly + beta[3] * r.monthly;
}

// ────────────────────────────────────────────────────────────────────────
// 5. Avaliação out-of-sample: RMSE e QLIKE (perda padrão de vol forecast)
// ────────────────────────────────────────────────────────────────────────

function rmse(preds, actuals) {
  const n = preds.length;
  const sse = preds.reduce((s, p, i) => s + (p - actuals[i]) ** 2, 0);
  return Math.sqrt(sse / n);
}

// QLIKE = actual/forecast - ln(actual/forecast) - 1. Menor é melhor. Robusta
// a heterocedasticidade (Patton 2011) — padrão em avaliação de vol forecast.
function qlikeLosses(preds, actuals) {
  return preds.map((p, i) => {
    const pClamped = Math.max(p, 1e-12); // guarda contra forecast negativo/zero
    const ratio = actuals[i] / pClamped;
    return ratio - Math.log(ratio) - 1;
  });
}

const harPreds = test.map(harForecast);
const naivePreds = test.map((r) => r.naive);
const actuals = test.map((r) => r.target);

const harRmse = rmse(harPreds, actuals);
const naiveRmse = rmse(naivePreds, actuals);

const harQlike = qlikeLosses(harPreds, actuals);
const naiveQlike = qlikeLosses(naivePreds, actuals);
const harQlikeMean = harQlike.reduce((s, v) => s + v, 0) / harQlike.length;
const naiveQlikeMean = naiveQlike.reduce((s, v) => s + v, 0) / naiveQlike.length;

// Paired t-test na diferença de perda QLIKE (HAR - naive) — H0: média = 0
const diffs = harQlike.map((v, i) => v - naiveQlike[i]);
const diffMean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
const diffVar = diffs.reduce((s, v) => s + (v - diffMean) ** 2, 0) / (diffs.length - 1);
const diffSe = Math.sqrt(diffVar / diffs.length);
const tStat = diffSe > 0 ? diffMean / diffSe : 0;

console.log('\n═══ RESULTADO OUT-OF-SAMPLE (holdout, sem look-ahead) ═══\n');
console.log(`RMSE   HAR-RV: ${harRmse.toExponential(4)}`);
console.log(`RMSE   naive : ${naiveRmse.toExponential(4)}`);
console.log(`QLIKE  HAR-RV: ${harQlikeMean.toFixed(4)}`);
console.log(`QLIKE  naive : ${naiveQlikeMean.toFixed(4)}`);
console.log(`\nDiferença QLIKE (HAR - naive): ${diffMean.toFixed(4)} (negativo = HAR-RV melhor)`);
console.log(`t-stat (paired, H0: diferença=0): ${tStat.toFixed(3)} (n=${diffs.length}, |t|>~2 ≈ p<0.05)`);

const winner = harQlikeMean < naiveQlikeMean ? 'HAR-RV' : 'naive';
const significant = Math.abs(tStat) > 2;
console.log(`\nVeredito: ${winner} tem QLIKE menor. Diferença ${significant ? 'É' : 'NÃO É'} estatisticamente significante (|t|${significant ? '>' : '<='}2).`);

const output = {
  symbol: SYMBOL,
  interval: INTERVAL,
  daysRequested: DAYS,
  daysWithCompleteRv: rvByDay.length,
  observationsUsable: rows.length,
  trainSize: train.length,
  testSize: test.length,
  harBeta: beta,
  rmse: { har: harRmse, naive: naiveRmse },
  qlike: { har: harQlikeMean, naive: naiveQlikeMean, diffMean, tStat, significant },
  verdict: significant ? `${winner} estatisticamente melhor (QLIKE, paired t-test)` : 'sem diferença estatisticamente significante entre HAR-RV e naive',
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(RESULTS_DIR, 'har_rv_vs_naive.json'), JSON.stringify(output, null, 2));
console.log(`\n✓ Resultado salvo em results/har_rv_vs_naive.json`);
