/**
 * Item 4 do redesenho do cérebro — continuação (2026-08-16 -> nova sessão),
 * seguindo o item (1) da lista de próximos passos em
 * `results/README.md`: "testar sensibilidade de parâmetros com correção por
 * múltiplos testes (DSR)".
 *
 * O teste anterior (`pairsBacktest.ts`) usou 1 configuração fixa e não deu
 * pra distinguir "a ideia de arbitragem estatística não funciona" de "esta
 * calibração específica não funciona". Este script varre uma grade de
 * parâmetros (janela de OLS, z de entrada, z de saída) sobre os MESMOS 12
 * pares×timeframe, mede o Sharpe de cada configuração, e aplica DSR
 * (`research/DeflatedSharpe.ts`, já usado no projeto pra corrigir a busca de
 * TA de julho) pra saber se o melhor resultado de cada par é edge real ou só
 * o vencedor da loteria de configurações testadas.
 *
 * MESMA disciplina anti-look-ahead do script anterior: OLS e z-score sempre
 * usam só janela trailing ANTERIOR ao candle da decisão.
 *
 * Uso: npx tsx research/experiments/2026-08-16-statistical-arbitrage/scripts/pairsSensitivity.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../../DeflatedSharpe';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO',
  EURUSD: 'FOREX_MAJOR',
  XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY',
  US30: 'INDEX',
  NAS100: 'INDEX',
  SPX500: 'INDEX',
  GER40: 'INDEX',
};

const PAIRS: [string, string][] = [
  ['XAUUSD', 'XAGUSD'],
  ['US30', 'SPX500'],
  ['US30', 'NAS100'],
  ['SPX500', 'NAS100'],
  ['GER40', 'US30'],
  ['GER40', 'SPX500'],
];

const TIMEFRAMES = ['15m', '1h'];

// Grade de parâmetros — mesma STOP_Z/MAX_HOLD do teste original (fixos, não
// fazem parte da hipótese central de "onde entrar/sair da reversão"), varia
// só o que define o formato do sinal: janela de calibração e limiares de
// entrada/saída em z-score.
const WINDOWS = [50, 100, 150];
const ENTRY_ZS = [1.5, 2.0, 2.5];
const EXIT_ZS = [0.5, 1.0];
const STOP_Z = 3.5;
const MAX_HOLD_CANDLES = 50;

interface Config { window: number; entryZ: number; exitZ: number }
const CONFIGS: Config[] = [];
for (const window of WINDOWS) for (const entryZ of ENTRY_ZS) for (const exitZ of EXIT_ZS) {
  if (exitZ >= entryZ) continue; // saída tem que ser mais apertada que entrada, senão nunca dispara por reversão
  CONFIGS.push({ window, entryZ, exitZ });
}

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles ?? null;
}

function alignByTime(a: Candle[], b: Candle[]): { time: number; a: number; b: number }[] {
  const mapB = new Map(b.map(c => [c.time, c.close]));
  const aligned: { time: number; a: number; b: number }[] = [];
  for (const ca of a) {
    const cb = mapB.get(ca.time);
    if (cb !== undefined) aligned.push({ time: ca.time, a: ca.close, b: cb });
  }
  return aligned;
}

function trailingOLS(series: { a: number; b: number }[], i: number, window: number): { alpha: number; beta: number } | null {
  const start = i - window;
  if (start < 0) return null;
  let sumA = 0, sumB = 0, sumAB = 0, sumBB = 0;
  for (let k = start; k < i; k++) {
    sumA += series[k].a;
    sumB += series[k].b;
    sumAB += series[k].a * series[k].b;
    sumBB += series[k].b * series[k].b;
  }
  const n = window;
  const meanA = sumA / n;
  const meanB = sumB / n;
  const covAB = sumAB / n - meanA * meanB;
  const varB = sumBB / n - meanB * meanB;
  if (varB === 0) return null;
  const beta = covAB / varB;
  const alpha = meanA - beta * meanB;
  return { alpha, beta };
}

interface Trade { netPercent: number }

function backtestPair(
  aligned: { time: number; a: number; b: number }[],
  symbolA: string,
  symbolB: string,
  cfg: Config
): Trade[] {
  const trades: Trade[] = [];
  const costA = (priceLevel: number) => estimateCostPercent(ASSET_CLASS[symbolA], priceLevel, getPointValue(symbolA)) * 2;
  const costB = (priceLevel: number) => estimateCostPercent(ASSET_CLASS[symbolB], priceLevel, getPointValue(symbolB)) * 2;

  let position: null | { side: 'LONG_SPREAD' | 'SHORT_SPREAD'; entryIdx: number; entryA: number; entryB: number; beta: number } = null;

  for (let i = cfg.window; i < aligned.length; i++) {
    const ols = trailingOLS(aligned, i, cfg.window);
    if (!ols) continue;
    const { alpha, beta } = ols;

    const start = i - cfg.window;
    let sumSpread = 0;
    const spreads: number[] = [];
    for (let k = start; k < i; k++) {
      const s = aligned[k].a - (alpha + beta * aligned[k].b);
      spreads.push(s);
      sumSpread += s;
    }
    const meanSpread = sumSpread / spreads.length;
    const variance = spreads.reduce((s, x) => s + (x - meanSpread) ** 2, 0) / spreads.length;
    const stdSpread = Math.sqrt(variance);
    if (stdSpread === 0) continue;

    const currSpread = aligned[i].a - (alpha + beta * aligned[i].b);
    const z = (currSpread - meanSpread) / stdSpread;

    if (position) {
      const held = i - position.entryIdx;
      const exitOnRevert = Math.abs(z) <= cfg.exitZ;
      const exitOnBreak = Math.abs(z) >= STOP_Z;
      const exitOnTimeout = held >= MAX_HOLD_CANDLES;

      if (exitOnRevert || exitOnBreak || exitOnTimeout) {
        const { entryA, entryB, beta: entryBeta, side } = position;
        const exitA = aligned[i].a;
        const exitB = aligned[i].b;
        const dirA = side === 'LONG_SPREAD' ? 1 : -1;
        const dirB = side === 'LONG_SPREAD' ? -1 : 1;
        const grossPnl = dirA * (exitA - entryA) + dirB * entryBeta * (exitB - entryB);
        const notionalA = entryA;
        const notionalB = Math.abs(entryBeta) * entryB;
        const totalNotional = notionalA + notionalB;
        const cost = (costA(entryA) * notionalA) + (costB(entryB) * notionalB);
        const netPnl = grossPnl - cost;
        trades.push({ netPercent: (netPnl / totalNotional) * 100 });
        position = null;
      }
      continue;
    }

    if (z >= cfg.entryZ) {
      position = { side: 'SHORT_SPREAD', entryIdx: i, entryA: aligned[i].a, entryB: aligned[i].b, beta };
    } else if (z <= -cfg.entryZ) {
      position = { side: 'LONG_SPREAD', entryIdx: i, entryA: aligned[i].a, entryB: aligned[i].b, beta };
    }
  }

  return trades;
}

interface TrialResult { cfg: Config; trades: Trade[]; sharpe: number; netTotalPercent: number; n: number }
interface PairSummary {
  pair: string; tf: string; nTrials: number;
  best: TrialResult; sharpeVarianceAcrossTrials: number; sr0: number; dsr: number;
}

const summaries: PairSummary[] = [];
const allTrialRows: { pair: string; tf: string; window: number; entryZ: number; exitZ: number; n: number; sharpe: number; netTotalPercent: number }[] = [];

for (const [symA, symB] of PAIRS) {
  for (const tf of TIMEFRAMES) {
    const candlesA = loadCandles(symA, tf);
    const candlesB = loadCandles(symB, tf);
    if (!candlesA || !candlesB) continue;
    const aligned = alignByTime(candlesA, candlesB);
    if (aligned.length < Math.max(...WINDOWS) + 10) continue;

    const trials: TrialResult[] = [];
    for (const cfg of CONFIGS) {
      const trades = backtestPair(aligned, symA, symB, cfg);
      const returns = trades.map(t => t.netPercent);
      const sharpe = sharpeRatio(returns);
      const netTotalPercent = returns.reduce((s, x) => s + x, 0);
      trials.push({ cfg, trades, sharpe, netTotalPercent, n: trades.length });
      allTrialRows.push({ pair: `${symA}/${symB}`, tf, window: cfg.window, entryZ: cfg.entryZ, exitZ: cfg.exitZ, n: trades.length, sharpe, netTotalPercent });
    }

    // só considera trials com amostra mínima pra Sharpe não ser ruído puro de poucos trades
    const validTrials = trials.filter(t => t.n >= 10);
    if (validTrials.length === 0) continue;

    const best = validTrials.reduce((a, b) => (b.sharpe > a.sharpe ? b : a));
    const sharpes = validTrials.map(t => t.sharpe);
    const meanSharpe = sharpes.reduce((s, x) => s + x, 0) / sharpes.length;
    const sharpeVarianceAcrossTrials = sharpes.reduce((s, x) => s + (x - meanSharpe) ** 2, 0) / sharpes.length;
    const sr0 = expectedMaxSharpeUnderNull(sharpeVarianceAcrossTrials, validTrials.length);
    const dsr = deflatedSharpeRatio(best.sharpe, sr0, best.n);

    summaries.push({ pair: `${symA}/${symB}`, tf, nTrials: validTrials.length, best, sharpeVarianceAcrossTrials, sr0, dsr });
  }
}

writeFileSync(join(RESULTS_DIR, 'pairs_sensitivity_all_trials.json'), JSON.stringify(allTrialRows, null, 2));
writeFileSync(join(RESULTS_DIR, 'pairs_sensitivity_summary.json'), JSON.stringify(summaries, null, 2));

const lines: string[] = [];
lines.push('# Sensibilidade de parâmetros + DSR — arbitragem estatística (item 4, continuação)');
lines.push('');
lines.push(`Grade: janela ∈ {${WINDOWS.join(',')}}, entrada-z ∈ {${ENTRY_ZS.join(',')}}, saída-z ∈ {${EXIT_ZS.join(',')}} (só exitZ<entryZ), stop-z=${STOP_Z} e hold-máx=${MAX_HOLD_CANDLES} fixos = ${CONFIGS.length} configs por par×tf, ${CONFIGS.length * PAIRS.length * TIMEFRAMES.length} backtests no total.`);
lines.push('DSR (Deflated Sharpe Ratio, `research/DeflatedSharpe.ts`) aplicado por par×tf usando o número de configs testadas (nTrials) e a variância de Sharpe entre elas — >95% é o piso convencional de "provavelmente real, não seleção".');
lines.push('');
lines.push('| Par | TF | Configs válidas (n≥10 trades) | Melhor config (win/entry/exit) | Trades | Sharpe | Líq total % | DSR |');
lines.push('|---|---|---:|---|---:|---:|---:|---:|');
for (const s of summaries) {
  lines.push(
    `| ${s.pair} | ${s.tf} | ${s.nTrials} | w=${s.best.cfg.window},e=${s.best.cfg.entryZ},x=${s.best.cfg.exitZ} | ${s.best.n} | ${s.best.sharpe.toFixed(3)} | ${s.best.netTotalPercent.toFixed(2)}% | ${(s.dsr * 100).toFixed(1)}% |`
  );
}
writeFileSync(join(RESULTS_DIR, 'pairs_sensitivity_summary.md'), lines.join('\n') + '\n');

console.log(`Gravado: results/pairs_sensitivity_summary.md/.json e pairs_sensitivity_all_trials.json (${summaries.length} pares×tf, ${allTrialRows.length} trials totais)`);
