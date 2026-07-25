/**
 * Versão limpa do ensemble (opção "b" escolhida pelo Cleber depois do
 * resultado da seção 11.8 do AI_BRAIN_SPEC.md). Corrige os DOIS problemas
 * identificados na seção 11.7 do ensemble original
 * (`../2026-07-25-ensemble/ensemble-validate.ts`):
 *
 * 1. **Duplicação removida**: Rompimento Confirmado saiu do ensemble — a
 *    seção 11.7 mediu correlação 0,74 com Donchian (ambos rompimento de
 *    canal, o 2º só adiciona confirmação de volume). Ensemble agora combina
 *    só 3 sinais genuinamente distintos: Donchian, Cruzamento EMA+ADX,
 *    Reversão à Média.
 * 2. **Saída original preservada por arquétipo**: o ensemble anterior usava
 *    uma saída genérica única (stop 3×ATR trailing + "reversão de consenso")
 *    pra TODAS as posições, descartando a lógica de saída específica que cada
 *    arquétipo tinha (calibrada na seção 11.4). Aqui, quando o score combinado
 *    cruza o threshold de entrada, o arquétipo DOMINANTE naquele candle
 *    (maior |peso × força × direção| entre os 3) é identificado e a posição
 *    inteira usa o SL/TP/exitBlocks ORIGINAIS desse arquétipo (via
 *    `resolveTpSl`/`evaluateExitAt`, mesma função usada pelo BacktestEngine
 *    real) — só a ENTRADA é combinada, a gestão da posição depois de aberta
 *    é exatamente a que já foi validada individualmente.
 *
 * Resto do protocolo idêntico ao original: correlação reportada, peso por
 * regime (tabela declarada, não otimizada), grid de threshold × esquema de
 * peso, 3 janelas cronológicas × split treino/holdout, Deflated Sharpe Ratio
 * corrigindo pelo nº de candidatos testados.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-ensemble-v2/ensemble-validate-v2.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/ensemble-validate-v2.mjs && node /tmp/ensemble-validate-v2.mjs
 */
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { IndicatorCache, evaluateStrategyAt, evaluateExitAt } from '../../../src/app/services/strategy/StrategyEvaluator';
import { getPointValue, resolveTpSl, trailStopLoss, calculatePositionSize } from '../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent } from '../../CostModel';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOL = 'BTCUSDT';

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
  }
  return all;
}

// ---------------------------------------------------------------------------
// 1. Sinal por candle de cada arquétipo (só os 3 não-duplicados)
// ---------------------------------------------------------------------------

type Regime = 'TENDENCIA' | 'LATERAL' | 'INDEFINIDO';
function regimeAt(adx: number | null): Regime {
  if (adx === null) return 'INDEFINIDO';
  if (adx > 25) return 'TENDENCIA';
  if (adx < 18) return 'LATERAL';
  return 'INDEFINIDO';
}

interface SignalSeries {
  label: string;
  strategy: Strategy;
  dir: number[]; // -1 | 0 | +1 por candle
  force: number[]; // 0..1 (confidence/100)
}

function buildSignalSeries(strategy: Strategy, label: string, candles: Candle[], cache: IndicatorCache): SignalSeries {
  const dir = new Array(candles.length).fill(0);
  const force = new Array(candles.length).fill(0);
  for (let i = 0; i < candles.length; i++) {
    const r = evaluateStrategyAt(strategy, candles, i, cache);
    if (r.signal === 'BUY') { dir[i] = 1; force[i] = r.confidence / 100; }
    else if (r.signal === 'SELL') { dir[i] = -1; force[i] = r.confidence / 100; }
  }
  return { label, strategy, dir, force };
}

// ---------------------------------------------------------------------------
// 2. Correlação par-a-par (Pearson sobre a série de direção)
// ---------------------------------------------------------------------------

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    cov += da * db; varA += da * da; varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function reportCorrelationMatrix(signals: SignalSeries[]) {
  console.log('\n── Matriz de correlação dos 3 sinais de direção (Pearson, série completa) ──');
  console.log('   (>0.6 ou <-0.6 = sinais redundantes; combinar não soma robustez de verdade)\n');
  const header = '                          ' + signals.map(s => s.label.slice(0, 10).padStart(12)).join('');
  console.log(header);
  for (const rowSig of signals) {
    const cells = signals.map(colSig => pearson(rowSig.dir, colSig.dir).toFixed(2).padStart(12));
    console.log(rowSig.label.slice(0, 26).padEnd(26) + cells.join(''));
  }
}

// ---------------------------------------------------------------------------
// 3. Combinação ponderada por regime + identificação do arquétipo dominante
// ---------------------------------------------------------------------------

// Pesos declarados, NÃO otimizados por busca (mesma disciplina da v1).
// Ordem: [Donchian, Cruzamento EMA+ADX, Reversão à Média]
const REGIME_WEIGHTS: Record<Regime, number[]> = {
  TENDENCIA: [1.0, 1.0, 0.3],
  LATERAL: [0.3, 0.3, 1.0],
  INDEFINIDO: [0.5, 0.5, 0.5],
};
const FLAT_WEIGHTS = [1, 1, 1];

interface CombinedPoint { score: number; dominant: number } // dominant = índice do sinal com maior |contribuição|

function combinedSeries(signals: SignalSeries[], adx: (number | null)[], weightScheme: 'regime' | 'flat'): CombinedPoint[] {
  const n = signals[0].dir.length;
  const out: CombinedPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const weights = weightScheme === 'flat' ? FLAT_WEIGHTS : REGIME_WEIGHTS[regimeAt(adx[i])];
    let num = 0, den = 0, bestAbs = -1, dominant = 0;
    for (let k = 0; k < signals.length; k++) {
      const contrib = weights[k] * signals[k].force[i] * signals[k].dir[i];
      num += contrib; den += weights[k];
      if (Math.abs(contrib) > bestAbs) { bestAbs = Math.abs(contrib); dominant = k; }
    }
    out[i] = { score: den > 0 ? num / den : 0, dominant };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Backtest do sinal combinado, saída DELEGADA ao arquétipo dominante na
//    entrada — não mais uma saída genérica única pra todo o ensemble.
// ---------------------------------------------------------------------------

interface EnsembleTrade { profitPercent: number; dominantLabel: string }

function backtestCombinedSignal(
  candles: Candle[],
  combined: CombinedPoint[],
  threshold: number,
  atrSeries: (number | null)[],
  signals: SignalSeries[],
  cache: IndicatorCache,
  roundTripCostPercent: number
): EnsembleTrade[] {
  const trades: EnsembleTrade[] = [];
  const pointValue = getPointValue(SYMBOL);
  const warmup = 60;
  let equity = 10000;
  let openPosition: null | {
    side: 'LONG' | 'SHORT'; entryPrice: number; sl: number; originalSl: number; tp: number | null;
    tradeCapital: number; dominantIdx: number;
  } = null;

  for (let i = warmup; i < candles.length; i++) {
    const candle = candles[i];

    if (openPosition) {
      const dominantStrategy = signals[openPosition.dominantIdx].strategy;

      if (dominantStrategy.trailingStop) {
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, candle.close);
      }
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      // Saída por regra do PRÓPRIO arquétipo que abriu a posição (exitBlocks
      // originais, calibrados na seção 11.4) — não mais "reversão de consenso" genérica.
      const ruleExit = evaluateExitAt(dominantStrategy, candles, i, cache);

      if (hitSl || hitTp || ruleExit) {
        const exitPrice = hitSl ? openPosition.sl : hitTp ? openPosition.tp! : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPercent * 100;
        const profit = (openPosition.tradeCapital * profitPercent) / 100;
        equity += profit;
        trades.push({ profitPercent, dominantLabel: signals[openPosition.dominantIdx].label });
        openPosition = null;
      }
      continue;
    }

    const point = combined[i];
    if (Math.abs(point.score) < threshold) continue;
    const side: 'LONG' | 'SHORT' = point.score > 0 ? 'LONG' : 'SHORT';
    const dominantStrategy = signals[point.dominant].strategy;
    const entryPrice = candle.close;
    const atrAtEntry = atrSeries[i];
    const { sl, tp } = resolveTpSl(dominantStrategy, side, entryPrice, pointValue, atrAtEntry);
    const tradeCapital = calculatePositionSize({
      currentBalance: equity, allocatedCapital: equity,
      riskPerTradePercent: dominantStrategy.positionSizePercent ?? 1, riskProfile: dominantStrategy.riskProfile ?? 'MODERATE',
    });
    openPosition = { side, entryPrice, sl, originalSl: sl, tp, tradeCapital, dominantIdx: point.dominant };
  }

  return trades;
}

// ---------------------------------------------------------------------------
// 5. Janelas cronológicas + validação DSR (mesmo protocolo da v1)
// ---------------------------------------------------------------------------

function threeWindows<T>(arr: T[]): Array<{ trainRange: [number, number]; holdoutRange: [number, number] }> {
  const chunk = Math.floor(arr.length / 3);
  const windows: Array<{ trainRange: [number, number]; holdoutRange: [number, number] }> = [];
  for (let w = 0; w < 3; w++) {
    const start = w * chunk;
    const end = w === 2 ? arr.length : (w + 1) * chunk;
    const splitAt = start + Math.floor((end - start) * 0.7);
    windows.push({ trainRange: [start, splitAt], holdoutRange: [Math.max(start, splitAt - 60), end] });
  }
  return windows;
}

interface EnsembleCandidate { label: string; weightScheme: 'regime' | 'flat'; threshold: number }
interface CandidateResult { label: string; trainSharpe: number; holdoutReturns: number[]; holdoutSharpe: number; holdoutNetPct: number; dominantCounts: Record<string, number> }

async function main() {
  console.log('\n═══ Ensemble v2 (sem duplicação, saída original por arquétipo) — Deflated Sharpe Ratio ═══\n');
  console.log('Buscando dados reais (Binance, BTCUSDT 1h, paginado)...\n');

  const candles = await fetchBinancePaginated(SYMBOL, '1h', 27);
  console.log(`1h: ${candles.length} candles\n`);

  const cache = new IndicatorCache(candles);
  const strategies = ['1', '2', '3'].map(id => PRESET_STRATEGIES.find(s => s.id === id)!);
  const labels = ['Donchian', 'Cruzamento EMA+ADX', 'Reversão à Média'];

  const signals = strategies.map((s, k) => buildSignalSeries(s, labels[k], candles, cache));
  reportCorrelationMatrix(signals);

  const adx = cache.get('ADX', 14);
  const atr = cache.get('ATR', 14);
  const pointValue = getPointValue(SYMBOL);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPercent = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;

  const windows = threeWindows(candles);

  const combinedRegime = combinedSeries(signals, adx, 'regime');
  const combinedFlat = combinedSeries(signals, adx, 'flat');

  const thresholds = [0.25, 0.35, 0.45, 0.55];
  const candidates: EnsembleCandidate[] = [];
  for (const t of thresholds) {
    candidates.push({ label: `peso-por-regime threshold=${t}`, weightScheme: 'regime', threshold: t });
    candidates.push({ label: `peso-plano threshold=${t}`, weightScheme: 'flat', threshold: t });
  }

  function evaluate(cand: EnsembleCandidate): CandidateResult {
    const combined = cand.weightScheme === 'regime' ? combinedRegime : combinedFlat;
    const trainReturns: number[] = [];
    const holdoutReturns: number[] = [];
    const dominantCounts: Record<string, number> = {};
    for (const w of windows) {
      const trainCandles = candles.slice(w.trainRange[0], w.trainRange[1]);
      const trainCombined = combined.slice(w.trainRange[0], w.trainRange[1]);
      const trainAtr = atr.slice(w.trainRange[0], w.trainRange[1]);
      trainReturns.push(...backtestCombinedSignal(trainCandles, trainCombined, cand.threshold, trainAtr, signals, cache, roundTripCostPercent).map(t => t.profitPercent));

      const holdoutCandles = candles.slice(w.holdoutRange[0], w.holdoutRange[1]);
      const holdoutCombined = combined.slice(w.holdoutRange[0], w.holdoutRange[1]);
      const holdoutAtr = atr.slice(w.holdoutRange[0], w.holdoutRange[1]);
      const holdoutTrades = backtestCombinedSignal(holdoutCandles, holdoutCombined, cand.threshold, holdoutAtr, signals, cache, roundTripCostPercent);
      holdoutReturns.push(...holdoutTrades.map(t => t.profitPercent));
      for (const t of holdoutTrades) dominantCounts[t.dominantLabel] = (dominantCounts[t.dominantLabel] || 0) + 1;
    }
    const holdoutNetPct = holdoutReturns.reduce((a, b) => a + b, 0);
    return {
      label: cand.label,
      trainSharpe: sharpeRatio(trainReturns),
      holdoutReturns,
      holdoutSharpe: sharpeRatio(holdoutReturns),
      holdoutNetPct,
      dominantCounts,
    };
  }

  const results = candidates.map(evaluate);
  console.log('\n── Candidatos (threshold × esquema de peso) ──');
  for (const r of results) {
    console.log(`  ${r.label.padEnd(28)} treino Sharpe=${r.trainSharpe.toFixed(3).padStart(7)}  holdout n=${r.holdoutReturns.length.toString().padStart(3)}  holdout Sharpe=${r.holdoutSharpe.toFixed(3).padStart(7)}  retorno agregado=${r.holdoutNetPct >= 0 ? '+' : ''}${r.holdoutNetPct.toFixed(2)}%`);
  }

  const champion = results.reduce((best, r) => (r.trainSharpe > best.trainSharpe ? r : best));
  const trainSharpes = results.map(r => r.trainSharpe);
  const meanTrain = trainSharpes.reduce((a, b) => a + b, 0) / trainSharpes.length;
  const varianceAcrossTrials = trainSharpes.reduce((a, s) => a + (s - meanTrain) ** 2, 0) / trainSharpes.length;
  const sr0 = expectedMaxSharpeUnderNull(varianceAcrossTrials, candidates.length);
  const dsr = deflatedSharpeRatio(champion.holdoutSharpe, sr0, champion.holdoutReturns.length);

  console.log(`\n── Campeão no TREINO: ${champion.label} ──`);
  console.log(`  Holdout (nunca visto): n=${champion.holdoutReturns.length}  Sharpe=${champion.holdoutSharpe.toFixed(3)}  retorno agregado=${champion.holdoutNetPct >= 0 ? '+' : ''}${champion.holdoutNetPct.toFixed(2)}%`);
  console.log(`  Trades holdout por arquétipo dominante:`, champion.dominantCounts);
  console.log(`  Sharpe esperado só por acaso (SR0, ${candidates.length} trials): ${sr0.toFixed(3)}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95% — não dá pra distinguir de acaso' : '❌ abaixo até do "mais provável que seja acaso do que edge"'}`);

  console.log('\n═══ Fim da validação do ensemble v2. Mesmo critério das seções anteriores: DSR≥95% é o único piso aceito como "edge provável". ═══\n');
}

main().catch(err => {
  console.error('Erro na validação do ensemble v2:', err);
  process.exit(1);
});
