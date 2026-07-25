/**
 * Ensemble de sinais — próximo passo pedido pelo Cleber depois da seção 11.6
 * de research/AI_BRAIN_SPEC.md. Testa se COMBINAR os 4 arquétipos já
 * calibrados (Donchian, Cruzamento EMA+ADX, Reversão à Média, Rompimento
 * Confirmado) com peso por regime produz um resultado que passa o piso de
 * DSR≥95% que cada um sozinho falhou na seção 11.5.
 *
 * Metodologia (mesma disciplina de grid-search.ts):
 * 1. Cada arquétipo gera um sinal por candle (`direção`×`força`), não mais
 *    ligado/desligado por escolha do usuário — evaluateStrategyAt roda os 4
 *    em paralelo sobre a MESMA série (BTCUSDT 1h, pra alinhar no tempo).
 * 2. Matriz de correlação dos 4 sinais de direção — checagem EXPLÍCITA antes
 *    de combinar (seção 11.6, item 3): dois sinais correlacionados >0.6 não
 *    somam robustez, duplicam ruído. Reportado, não usado para descartar
 *    automaticamente nesta rodada (decisão de descarte fica com o Cleber se
 *    aparecer correlação alta).
 * 3. Peso por regime (ADX real do candle, mesmo corte do MarketScoreEngine:
 *    >25 TENDÊNCIA, <18 LATERAL, senão INDEFINIDO) — tabela declarada abaixo,
 *    NÃO otimizada por busca (otimizar peso teria o mesmo risco de overfitting
 *    que a seção 8/11.5 já existe pra proteger contra).
 * 4. Threshold de entrada testado em grid pequeno × 2 esquemas de peso
 *    (por regime vs. plano/igual) = candidatos, mesmo protocolo de 3 janelas
 *    cronológicas não sobrepostas × split treino(70%)/holdout(30%) do
 *    grid-search.ts, com Deflated Sharpe Ratio corrigindo pelo nº de
 *    candidatos testados.
 * 5. Gestão de risco do ensemble: stop 3×ATR trailing, SEM alvo fixo
 *    (TRAILING_ONLY) — média simplificada dos multiplicadores já calibrados
 *    dos 4 arquétipos (seção 11.4: Donchian 4×, EMA+ADX 4.5×), declarada como
 *    simplificação para isolar o efeito da COMBINAÇÃO de sinais, não o efeito
 *    de otimizar a saída de novo (já feito na seção 11.4).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-ensemble/ensemble-validate.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/ensemble-validate.mjs && node /tmp/ensemble-validate.mjs
 */
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { IndicatorCache, evaluateStrategyAt } from '../../../src/app/services/strategy/StrategyEvaluator';
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
// 1. Sinal por candle de cada arquétipo
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
  return { label, dir, force };
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
  console.log('\n── Matriz de correlação dos 4 sinais de direção (Pearson, série completa) ──');
  console.log('   (>0.6 ou <-0.6 = sinais redundantes; combinar não soma robustez de verdade)\n');
  const header = '                          ' + signals.map(s => s.label.slice(0, 10).padStart(12)).join('');
  console.log(header);
  for (const rowSig of signals) {
    const cells = signals.map(colSig => pearson(rowSig.dir, colSig.dir).toFixed(2).padStart(12));
    console.log(rowSig.label.slice(0, 26).padEnd(26) + cells.join(''));
  }
}

// ---------------------------------------------------------------------------
// 3. Combinação ponderada por regime
// ---------------------------------------------------------------------------

// Pesos declarados, NÃO otimizados por busca (ver cabeçalho do arquivo).
// Ordem: [Donchian, Cruzamento EMA+ADX, Reversão à Média, Rompimento Confirmado]
const REGIME_WEIGHTS: Record<Regime, number[]> = {
  TENDENCIA: [1.0, 1.0, 0.3, 0.8],
  LATERAL: [0.3, 0.3, 1.0, 0.5],
  INDEFINIDO: [0.5, 0.5, 0.5, 0.5],
};
const FLAT_WEIGHTS = [1, 1, 1, 1];

function combinedScoreSeries(signals: SignalSeries[], adx: (number | null)[], weightScheme: 'regime' | 'flat'): number[] {
  const n = signals[0].dir.length;
  const scores = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const weights = weightScheme === 'flat' ? FLAT_WEIGHTS : REGIME_WEIGHTS[regimeAt(adx[i])];
    let num = 0, den = 0;
    for (let k = 0; k < signals.length; k++) {
      num += weights[k] * signals[k].force[i] * signals[k].dir[i];
      den += weights[k];
    }
    scores[i] = den > 0 ? num / den : 0;
  }
  return scores;
}

// ---------------------------------------------------------------------------
// 4. Backtest do sinal combinado (loop custom — não é 1 Strategy só, é a
//    combinação; reaproveita TradeSizing/CostModel, mesma lógica de custo e
//    gestão de posição do BacktestEngine.ts)
// ---------------------------------------------------------------------------

const ENSEMBLE_RISK: Pick<Strategy, 'stopLossMode' | 'atrStopMultiplier' | 'takeProfitMode' | 'trailingStop' | 'stopLoss' | 'takeProfit' | 'riskProfile' | 'positionSizePercent'> = {
  stopLossMode: 'ATR',
  atrStopMultiplier: 3, // média simplificada dos multiplicadores calibrados na seção 11.4 — ver cabeçalho
  takeProfitMode: 'TRAILING_ONLY',
  trailingStop: true,
  stopLoss: 0,
  takeProfit: 0,
  riskProfile: 'MODERATE',
  positionSizePercent: 1,
};

interface EnsembleTrade { profitPercent: number }

function backtestCombinedSignal(
  candles: Candle[],
  scores: number[],
  threshold: number,
  atrSeries: (number | null)[],
  roundTripCostPercent: number
): EnsembleTrade[] {
  const trades: EnsembleTrade[] = [];
  const pointValue = getPointValue(SYMBOL);
  const warmup = 60;
  let equity = 10000;
  let openPosition: null | { side: 'LONG' | 'SHORT'; entryPrice: number; sl: number; originalSl: number; tradeCapital: number } = null;

  const pseudoStrategy = { ...ENSEMBLE_RISK } as Strategy;

  for (let i = warmup; i < candles.length; i++) {
    const candle = candles[i];

    if (openPosition) {
      if (pseudoStrategy.trailingStop) {
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, candle.close);
      }
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      // Saída por reversão de consenso: o combinado virou contra a posição
      // além de um piso pequeno de histerese (evita fechar por ruído de sinal
      // em 0.00..0.05, só fecha quando o consenso realmente inverteu).
      const consensusFlipped = openPosition.side === 'LONG' ? scores[i] <= -0.1 : scores[i] >= 0.1;

      if (hitSl || consensusFlipped) {
        const exitPrice = hitSl ? openPosition.sl : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPercent * 100;
        const profit = (openPosition.tradeCapital * profitPercent) / 100;
        equity += profit;
        trades.push({ profitPercent });
        openPosition = null;
      }
      continue;
    }

    const score = scores[i];
    if (Math.abs(score) < threshold) continue;
    const side: 'LONG' | 'SHORT' = score > 0 ? 'LONG' : 'SHORT';
    const entryPrice = candle.close;
    const atrAtEntry = atrSeries[i];
    const { sl } = resolveTpSl(pseudoStrategy, side, entryPrice, pointValue, atrAtEntry);
    const tradeCapital = calculatePositionSize({
      currentBalance: equity, allocatedCapital: equity,
      riskPerTradePercent: pseudoStrategy.positionSizePercent, riskProfile: pseudoStrategy.riskProfile,
    });
    openPosition = { side, entryPrice, sl, originalSl: sl, tradeCapital };
  }

  return trades;
}

// ---------------------------------------------------------------------------
// 5. Janelas cronológicas + validação DSR (mesmo protocolo de grid-search.ts)
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
interface CandidateResult { label: string; trainSharpe: number; holdoutReturns: number[]; holdoutSharpe: number; holdoutNetPct: number }

async function main() {
  console.log('\n═══ Ensemble de sinais — validação com Deflated Sharpe Ratio (seção 11.6) ═══\n');
  console.log('Buscando dados reais (Binance, BTCUSDT 1h, paginado)...\n');

  const candles = await fetchBinancePaginated(SYMBOL, '1h', 27);
  console.log(`1h: ${candles.length} candles\n`);

  const cache = new IndicatorCache(candles);
  const strategies = ['1', '2', '3', '4'].map(id => PRESET_STRATEGIES.find(s => s.id === id)!);
  const labels = ['Donchian', 'Cruzamento EMA+ADX', 'Reversão à Média', 'Rompimento Confirmado'];

  const signals = strategies.map((s, k) => buildSignalSeries(s, labels[k], candles, cache));
  reportCorrelationMatrix(signals);

  const adx = cache.get('ADX', 14);
  const atr = cache.get('ATR', 14);
  const pointValue = getPointValue(SYMBOL);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPercent = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;

  const windows = threeWindows(candles);

  const scoresRegime = combinedScoreSeries(signals, adx, 'regime');
  const scoresFlat = combinedScoreSeries(signals, adx, 'flat');

  const thresholds = [0.25, 0.35, 0.45, 0.55];
  const candidates: EnsembleCandidate[] = [];
  for (const t of thresholds) {
    candidates.push({ label: `peso-por-regime threshold=${t}`, weightScheme: 'regime', threshold: t });
    candidates.push({ label: `peso-plano threshold=${t}`, weightScheme: 'flat', threshold: t });
  }

  function evaluate(cand: EnsembleCandidate): CandidateResult {
    const scores = cand.weightScheme === 'regime' ? scoresRegime : scoresFlat;
    const trainReturns: number[] = [];
    const holdoutReturns: number[] = [];
    for (const w of windows) {
      const trainCandles = candles.slice(w.trainRange[0], w.trainRange[1]);
      const trainScores = scores.slice(w.trainRange[0], w.trainRange[1]);
      const trainAtr = atr.slice(w.trainRange[0], w.trainRange[1]);
      trainReturns.push(...backtestCombinedSignal(trainCandles, trainScores, cand.threshold, trainAtr, roundTripCostPercent).map(t => t.profitPercent));

      const holdoutCandles = candles.slice(w.holdoutRange[0], w.holdoutRange[1]);
      const holdoutScores = scores.slice(w.holdoutRange[0], w.holdoutRange[1]);
      const holdoutAtr = atr.slice(w.holdoutRange[0], w.holdoutRange[1]);
      holdoutReturns.push(...backtestCombinedSignal(holdoutCandles, holdoutScores, cand.threshold, holdoutAtr, roundTripCostPercent).map(t => t.profitPercent));
    }
    const holdoutNetPct = holdoutReturns.reduce((a, b) => a + b, 0);
    return {
      label: cand.label,
      trainSharpe: sharpeRatio(trainReturns),
      holdoutReturns,
      holdoutSharpe: sharpeRatio(holdoutReturns),
      holdoutNetPct,
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
  console.log(`  Sharpe esperado só por acaso (SR0, ${candidates.length} trials): ${sr0.toFixed(3)}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95% — não dá pra distinguir de acaso' : '❌ abaixo até do "mais provável que seja acaso do que edge"'}`);

  console.log('\n═══ Fim da validação do ensemble. Mesmo critério da seção 11.5: DSR≥95% é o único piso aceito como "edge provável". ═══\n');
}

main().catch(err => {
  console.error('Erro na validação do ensemble:', err);
  process.exit(1);
});
