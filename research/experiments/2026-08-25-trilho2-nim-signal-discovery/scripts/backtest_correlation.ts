/**
 * Backtest real das hipóteses de correlação cross-asset geradas pelo NIM
 * Signal Discovery Agent (2026-08-25) — ver ../hypothesis.md e
 * ../results/hypotheses.json (saída bruta do LLM).
 *
 * Testa 2 das 5 hipóteses (as 2 que dependem só de preço, sem NLP):
 *   - CorrCrossRegime_5m_BTC (BTCUSD × XBNUSD, corr(20) > 0.75 + vol XBNUSD alta)
 *   - CorrCrossRegime_1h_XAGUSD (XAGUSD × XAUUSD, corr(30) > 0.80 + vol XAUUSD no Q4)
 *
 * As outras 3 hipóteses (EconCal_Veto_1h_Spread, SentimentoNLP_RegimeFilter_15m_SPX,
 * EconCal_Veto_Sent_NLP_5m_US30) dependem de sentimento NLP sobre TEXTO de
 * evento econômico — não backtestadas aqui porque não existe arquivo/tabela
 * de histórico de calendário econômico no projeto (o endpoint
 * `/economic-calendar` só devolve o dia corrente, nunca histórico) e texto
 * de evento nunca foi persistido. Rodar essas 3 exigiria fabricar dado
 * histórico de notícia — violaria a convenção do projeto de nunca fabricar
 * dado. Documentado como BLOQUEADO em ../results/verdict.md, não como
 * "não validado" — são coisas diferentes.
 *
 * ACHADO METODOLÓGICO ANTES DE RODAR: BTCUSD e XBNUSD, no `fetch_candles.mjs`
 * deste projeto, vêm da MESMA fonte (Binance BTCUSDT) — ou seja, são a
 * MESMA série de preço sob dois símbolos diferentes. A hipótese
 * "correlação entre BTCUSD e XBNUSD" é degenerada por construção (corr ≈ 1.0
 * sempre, por definição, não por edge de mercado). O LLM não tinha como
 * saber disso (gerou a hipótese só a partir de nomes de símbolo). Este
 * script ainda calcula e reporta o resultado (pra documentar o achado com
 * número real), mas ele NÃO deve ser lido como validação de correlação
 * cross-asset real — é artefato de dado duplicado, registrado explicitamente
 * no verdict.md.
 *
 * Metodologia: mesma disciplina do resto do projeto — walk-forward com
 * embargo (DataSplit.ts), Deflated Sharpe (DeflatedSharpe.ts), custo real
 * (CostModel.ts). Sem SL explícito nas regras geradas pelo LLM — adicionado
 * aqui um SL simétrico ao TP (2x ATR) como piso de gestão de risco mínima,
 * documentado como suposição nossa, não do LLM.
 *
 * Uso: npx tsx research/experiments/2026-08-25-trilho2-nim-signal-discovery/scripts/backtest_correlation.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import { splitWithEmbargo } from '../../../DataSplit';
import { sharpeRatio, deflatedSharpeRatio, expectedMaxSharpeUnderNull } from '../../../DeflatedSharpe';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles.map((c: any) => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 }));
}

function averageTrueRange(candles: Candle[], period: number): number {
  if (candles.length < period + 1) return 0;
  const slice = candles.slice(-period - 1);
  let sum = 0;
  for (let i = 1; i < slice.length; i++) {
    const tr = Math.max(
      slice[i].high - slice[i].low,
      Math.abs(slice[i].high - slice[i - 1].close),
      Math.abs(slice[i].low - slice[i - 1].close)
    );
    sum += tr;
  }
  return sum / period;
}

function pearsonCorr(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    cov += da * db; varA += da * da; varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/** Percentil causal: posição de `value` dentro de `history` (ambos já conhecidos até o candle corrente). */
function percentileRank(history: number[], value: number): number {
  if (history.length === 0) return 0;
  const below = history.filter((h) => h <= value).length;
  return below / history.length;
}

interface HypothesisSpec {
  name: string;
  symbolA: string; // ativo operado
  symbolB: string; // ativo de referência pra correlação
  timeframe: string;
  corrWindow: number;
  corrEntryThreshold: number;
  corrExitThreshold: number;
  volWindow: number;
  volPercentileThreshold: number; // ex: 0.75 = quartil superior
  tpAtrMult: number;
  assetClass: AssetClass;
  direction: 'BUY'; // ambas hipóteses testadas aqui são só compradas
}

const HYPOTHESES: HypothesisSpec[] = [
  {
    name: 'CorrCrossRegime_5m_BTC',
    symbolA: 'BTCUSD', symbolB: 'XBNUSD', timeframe: '5m',
    corrWindow: 20, corrEntryThreshold: 0.75, corrExitThreshold: 0.60,
    volWindow: 10, volPercentileThreshold: 0, // regra original usa limiar fixo (1.2x média), tratado à parte abaixo
    tpAtrMult: 1.5, assetClass: 'CRYPTO', direction: 'BUY',
  },
  {
    name: 'CorrCrossRegime_1h_XAGUSD',
    symbolA: 'XAGUSD', symbolB: 'XAUUSD', timeframe: '1h',
    corrWindow: 30, corrEntryThreshold: 0.80, corrExitThreshold: 0.65,
    volWindow: 20, volPercentileThreshold: 0.75,
    tpAtrMult: 2.0, assetClass: 'COMMODITY', direction: 'BUY',
  },
];

interface TradeResult { entryIndex: number; netReturnPercent: number; win: boolean; }

/**
 * Simula uma hipótese sobre uma série já alinhada (candlesA/candlesB mesmo
 * timestamp por índice — ver alignSeries). Causal: cada decisão de entrada
 * em `i` só usa candles[0..i].
 */
function simulate(candlesA: Candle[], candlesB: Candle[], spec: HypothesisSpec): TradeResult[] {
  const n = candlesA.length;
  const returnsA: number[] = [0];
  const returnsB: number[] = [0];
  for (let i = 1; i < n; i++) {
    returnsA.push((candlesA[i].close - candlesA[i - 1].close) / candlesA[i - 1].close);
    returnsB.push((candlesB[i].close - candlesB[i - 1].close) / candlesB[i - 1].close);
  }

  const pointValue = getPointValue(spec.symbolA);
  const trades: TradeResult[] = [];
  const minWarmup = Math.max(spec.corrWindow, spec.volWindow, 60) + 1;
  const volHistory: number[] = []; // pra percentil causal, só usado quando volPercentileThreshold > 0

  let i = minWarmup;
  while (i < n) {
    const corrSlice = { a: returnsA.slice(i - spec.corrWindow, i), b: returnsB.slice(i - spec.corrWindow, i) };
    const corr = pearsonCorr(corrSlice.a, corrSlice.b);

    const volSlice = returnsB.slice(i - spec.volWindow, i); // vol do ativo de REFERÊNCIA (spec do LLM)
    const vol = stdDev(volSlice);

    let volConditionMet: boolean;
    if (spec.volPercentileThreshold > 0) {
      volConditionMet = volHistory.length >= 30 && percentileRank(volHistory, vol) >= spec.volPercentileThreshold;
      volHistory.push(vol);
    } else {
      // Regra original (BTC): vol últimos N > 1.2x média dos últimos 60 — comparação causal direta.
      const longVolSlice = returnsB.slice(Math.max(0, i - 60), i);
      const longVolAvg = stdDev(longVolSlice);
      volConditionMet = longVolAvg > 0 && vol > 1.2 * longVolAvg;
    }

    if (corr > spec.corrEntryThreshold && volConditionMet) {
      const entryIdx = i;
      const entryPrice = candlesA[entryIdx].close;
      const atr = averageTrueRange(candlesA.slice(0, entryIdx + 1), 14);
      if (atr <= 0) { i++; continue; }
      const targetPrice = entryPrice + atr * spec.tpAtrMult;
      const stopPrice = entryPrice - atr * spec.tpAtrMult; // SL simétrico — suposição nossa, ver header

      let exitPrice: number | null = null;
      let j = entryIdx + 1;
      for (; j < n; j++) {
        // Saída por quebra de correlação: recalcula corr(janela) causal a cada barra seguinte.
        const rollA = returnsA.slice(j - spec.corrWindow, j);
        const rollB = returnsB.slice(j - spec.corrWindow, j);
        const rollCorr = pearsonCorr(rollA, rollB);
        const c = candlesA[j];
        if (c.high >= targetPrice) { exitPrice = targetPrice; break; }
        if (c.low <= stopPrice) { exitPrice = stopPrice; break; }
        if (rollCorr < spec.corrExitThreshold) { exitPrice = c.close; break; }
      }
      if (exitPrice !== null) {
        const grossReturnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        const roundTripCostPercent = estimateCostPercent(spec.assetClass, entryPrice, pointValue) * 2 * 100;
        const netReturnPercent = grossReturnPercent - roundTripCostPercent;
        trades.push({ entryIndex: entryIdx, netReturnPercent, win: exitPrice >= targetPrice });
        i = j + 1; // não sobrepõe trades
        continue;
      }
    }
    i++;
  }
  return trades;
}

interface RowResult {
  hypothesis: string; window: number;
  trainTrades: number; trainSharpe: number;
  holdoutTrades: number; holdoutWinRate: number; holdoutNetPercentTotal: number; holdoutAvgNetPercent: number; holdoutSharpe: number;
}

const allRows: RowResult[] = [];
const N_TRIALS = HYPOTHESES.length; // corrigido pelas 2 hipóteses testadas nesta rodada

for (const spec of HYPOTHESES) {
  const candlesA = loadCandles(spec.symbolA, spec.timeframe);
  const candlesB = loadCandles(spec.symbolB, spec.timeframe);
  if (!candlesA || !candlesB || candlesA.length < 300 || candlesB.length < 300) {
    console.log(`⚠️  ${spec.name}: SEM DADO REAL suficiente, pulando`);
    continue;
  }

  // Alinha as duas séries por timestamp (interseção), preservando ordem.
  const mapB = new Map(candlesB.map((c) => [c.timestamp, c]));
  const alignedA: Candle[] = [];
  const alignedB: Candle[] = [];
  for (const c of candlesA) {
    const b = mapB.get(c.timestamp);
    if (b) { alignedA.push(c); alignedB.push(b); }
  }
  if (alignedA.length < 300) {
    console.log(`⚠️  ${spec.name}: interseção de timestamps insuficiente (${alignedA.length}), pulando`);
    continue;
  }

  const windows = splitWithEmbargo(alignedA, 3, 0.7, 200);
  const windowsB = splitWithEmbargo(alignedB, 3, 0.7, 200);

  windows.forEach((win, w) => {
    const winB = windowsB[w];
    if (win.train.length < 100 || win.holdout.length < 100) return;

    const trainTrades = simulate(win.train, winB.train, spec);
    const holdoutTradesAll = simulate(win.holdout, winB.holdout, spec);
    const holdoutTrades = holdoutTradesAll.filter((t) => t.entryIndex >= win.warmupBars);

    const trainReturns = trainTrades.map((t) => t.netReturnPercent);
    const holdoutReturns = holdoutTrades.map((t) => t.netReturnPercent);

    allRows.push({
      hypothesis: spec.name, window: w,
      trainTrades: trainTrades.length,
      trainSharpe: sharpeRatio(trainReturns),
      holdoutTrades: holdoutTrades.length,
      holdoutWinRate: holdoutTrades.length ? holdoutTrades.filter((t) => t.win).length / holdoutTrades.length : 0,
      holdoutNetPercentTotal: holdoutReturns.reduce((a, b) => a + b, 0),
      holdoutAvgNetPercent: holdoutTrades.length ? holdoutReturns.reduce((a, b) => a + b, 0) / holdoutTrades.length : 0,
      holdoutSharpe: sharpeRatio(holdoutReturns),
    });
  });
}

writeFileSync(join(RESULTS_DIR, 'raw_windows_correlation.json'), JSON.stringify(allRows, null, 2));

interface Champion {
  hypothesis: string; trainTrades: number; holdoutTrades: number; holdoutWinRate: number;
  holdoutNetPercentTotal: number; holdoutAvgNetPercent: number; holdoutSharpe: number; dsr: number;
}
const champions: Champion[] = [];
for (const spec of HYPOTHESES) {
  const rows = allRows.filter((r) => r.hypothesis === spec.name);
  if (!rows.length) continue;
  const trainTrades = rows.reduce((a, r) => a + r.trainTrades, 0);
  const holdoutTrades = rows.reduce((a, r) => a + r.holdoutTrades, 0);
  const holdoutNetPercentTotal = rows.reduce((a, r) => a + r.holdoutNetPercentTotal, 0);
  const holdoutWinRate = holdoutTrades ? rows.reduce((a, r) => a + r.holdoutWinRate * r.holdoutTrades, 0) / holdoutTrades : 0;
  const holdoutSharpe = holdoutTrades ? rows.reduce((a, r) => a + r.holdoutSharpe * r.holdoutTrades, 0) / holdoutTrades : 0;
  const sr0 = expectedMaxSharpeUnderNull(0.01, N_TRIALS);
  const dsr = holdoutTrades >= 2 ? deflatedSharpeRatio(holdoutSharpe, sr0, holdoutTrades) : 0;
  champions.push({
    hypothesis: spec.name, trainTrades, holdoutTrades, holdoutWinRate, holdoutNetPercentTotal,
    holdoutAvgNetPercent: holdoutTrades ? holdoutNetPercentTotal / holdoutTrades : 0, holdoutSharpe, dsr,
  });
}
writeFileSync(join(RESULTS_DIR, 'champions_correlation.json'), JSON.stringify(champions, null, 2));

const lines: string[] = [];
lines.push('# Trilho 2 NIM Signal Discovery — backtest das 2 hipóteses de correlação (2026-08-25)');
lines.push('');
lines.push('Gerado por `backtest_correlation.ts`. Split: `DataSplit.ts` (3 janelas, embargo,');
lines.push('warmup 200). Custo: `CostModel.ts`. DSR: `DeflatedSharpe.ts`, corrigido pelas 2');
lines.push('hipóteses testadas nesta rodada — não corrige por seleção entre as 5 hipóteses');
lines.push('originais nem por rodadas futuras de Trilho 2.');
lines.push('');
lines.push('⚠️ `CorrCrossRegime_5m_BTC`: BTCUSD e XBNUSD vêm da MESMA fonte (Binance');
lines.push('BTCUSDT) neste projeto — resultado abaixo é sobre correlação degenerada');
lines.push('(≈1.0 por construção), não correlação cross-asset real. Ver hypothesis.md.');
lines.push('');
lines.push('| Hipótese | Trades treino | Trades holdout | Win% holdout | %líq total holdout | %líq médio/trade | Sharpe holdout | DSR |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const c of champions) {
  lines.push(`| ${c.hypothesis} | ${c.trainTrades} | ${c.holdoutTrades} | ${(c.holdoutWinRate * 100).toFixed(1)}% | ${c.holdoutNetPercentTotal.toFixed(2)}% | ${c.holdoutAvgNetPercent.toFixed(4)}% | ${c.holdoutSharpe.toFixed(3)} | ${(c.dsr * 100).toFixed(1)}% |`);
}
writeFileSync(join(RESULTS_DIR, 'RESULTADOS_correlation.md'), lines.join('\n') + '\n');
console.log(`Gravado: results/RESULTADOS_correlation.md, champions_correlation.json, raw_windows_correlation.json (${champions.length} hipóteses, ${allRows.length} linhas brutas)`);
