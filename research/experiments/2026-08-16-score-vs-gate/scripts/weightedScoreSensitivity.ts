/**
 * Item 2 do redesenho do cérebro — continuação (alternativa (b) escolhida
 * pelo Cleber em 2026-08-16, seguindo o item 1 da lista de alternativas do
 * `results/README.md`): "pesos não-uniformes por bloco".
 *
 * A medição anterior (`compare.ts`) usou pesos IGUAIS entre os blocos de
 * entrada — hipótese descartada: um bloco fraco "carrega" um bloco forte até
 * o piso, destravando entradas ruins. Este script testa pesos DIFERENTES
 * entre os 2 blocos de entrada dos presets que têm exatamente 2 (Donchian
 * tem só 1 bloco — pesar é moot, fora de escopo aqui).
 *
 * DISCIPLINA CONTRA P-HACKING: pesos não são escolhidos olhando o resultado
 * completo. Cada série candle é dividida cronologicamente em TREINO (60%
 * inicial) e TESTE (40% final, sem overlap, sem embaralhar — respeita a
 * ordem temporal). O peso vencedor é escolhido só com TREINO (média de
 * líquido% entre os pares símbolo×tf desse preset, amostra mínima 5 trades),
 * depois aplicado (congelado) em TESTE e comparado contra pesos iguais e
 * contra o gate binário, também em TESTE. Só um resultado bom em TESTE (dado
 * nunca visto na escolha do peso) conta como evidência real — replica a
 * lógica de walk-forward que o projeto já exige (AI_BRAIN_SPEC.md seção 8).
 *
 * Reaproveita `scoreBlock`/`evaluateStrategyAt`(filtros) de
 * StrategyEvaluator.ts — não modifica esse arquivo, só implementa uma versão
 * local com pesos explícitos por índice de bloco de entrada.
 *
 * Uso: npx tsx research/experiments/2026-08-16-score-vs-gate/scripts/weightedScoreSensitivity.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IndicatorCache, scoreBlock, evaluateExitAt } from '../../../../src/app/services/strategy/StrategyEvaluator';
import { calculatePositionSize, getPointValue, trailStopLoss, resolveTpSl } from '../../../../src/app/services/strategy/TradeSizing';
import { runBacktest } from '../../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';
import type { Strategy, OperatorType } from '../../../../src/app/types/strategy';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO', EURUSD: 'FOREX_MAJOR', XAUUSD: 'COMMODITY', XAGUSD: 'COMMODITY',
  US30: 'INDEX', NAS100: 'INDEX', SPX500: 'INDEX', GER40: 'INDEX',
};

const TIMEFRAMES = ['15m', '1h'];
const SCORE_THRESHOLD = 60; // piso intermediário — 40/50 mostraram pior resultado, 70 converge quase ao gate
const TRAIN_FRACTION = 0.6;
const WEIGHT_SPLITS: [number, number][] = [[0.9, 0.1], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.1, 0.9]];

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles ?? null;
}

/** Score contínuo com pesos explícitos por bloco de entrada (generalização local de evaluateStrategyScoreAt). */
function weightedScoreAt(strategy: Strategy, candles: Candle[], i: number, cache: IndicatorCache, weights: number[]): { score: number; signal: 'BUY' | 'SELL' | null } {
  const activeFilters = strategy.filterBlocks.filter(b => b.enabled);
  for (const block of activeFilters) {
    // filtros usados nestes presets são só ABOVE/BELOW — scoreBlock retorna 100/0, equivalente ao gate booleano.
    if (scoreBlock(block, cache, i) < 100) return { score: 0, signal: null };
  }

  const activeEntry = strategy.entryBlocks.filter(b => b.enabled);
  if (activeEntry.length !== weights.length) return { score: 0, signal: null };

  const blockScores = activeEntry.map(block => scoreBlock(block, cache, i));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const score = blockScores.reduce((sum, s, idx) => sum + s * weights[idx], 0) / weightSum;

  let signal: 'BUY' | 'SELL';
  if (strategy.entrySignal) {
    signal = strategy.entrySignal;
  } else {
    const bearishOps: OperatorType[] = ['CROSS_BELOW', 'BELOW', 'FALLING'];
    const bearishCount = activeEntry.filter(b => bearishOps.includes(b.operator)).length;
    signal = bearishCount > activeEntry.length / 2 ? 'SELL' : 'BUY';
  }
  if (strategy.direction === 'LONG' && signal === 'SELL') return { score, signal: null };
  if (strategy.direction === 'SHORT' && signal === 'BUY') return { score, signal: null };

  return { score, signal };
}

function runWeightedBacktest(candles: Candle[], strategy: Strategy, symbol: string, roundTripCostPercent: number, weights: number[]) {
  const cache = new IndicatorCache(candles);
  const trades: { profitPercent: number }[] = [];
  let equity = 10000;
  let openPosition: null | { side: 'LONG' | 'SHORT'; entryPrice: number; tp: number | null; sl: number; originalSl: number; tradeCapital: number } = null;
  const pointValue = getPointValue(symbol);
  const warmup = 60;

  for (let i = warmup; i < candles.length; i++) {
    if (openPosition) {
      const candle = candles[i];
      if (strategy.trailingStop) {
        const prevClose = candles[i - 1].close;
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, prevClose);
      }
      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;
      const ruleExit = evaluateExitAt(strategy, candles, i, cache);
      if (hitTp || hitSl || ruleExit) {
        const exitPrice = hitSl ? openPosition.sl : hitTp ? openPosition.tp! : candle.close;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPercent * 100;
        equity += (openPosition.tradeCapital * profitPercent) / 100;
        trades.push({ profitPercent });
        openPosition = null;
      }
      continue;
    }

    const result = weightedScoreAt(strategy, candles, i, cache, weights);
    if (result.score < SCORE_THRESHOLD || !result.signal) continue;

    const side: 'LONG' | 'SHORT' = result.signal === 'BUY' ? 'LONG' : 'SHORT';
    const entryPrice = candles[i].close;
    const atrAtEntry = cache.get('ATR', 14)[i];
    const { tp, sl, slDistance } = resolveTpSl(strategy, side, entryPrice, pointValue, atrAtEntry);
    const stopDistancePercent = slDistance / entryPrice;
    const tradeCapital = calculatePositionSize({
      currentBalance: equity, allocatedCapital: equity, riskPerTradePercent: strategy.positionSizePercent,
      riskProfile: strategy.riskProfile, stopDistancePercent,
    });
    openPosition = { side, entryPrice, tp, sl, originalSl: sl, tradeCapital };
  }

  return trades;
}

interface Combo { preset: string; symbol: string; tf: string; trainCandles: Candle[]; testCandles: Candle[]; roundTripCostPercent: number; spanDaysTest: number }

const TWO_BLOCK_PRESETS = PRESET_STRATEGIES.filter(p => p.entryBlocks.filter(b => b.enabled).length === 2);

const combos: Combo[] = [];
for (const preset of TWO_BLOCK_PRESETS) {
  for (const symbol of Object.keys(ASSET_CLASS)) {
    for (const tf of TIMEFRAMES) {
      const candles = loadCandles(symbol, tf);
      if (!candles || candles.length < 200) continue;
      const splitIdx = Math.floor(candles.length * TRAIN_FRACTION);
      const trainCandles = candles.slice(0, splitIdx);
      const testCandles = candles.slice(splitIdx);
      const assetClass = ASSET_CLASS[symbol];
      const pointValue = getPointValue(symbol);
      const priceLevel = candles[candles.length - 1].close;
      const roundTripCostPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
      const spanDaysTest = (testCandles[testCandles.length - 1].time - testCandles[0].time) / 86_400_000;
      combos.push({ preset: preset.name, symbol, tf, trainCandles, testCandles, roundTripCostPercent, spanDaysTest });
    }
  }
}

interface ResultRow {
  preset: string;
  chosenWeight: [number, number];
  trainAvgNetPercent: number;
  nCombos: number;
  testAvgNetPercentChosen: number;
  testAvgNetPercentUniform: number;
  testAvgNetPercentGate: number;
  testWinsVsUniform: number;
  testWinsVsGate: number;
}

const resultRows: ResultRow[] = [];

for (const preset of TWO_BLOCK_PRESETS) {
  const presetCombos = combos.filter(c => c.preset === preset.name);
  if (presetCombos.length === 0) continue;

  // 1) escolhe peso só com TREINO
  let bestWeight: [number, number] = [0.5, 0.5];
  let bestTrainAvg = -Infinity;
  for (const weight of WEIGHT_SPLITS) {
    const nets: number[] = [];
    for (const c of presetCombos) {
      const trades = runWeightedBacktest(c.trainCandles, preset, c.symbol, c.roundTripCostPercent, weight);
      if (trades.length < 5) continue;
      nets.push(trades.reduce((s, t) => s + t.profitPercent, 0));
    }
    if (nets.length === 0) continue;
    const avg = nets.reduce((s, x) => s + x, 0) / nets.length;
    if (avg > bestTrainAvg) { bestTrainAvg = avg; bestWeight = weight; }
  }

  // 2) aplica peso escolhido (congelado) em TESTE, compara com uniforme e com gate — dado nunca visto na escolha
  const chosenTestNets: number[] = [];
  const uniformTestNets: number[] = [];
  const gateTestNets: number[] = [];
  let winsVsUniform = 0, winsVsGate = 0, comparableCombos = 0;

  for (const c of presetCombos) {
    const chosenTrades = runWeightedBacktest(c.testCandles, preset, c.symbol, c.roundTripCostPercent, bestWeight);
    const uniformTrades = runWeightedBacktest(c.testCandles, preset, c.symbol, c.roundTripCostPercent, [0.5, 0.5]);
    const gate = runBacktest(c.testCandles, preset, c.symbol, 'both', 10000, c.roundTripCostPercent);
    const gateNet = gate.trades.reduce((s, t) => s + t.profitPercent, 0);

    if (chosenTrades.length < 3 && uniformTrades.length < 3) continue;
    comparableCombos++;
    const chosenNet = chosenTrades.reduce((s, t) => s + t.profitPercent, 0);
    const uniformNet = uniformTrades.reduce((s, t) => s + t.profitPercent, 0);
    chosenTestNets.push(chosenNet);
    uniformTestNets.push(uniformNet);
    gateTestNets.push(gateNet);
    if (chosenNet > uniformNet) winsVsUniform++;
    if (chosenNet > gateNet) winsVsGate++;
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

  resultRows.push({
    preset: preset.name,
    chosenWeight: bestWeight,
    trainAvgNetPercent: bestTrainAvg,
    nCombos: comparableCombos,
    testAvgNetPercentChosen: avg(chosenTestNets),
    testAvgNetPercentUniform: avg(uniformTestNets),
    testAvgNetPercentGate: avg(gateTestNets),
    testWinsVsUniform: winsVsUniform,
    testWinsVsGate: winsVsGate,
  });
}

writeFileSync(join(RESULTS_DIR, 'weighted_score_sensitivity.json'), JSON.stringify(resultRows, null, 2));

const lines: string[] = [];
lines.push('# Pesos não-uniformes por bloco + validação treino/teste — item 2 do redesenho (continuação)');
lines.push('');
lines.push(`Piso de score fixo em ${SCORE_THRESHOLD}. Split cronológico ${TRAIN_FRACTION * 100}% treino / ${(1 - TRAIN_FRACTION) * 100}% teste por símbolo×tf. Peso escolhido só com TREINO (grade [0.9/0.1..0.1/0.9] entre os 2 blocos de entrada), aplicado congelado em TESTE (dado nunca visto na escolha).`);
lines.push('');
lines.push('| Preset | Peso escolhido (treino) | Líq% médio treino | Combos comparáveis (teste) | Líq% médio teste (peso escolhido) | Líq% médio teste (pesos iguais) | Líq% médio teste (gate binário) | Vitórias vs. uniforme | Vitórias vs. gate |');
lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|');
for (const r of resultRows) {
  lines.push(
    `| ${r.preset} | ${r.chosenWeight[0]}/${r.chosenWeight[1]} | ${r.trainAvgNetPercent.toFixed(2)}% | ${r.nCombos} | ${r.testAvgNetPercentChosen.toFixed(2)}% | ${r.testAvgNetPercentUniform.toFixed(2)}% | ${r.testAvgNetPercentGate.toFixed(2)}% | ${r.testWinsVsUniform}/${r.nCombos} | ${r.testWinsVsGate}/${r.nCombos} |`
  );
}
writeFileSync(join(RESULTS_DIR, 'weighted_score_sensitivity.md'), lines.join('\n') + '\n');

console.log(`Gravado: results/weighted_score_sensitivity.md/.json (${resultRows.length} presets)`);
