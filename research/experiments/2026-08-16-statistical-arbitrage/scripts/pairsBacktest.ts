/**
 * Item 4 do redesenho do cérebro (2026-08-16, reabertura do Trilho 2) — mede
 * arbitragem estatística (cointegração / pairs trading) entre ativos
 * correlacionados, usando dado real já em cache
 * (`research/experiments/2026-08-05-taxa-base/data/`, 15m/1h).
 *
 * MOTIVAÇÃO: a busca de edge de julho/agosto (ver CLAUDE.md) testou só TA
 * clássico sobre 1 ativo — dado estruturalmente igual em todas as tentativas.
 * Arbitragem estatística usa uma relação ENTRE dois ativos (spread), não o
 * preço absoluto de um só — é genuinamente dado diferente, nunca testado
 * aqui. A pesquisa de 2026-08-16 sobre Renaissance/Two Sigma/market makers
 * reforçou que isso é a peça mais próxima do que sustenta esse tipo de firma
 * (não o "indicador certo", mas relações estatísticas entre instrumentos).
 *
 * MÉTODO (walk-forward, sem look-ahead):
 *   1. Hedge ratio (beta) via OLS rolando numa janela de `WINDOW` candles
 *      ANTERIORES ao candle atual — nunca usa dado futuro para calibrar.
 *   2. Spread_t = priceA_t - (alpha + beta * priceB_t), z-score do spread
 *      usando média/desvio-padrão da MESMA janela trailing.
 *   3. Entra quando |z| >= ENTRY_Z (spread esticado), sai quando |z| <=
 *      EXIT_Z (reversão à média) ou |z| >= STOP_Z (rompimento — a relação
 *      pode ter quebrado, não vale a pena esperar reversão) ou excede
 *      MAX_HOLD_CANDLES (evita posição presa indefinidamente).
 *   4. Custo: CostModel.ts aplicado nas DUAS pernas (cada perna tem seu
 *      próprio round-trip), como um par de trades reais teria.
 *
 * PARÂMETROS FIXOS DE PROPÓSITO — não escaneados/otimizados nesta rodada.
 * Escolha única e razoável (não é busca de melhor configuração — isso seria
 * o mesmo erro de p-hacking que a busca de TA já cometeu e corrigiu com DSR).
 * Se este primeiro corte mostrar sinal, aí sim vale rodar sensibilidade.
 *
 * Uso: npx tsx research/experiments/2026-08-16-statistical-arbitrage/scripts/pairsBacktest.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const WINDOW = 100;
const ENTRY_Z = 2.0;
const EXIT_Z = 0.5;
const STOP_Z = 3.5;
const MAX_HOLD_CANDLES = 50;

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

// Pares candidatos por correlação econômica plausível — não escolhidos por
// já terem dado bom em nenhum teste anterior (não houve teste anterior).
const PAIRS: [string, string][] = [
  ['XAUUSD', 'XAGUSD'], // ouro/prata, par clássico de cointegração em commodities
  ['US30', 'SPX500'],   // índices americanos, alta correlação estrutural
  ['US30', 'NAS100'],
  ['SPX500', 'NAS100'],
  ['GER40', 'US30'],    // índices de regiões diferentes, correlação mais fraca — controle
  ['GER40', 'SPX500'],
];

const TIMEFRAMES = ['15m', '1h'];

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles ?? null;
}

/** Alinha 2 séries de candle por timestamp exato (inner join) — sem isso, um spread comparando candles de horários diferentes seria dado fabricado. */
function alignByTime(a: Candle[], b: Candle[]): { time: number; a: number; b: number }[] {
  const mapB = new Map(b.map(c => [c.time, c.close]));
  const aligned: { time: number; a: number; b: number }[] = [];
  for (const ca of a) {
    const cb = mapB.get(ca.time);
    if (cb !== undefined) aligned.push({ time: ca.time, a: ca.close, b: cb });
  }
  return aligned;
}

/** OLS com intercepto: a = alpha + beta*b, ajustado só com os últimos `WINDOW` pontos ANTES do índice `i` (trailing, sem look-ahead). */
function trailingOLS(series: { a: number; b: number }[], i: number): { alpha: number; beta: number } | null {
  const start = i - WINDOW;
  if (start < 0) return null;
  let sumA = 0, sumB = 0, sumAB = 0, sumBB = 0;
  for (let k = start; k < i; k++) {
    sumA += series[k].a;
    sumB += series[k].b;
    sumAB += series[k].a * series[k].b;
    sumBB += series[k].b * series[k].b;
  }
  const n = WINDOW;
  const meanA = sumA / n;
  const meanB = sumB / n;
  const covAB = sumAB / n - meanA * meanB;
  const varB = sumBB / n - meanB * meanB;
  if (varB === 0) return null;
  const beta = covAB / varB;
  const alpha = meanA - beta * meanB;
  return { alpha, beta };
}

interface Trade {
  entryTime: number;
  exitTime: number;
  side: 'LONG_SPREAD' | 'SHORT_SPREAD';
  netPercent: number;
  exitReason: string;
}

function backtestPair(
  aligned: { time: number; a: number; b: number }[],
  symbolA: string,
  symbolB: string
): Trade[] {
  const trades: Trade[] = [];
  const costA = (priceLevel: number) => estimateCostPercent(ASSET_CLASS[symbolA], priceLevel, getPointValue(symbolA)) * 2;
  const costB = (priceLevel: number) => estimateCostPercent(ASSET_CLASS[symbolB], priceLevel, getPointValue(symbolB)) * 2;

  let position: null | { side: 'LONG_SPREAD' | 'SHORT_SPREAD'; entryIdx: number; entryA: number; entryB: number; beta: number } = null;

  for (let i = WINDOW; i < aligned.length; i++) {
    const ols = trailingOLS(aligned, i);
    if (!ols) continue;
    const { alpha, beta } = ols;

    // z-score do spread na MESMA janela trailing usada pro OLS.
    const start = i - WINDOW;
    const spreads: number[] = [];
    for (let k = start; k < i; k++) spreads.push(aligned[k].a - (alpha + beta * aligned[k].b));
    const meanSpread = spreads.reduce((s, x) => s + x, 0) / spreads.length;
    const variance = spreads.reduce((s, x) => s + (x - meanSpread) ** 2, 0) / spreads.length;
    const stdSpread = Math.sqrt(variance);
    if (stdSpread === 0) continue;

    const currSpread = aligned[i].a - (alpha + beta * aligned[i].b);
    const z = (currSpread - meanSpread) / stdSpread;

    if (position) {
      const held = i - position.entryIdx;
      const exitOnRevert = Math.abs(z) <= EXIT_Z;
      const exitOnBreak = Math.abs(z) >= STOP_Z;
      const exitOnTimeout = held >= MAX_HOLD_CANDLES;

      if (exitOnRevert || exitOnBreak || exitOnTimeout) {
        const { entryA, entryB, beta: entryBeta, side } = position;
        const exitA = aligned[i].a;
        const exitB = aligned[i].b;
        // LONG_SPREAD = comprado em A, vendido em beta unidades de B (entrou quando z<-ENTRY_Z, spread barato).
        const dirA = side === 'LONG_SPREAD' ? 1 : -1;
        const dirB = side === 'LONG_SPREAD' ? -1 : 1;
        const grossPnl = dirA * (exitA - entryA) + dirB * entryBeta * (exitB - entryB);
        const notionalA = entryA;
        const notionalB = Math.abs(entryBeta) * entryB;
        const totalNotional = notionalA + notionalB;
        const cost = (costA(entryA) * notionalA) + (costB(entryB) * notionalB);
        const netPnl = grossPnl - cost;
        const netPercent = (netPnl / totalNotional) * 100;

        trades.push({
          entryTime: aligned[position.entryIdx].time,
          exitTime: aligned[i].time,
          side,
          netPercent,
          exitReason: exitOnBreak ? 'STOP_BREAKDOWN' : exitOnTimeout ? 'TIMEOUT' : 'REVERT',
        });
        position = null;
      }
      continue;
    }

    if (z >= ENTRY_Z) {
      position = { side: 'SHORT_SPREAD', entryIdx: i, entryA: aligned[i].a, entryB: aligned[i].b, beta };
    } else if (z <= -ENTRY_Z) {
      position = { side: 'LONG_SPREAD', entryIdx: i, entryA: aligned[i].a, entryB: aligned[i].b, beta };
    }
  }

  return trades;
}

interface Row {
  pair: string;
  tf: string;
  candles: number;
  spanDays: number;
  trades: number;
  tradesPerDay: number;
  winRate: number;
  netResultPercent: number;
  avgNetPercent: number;
}

const rows: Row[] = [];

for (const [symA, symB] of PAIRS) {
  for (const tf of TIMEFRAMES) {
    const candlesA = loadCandles(symA, tf);
    const candlesB = loadCandles(symB, tf);
    if (!candlesA || !candlesB) continue;

    const aligned = alignByTime(candlesA, candlesB);
    if (aligned.length < WINDOW + 10) continue;

    const trades = backtestPair(aligned, symA, symB);
    const spanDays = (aligned[aligned.length - 1].time - aligned[0].time) / 86_400_000;
    const n = trades.length;
    const wins = trades.filter(t => t.netPercent >= 0).length;
    const netResultPercent = trades.reduce((s, t) => s + t.netPercent, 0);
    const avgNetPercent = n > 0 ? netResultPercent / n : 0;

    rows.push({
      pair: `${symA}/${symB}`, tf, candles: aligned.length, spanDays,
      trades: n, tradesPerDay: n / spanDays,
      winRate: n > 0 ? wins / n : 0,
      netResultPercent, avgNetPercent,
    });
  }
}

writeFileSync(join(RESULTS_DIR, 'pairs_backtest.json'), JSON.stringify(rows, null, 2));

const lines: string[] = [];
lines.push('# Arbitragem estatística (pairs trading / cointegração) — item 4 do redesenho (2026-08-16)');
lines.push('');
lines.push(`Parâmetros fixos (não otimizados): janela=${WINDOW} candles, entrada z=±${ENTRY_Z}, saída z=±${EXIT_Z}, stop z=±${STOP_Z}, hold máx=${MAX_HOLD_CANDLES} candles.`);
lines.push('Custo real (CostModel.ts) aplicado nas 2 pernas. Dado real em cache (`2026-08-05-taxa-base/data/`).');
lines.push('');
lines.push('| Par | TF | Candles | Dias | Trades | Trades/dia | Win% | %líq médio/trade | Resultado líq total % |');
lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  lines.push(
    `| ${r.pair} | ${r.tf} | ${r.candles} | ${r.spanDays.toFixed(0)} | ${r.trades} | ${r.tradesPerDay.toFixed(3)} | ${(r.winRate * 100).toFixed(1)}% | ${r.avgNetPercent.toFixed(3)}% | ${r.netResultPercent.toFixed(2)}% |`
  );
}
writeFileSync(join(RESULTS_DIR, 'pairs_backtest.md'), lines.join('\n') + '\n');

console.log(`Gravado: results/pairs_backtest.json e results/pairs_backtest.md (${rows.length} linhas)`);
