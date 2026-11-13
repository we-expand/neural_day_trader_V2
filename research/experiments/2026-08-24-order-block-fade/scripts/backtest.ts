/**
 * Backtest de "Order Block Fade" (2026-08-24) — ver ../hypothesis.md pra
 * regra completa e disciplina metodológica.
 *
 * Motor de detecção de zona: `detectOrderBlocks` de produção
 * (src/app/services/smc/orderBlocks.ts), SEM alteração. Estrutura BOS/CHoCH:
 * cópia local corrigida quanto a look-ahead (./structureCausal.ts) — ver
 * achado na hipótese.
 *
 * Simulação: candle a candle, causal (só usa zonas já formadas e ainda não
 * mitigadas ATÉ o candle corrente). Entrada = fechamento dentro da zona
 * (que por definição de `orderBlocks.ts` é também o evento de mitigação —
 * cada zona gera no máximo 1 trade). SL além da borda oposta + 0.5x ATR14.
 * Alvo: varredura de R:R (1, 1.5, 2, 3). Simulação bar-a-bar até SL/TP,
 * empate no mesmo candle resolvido a favor do SL (conservador).
 *
 * Validação: split treino/holdout com embargo (research/DataSplit.ts, 3
 * janelas), R:R escolhido pelo TREINO avaliado no HOLDOUT, DSR
 * (research/DeflatedSharpe.ts) corrigindo pelas combinações R:R testadas.
 *
 * Uso: npx tsx research/experiments/2026-08-24-order-block-fade/scripts/backtest.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectSwingPoints, averageRange } from '../../../../src/app/services/smc/marketStructure';
import type { Candle } from '../../../../src/app/services/smc/types';
import { detectStructureEventsCausal } from './structureCausal';
import { detectOrderBlocksCausal, type CausalZone } from './zonesCausal';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import { splitWithEmbargo } from '../../../DataSplit';
import { sharpeRatio, deflatedSharpeRatio, expectedMaxSharpeUnderNull } from '../../../DeflatedSharpe';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO', XBNUSD: 'CRYPTO', EURUSD: 'FOREX_MAJOR', XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY', US30: 'INDEX', NAS100: 'INDEX', SPX500: 'INDEX', GER40: 'INDEX',
};

const TIMEFRAMES = ['5m', '15m', '1h'];
const RR_LEVELS = [1, 1.5, 2, 3];
const SWING_LOOKBACK = 2;
const SL_BUFFER_ATR_MULT = 0.5;
const MAX_HOLD_BARS = 500;

interface TradeResult {
  entryIndex: number;
  direction: 'BUY' | 'SELL';
  rr: number;
  netReturnPercent: number;
  win: boolean;
  closedByTimeout: boolean;
}

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles.map((c: any) => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 }));
}

/**
 * Simula todos os trades de Order Block Fade sobre uma série causal
 * (zonas e eventos de estrutura já computados sobre TODA a série candles,
 * mas respeitando timestamp — ver hypothesis.md sobre por que isso não
 * vaza futuro: mitigatedAt de uma zona só depende de candles entre sua
 * formação e aquele instante, nunca de candles posteriores a ele).
 */
function simulateTrades(candles: Candle[], zones: CausalZone[], assetClass: AssetClass, symbol: string, rr: number): TradeResult[] {
  const pointValue = getPointValue(symbol);
  const timeToIndex = new Map<number, number>();
  candles.forEach((c, i) => timeToIndex.set(c.timestamp, i));
  const trades: TradeResult[] = [];

  for (const zone of zones) {
    // Só zonas efetivamente mitigadas geram trade — mitigatedAt É o candle de
    // fechamento dentro da zona, exatamente o gatilho de entrada definido.
    // `detectOrderBlocksCausal` já garante mitigatedAt >= knownFromTime (o
    // candle de rompimento que confirma a zona) — sem isso o backtest usaria
    // uma mitigação anterior à própria zona existir (ver zonesCausal.ts).
    if (!zone.mitigated || zone.mitigatedAt === null) continue;
    const entryIdx = timeToIndex.get(zone.mitigatedAt);
    if (entryIdx === undefined || entryIdx < 30) continue; // exige histórico mínimo pro ATR

    const entryCandle = candles[entryIdx];
    const entryPrice = entryCandle.close;
    const atr = averageRange(candles.slice(0, entryIdx + 1), 14);
    if (atr <= 0) continue;
    const buffer = atr * SL_BUFFER_ATR_MULT;

    const isSell = zone.type === 'order_block_bearish';
    const stopPrice = isSell ? zone.priceHigh + buffer : zone.priceLow - buffer;
    const riskDistance = Math.abs(stopPrice - entryPrice);
    if (riskDistance <= 0) continue;
    const targetPrice = isSell ? entryPrice - riskDistance * rr : entryPrice + riskDistance * rr;

    let exitPrice: number | null = null;
    let closedByTimeout = false;
    for (let i = entryIdx + 1; i < Math.min(candles.length, entryIdx + 1 + MAX_HOLD_BARS); i++) {
      const c = candles[i];
      const hitStop = isSell ? c.high >= stopPrice : c.low <= stopPrice;
      const hitTarget = isSell ? c.low <= targetPrice : c.high >= targetPrice;
      if (hitStop && hitTarget) { exitPrice = stopPrice; break; } // empate no candle -> pior caso (SL)
      if (hitStop) { exitPrice = stopPrice; break; }
      if (hitTarget) { exitPrice = targetPrice; break; }
    }
    if (exitPrice === null) { closedByTimeout = true; continue; } // não fechou dentro da janela -> fora da amostra

    const grossReturnPercent = ((isSell ? entryPrice - exitPrice : exitPrice - entryPrice) / entryPrice) * 100;
    const roundTripCostPercent = estimateCostPercent(assetClass, entryPrice, pointValue) * 2 * 100;
    const netReturnPercent = grossReturnPercent - roundTripCostPercent;

    trades.push({ entryIndex: entryIdx, direction: isSell ? 'SELL' : 'BUY', rr, netReturnPercent, win: exitPrice === targetPrice, closedByTimeout });
  }
  return trades.sort((a, b) => a.entryIndex - b.entryIndex);
}

function buildZonesForSeries(candles: Candle[]): CausalZone[] {
  const swings = detectSwingPoints(candles, SWING_LOOKBACK);
  const events = detectStructureEventsCausal(candles, swings, SWING_LOOKBACK);
  return detectOrderBlocksCausal(candles, events);
}

interface RowResult {
  symbol: string; timeframe: string; rr: number;
  trainTrades: number; trainWinRate: number; trainSharpe: number;
  holdoutTrades: number; holdoutWinRate: number; holdoutNetPercentTotal: number; holdoutAvgNetPercent: number; holdoutSharpe: number;
}

const allRows: RowResult[] = [];
const symbolsWanted = Object.keys(ASSET_CLASS);
// DSR por série corrige só pelos 4 R:Rs testados NAQUELA série — mas o
// relatório final olha os "melhores" resultados entre as 21 séries (9
// ativos × TF), o que é seleção adicional não corrigida aqui (mesmo
// problema que motivou N_BUSCA acumulado em veredito_recusto.py). Declarado
// explicitamente no RESULTADOS.md — nenhuma DSR por série deve ser lida
// isoladamente como "prova", só como sinal relativo dentro daquela série.
const N_TRIALS = RR_LEVELS.length;

for (const symbol of symbolsWanted) {
  for (const tf of TIMEFRAMES) {
    const candles = loadCandles(symbol, tf);
    if (!candles || candles.length < 300) {
      console.log(`⚠️  ${symbol} ${tf}: SEM DADO REAL suficiente, pulando`);
      continue;
    }
    const assetClass = ASSET_CLASS[symbol];

    // 3 janelas cronológicas com embargo — zonas/trades computados por janela
    // (treino e holdout de cada janela), não vazando candle entre janelas
    // adjacentes além do warmup interno já tratado por splitWithEmbargo.
    const windows = splitWithEmbargo(candles, 3, 0.7, 200);

    for (const win of windows) {
      if (win.train.length < 100 || win.holdout.length < 100) continue;

      const trainZones = buildZonesForSeries(win.train);
      const holdoutZones = buildZonesForSeries(win.holdout);

      for (const rr of RR_LEVELS) {
        const trainTrades = simulateTrades(win.train, trainZones, assetClass, symbol, rr);
        const holdoutTradesAll = simulateTrades(win.holdout, holdoutZones, assetClass, symbol, rr);
        // Descarta trades cuja entrada caiu dentro do warmup do holdout — não são observação real.
        const holdoutTrades = holdoutTradesAll.filter((t) => t.entryIndex >= win.warmupBars);

        const trainReturns = trainTrades.map((t) => t.netReturnPercent);
        const holdoutReturns = holdoutTrades.map((t) => t.netReturnPercent);

        allRows.push({
          symbol, timeframe: tf, rr,
          trainTrades: trainTrades.length,
          trainWinRate: trainTrades.length ? trainTrades.filter((t) => t.win).length / trainTrades.length : 0,
          trainSharpe: sharpeRatio(trainReturns),
          holdoutTrades: holdoutTrades.length,
          holdoutWinRate: holdoutTrades.length ? holdoutTrades.filter((t) => t.win).length / holdoutTrades.length : 0,
          holdoutNetPercentTotal: holdoutReturns.reduce((a, b) => a + b, 0),
          holdoutAvgNetPercent: holdoutTrades.length ? holdoutReturns.reduce((a, b) => a + b, 0) / holdoutTrades.length : 0,
          holdoutSharpe: sharpeRatio(holdoutReturns),
        });
      }
    }
  }
}

writeFileSync(join(RESULTS_DIR, 'raw_windows.json'), JSON.stringify(allRows, null, 2));

// Agrega por símbolo×timeframe: soma as 3 janelas, escolhe o R:R vencedor NO
// TREINO (agregado) e reporta o resultado desse R:R no holdout — disciplina
// anti-cherry-pick (mesma de veredito_recusto.py, experimento 2026-07-30).
interface Agg {
  symbol: string; timeframe: string; rr: number;
  trainTrades: number; trainSharpeAvg: number;
  holdoutTrades: number; holdoutWinRate: number; holdoutNetPercentTotal: number; holdoutAvgNetPercent: number; holdoutReturns: number[];
}
const bySymTf = new Map<string, Map<number, Agg>>();
for (const r of allRows) {
  const key = `${r.symbol}|${r.timeframe}`;
  if (!bySymTf.has(key)) bySymTf.set(key, new Map());
  const m = bySymTf.get(key)!;
  if (!m.has(r.rr)) m.set(r.rr, { symbol: r.symbol, timeframe: r.timeframe, rr: r.rr, trainTrades: 0, trainSharpeAvg: 0, holdoutTrades: 0, holdoutWinRate: 0, holdoutNetPercentTotal: 0, holdoutAvgNetPercent: 0, holdoutReturns: [] });
  const a = m.get(r.rr)!;
  a.trainTrades += r.trainTrades;
  a.holdoutTrades += r.holdoutTrades;
  a.holdoutNetPercentTotal += r.holdoutNetPercentTotal;
}

const champions: Array<{
  symbol: string; timeframe: string; chosenRr: number; trainTrades: number;
  holdoutTrades: number; holdoutWinRate: number; holdoutNetPercentTotal: number; holdoutAvgNetPercent: number; holdoutSharpe: number; dsr: number;
}> = [];

for (const [key, rrMap] of bySymTf) {
  const [symbol, timeframe] = key.split('|');
  // Seleção pelo treino: soma (Sharpe de treino × nº trades) por janela, por
  // R:R — pondera R:Rs com mais amostra sem precisar guardar retorno bruto.
  let bestRr = RR_LEVELS[0];
  let bestTrainSharpeSum = -Infinity;
  for (const rr of RR_LEVELS) {
    const rows = allRows.filter((x) => x.symbol === symbol && x.timeframe === timeframe && x.rr === rr);
    const sum = rows.reduce((a, r) => a + r.trainSharpe * r.trainTrades, 0);
    if (sum > bestTrainSharpeSum) { bestTrainSharpeSum = sum; bestRr = rr; }
  }
  const chosen = rrMap.get(bestRr)!;
  const chosenRows = allRows.filter((x) => x.symbol === symbol && x.timeframe === timeframe && x.rr === bestRr);
  const holdoutSharpeWeighted = chosenRows.reduce((a, r) => a + r.holdoutSharpe * r.holdoutTrades, 0) / Math.max(1, chosen.holdoutTrades);

  const sr0 = expectedMaxSharpeUnderNull(0.01, N_TRIALS); // variância de Sharpe entre R:Rs aproximada de forma conservadora (ver nota nos resultados)
  const dsr = chosen.holdoutTrades >= 2 ? deflatedSharpeRatio(holdoutSharpeWeighted, sr0, chosen.holdoutTrades) : 0;

  champions.push({
    symbol, timeframe, chosenRr: bestRr,
    trainTrades: chosen.trainTrades,
    holdoutTrades: chosen.holdoutTrades,
    holdoutWinRate: chosen.holdoutTrades ? chosenRows.reduce((a, r) => a + r.holdoutWinRate * r.holdoutTrades, 0) / chosen.holdoutTrades : 0,
    holdoutNetPercentTotal: chosen.holdoutNetPercentTotal,
    holdoutAvgNetPercent: chosen.holdoutTrades ? chosen.holdoutNetPercentTotal / chosen.holdoutTrades : 0,
    holdoutSharpe: holdoutSharpeWeighted,
    dsr,
  });
}

writeFileSync(join(RESULTS_DIR, 'champions.json'), JSON.stringify(champions, null, 2));

const lines: string[] = [];
lines.push('# Order Block Fade — resultado (R:R escolhido pelo treino, medido no holdout)');
lines.push('');
lines.push('Gerado por `backtest.ts`. Zonas: réplica causal de `detectOrderBlocks` de');
lines.push('produção (`zonesCausal.ts` — ver correção de look-ahead documentada lá).');
lines.push('Estrutura BOS/CHoCH: cópia local corrigida quanto a look-ahead');
lines.push('(`structureCausal.ts`). Custo: `CostModel.ts`. Split: `DataSplit.ts` (3');
lines.push('janelas, embargo, warmup 200). R:R vencedor escolhido pelo TREINO (Sharpe');
lines.push('ponderado por trades), avaliado no HOLDOUT — disciplina anti-cherry-pick.');
lines.push('');
lines.push('⚠️ DSR por linha corrige só pelos 4 níveis de R:R testados NAQUELA série —');
lines.push('não corrige por escolher a "melhor" entre as 21 séries da tabela (mesmo tipo');
lines.push('de correção que faltaria pra qualquer leitura tipo "olha, XAUUSD 15m deu');
lines.push('positivo" isolada). Nenhuma DSR aqui deve ser lida como prova sozinha.');
lines.push('');
lines.push('| Símbolo | TF | R:R escolhido | Trades treino | Trades holdout | Win% holdout | %líq total holdout | %líq médio/trade | Sharpe holdout | DSR |');
lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const c of champions.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.timeframe.localeCompare(b.timeframe))) {
  lines.push(`| ${c.symbol} | ${c.timeframe} | 1:${c.chosenRr} | ${c.trainTrades} | ${c.holdoutTrades} | ${(c.holdoutWinRate * 100).toFixed(1)}% | ${c.holdoutNetPercentTotal.toFixed(2)}% | ${c.holdoutAvgNetPercent.toFixed(4)}% | ${c.holdoutSharpe.toFixed(3)} | ${(c.dsr * 100).toFixed(1)}% |`);
}
writeFileSync(join(RESULTS_DIR, 'RESULTADOS.md'), lines.join('\n') + '\n');
console.log(`Gravado: results/RESULTADOS.md, champions.json, raw_windows.json (${champions.length} séries, ${allRows.length} linhas brutas)`);
