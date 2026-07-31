/**
 * Variação pedida pelo Cleber (2026-07-30) em cima do teste ad-hoc anterior
 * (backtest-sma-crossover-pullback.ts, 1min, resultado: sinal bruto ~40,5%
 * de acerto mas custo de 0,26%/trade devora tudo num alvo ATR minúsculo de
 * 1min): mesma regra de entrada (cruzamento SMA40/SMA100 + pullback), agora
 * em timeframes mais lentos (15m e 1h) — onde o alvo em ATR fica
 * proporcionalmente maior que o custo fixo — E reportado em DÓLAR (contrato
 * fixo simulado de 0,01 BTC, não % de capital), pra dimensionamento real.
 *
 * MESMA regra de sinal do script anterior, ZERO ajuste de parâmetro (SMA
 * 40/100, pullback = 1 candle contra + confirmação a favor, SL 1,5×ATR(14),
 * TP 3×ATR(14), trailing ativo) — só o timeframe muda. Mesmos 6 meses de
 * calendário do teste original, pra comparação justa.
 *
 * Contrato fixo: 0,01 BTC (não fixed-fractional por %) — por pedido
 * explícito, pra ler o resultado em dólar por trade e dimensionar posição
 * real a partir daí. Custo de transação ainda descontado em cada trade
 * (spread+slippage+comissão modelados em research/CostModel.ts para CRYPTO),
 * convertido de % pra USD sobre o notional real do contrato
 * (0,01 × preço de entrada).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-30-custom-sma-pullback/backtest-sma-crossover-pullback-mtf.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/sma-pullback-mtf.mjs && node /tmp/sma-pullback-mtf.mjs
 */
import { writeFileSync } from 'fs';
import { Candle, calculateSMA, calculateATR } from '../../../src/app/services/indicators/TechnicalIndicators';
import { resolveTpSl, trailStopLoss, getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { Strategy } from '../../../src/app/types/strategy';
import { estimateCostPercent } from '../../CostModel';
import { splitWithEmbargo } from '../../DataSplit';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOL = 'BTCUSDT';
const TIMEFRAMES = ['15m', '1h'];
const MONTHS_BACK = 6;
const SMA_FAST = 40;
const SMA_SLOW = 100;
const WARMUP_BARS = 200;
const NUM_WINDOWS = 3;
const CONTRACT_SIZE_BTC = 0.01;

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 5000;
const INTER_PAGE_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBinancePaginated(symbol: string, interval: string, sinceTime: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (;;) {
    let attempt = 0;
    let page: Candle[] = [];
    for (;;) {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
      if (res.ok) {
        const raw: any[] = await res.json();
        if (raw.length === 0) return all;
        page = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
        break;
      }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`  [429 Binance, tentativa ${attempt + 1}/${MAX_RETRIES} — esperando ${backoff / 1000}s]`);
        await sleep(backoff);
        attempt++;
        continue;
      }
      throw new Error(`Sem dado real de ${symbol} ${interval}: HTTP ${res.status}. Sem fallback simulado por desenho.`);
    }
    all.unshift(...page);
    endTime = page[0].time - 1;
    if (page[0].time <= sinceTime) return all.filter(c => c.time >= sinceTime);
    await sleep(INTER_PAGE_DELAY_MS);
  }
}

type Side = 'LONG' | 'SHORT';

interface CustomTrade {
  entryIndex: number;
  exitIndex: number;
  entryTime: string;
  exitTime: string;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  profitPercent: number;
  profitUsd: number;
  mfePercent: number;
  maePercent: number;
}

function generateEntrySignals(candles: Candle[], smaFast: (number | null)[], smaSlow: (number | null)[]): Array<{ index: number; side: Side }> {
  const signals: Array<{ index: number; side: Side }> = [];
  let state: 'IDLE' | 'WAITING_PULLBACK' | 'PULLBACK_SEEN' = 'IDLE';
  let biasSide: Side | null = null;

  for (let i = 1; i < candles.length; i++) {
    const f0 = smaFast[i - 1], s0 = smaSlow[i - 1], f1 = smaFast[i], s1 = smaSlow[i];
    if (f0 === null || s0 === null || f1 === null || s1 === null) continue;

    const crossedUp = f0 <= s0 && f1 > s1;
    const crossedDown = f0 >= s0 && f1 < s1;

    if (crossedUp || crossedDown) {
      state = 'WAITING_PULLBACK';
      biasSide = crossedUp ? 'LONG' : 'SHORT';
      continue;
    }

    if (state === 'IDLE') continue;

    const candle = candles[i];
    const isBullishCandle = candle.close > candle.open;
    const isBearishCandle = candle.close < candle.open;
    const isAgainstBias = biasSide === 'LONG' ? isBearishCandle : isBullishCandle;
    const isWithBias = biasSide === 'LONG' ? isBullishCandle : isBearishCandle;

    if (state === 'WAITING_PULLBACK') {
      if (isAgainstBias) state = 'PULLBACK_SEEN';
      continue;
    }

    if (state === 'PULLBACK_SEEN') {
      if (isWithBias) {
        signals.push({ index: i, side: biasSide! });
        state = 'IDLE';
      }
      continue;
    }
  }

  return signals;
}

function runCustomBacktest(candles: Candle[], warmupBars: number): CustomTrade[] {
  const smaFast = calculateSMA(candles, SMA_FAST);
  const smaSlow = calculateSMA(candles, SMA_SLOW);
  const atr = calculateATR(candles, 14);
  const pointValue = getPointValue(SYMBOL);

  const fakeStrategy: Strategy = {
    id: 'sma-crossover-pullback', name: 'Cruzamento SMA 40/100 + pullback', description: '', isPreset: false,
    entryBlocks: [], exitBlocks: [], filterBlocks: [],
    entrySignal: 'BUY', direction: 'AUTO',
    stopLoss: 0, takeProfit: 0, stopLossMode: 'ATR', takeProfitMode: 'ATR',
    atrStopMultiplier: 1.5, atrTakeProfitMultiplier: 3,
    trailingStop: true, riskProfile: 'MODERATE', positionSizePercent: 1, timeframe: '1m', maxConcurrentTrades: 3,
  };

  const signals = generateEntrySignals(candles, smaFast, smaSlow);
  const trades: CustomTrade[] = [];

  let openPosition: null | {
    side: Side; entryPrice: number; entryIndex: number; tp: number | null; sl: number; originalSl: number;
    mfePercent: number; maePercent: number;
  } = null;

  let signalPtr = 0;
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2; // ida+volta, mesma convenção do BacktestEngine.ts/CostModel.ts

  for (let i = warmupBars; i < candles.length; i++) {
    const candle = candles[i];

    if (openPosition) {
      if (fakeStrategy.trailingStop) {
        const prevClose = candles[i - 1].close;
        openPosition.sl = trailStopLoss(openPosition.side, openPosition.entryPrice, openPosition.originalSl, openPosition.sl, prevClose);
      }

      const favorableExcursion = openPosition.side === 'LONG'
        ? (candle.high - openPosition.entryPrice) / openPosition.entryPrice * 100
        : (openPosition.entryPrice - candle.low) / openPosition.entryPrice * 100;
      const adverseExcursion = openPosition.side === 'LONG'
        ? (openPosition.entryPrice - candle.low) / openPosition.entryPrice * 100
        : (candle.high - openPosition.entryPrice) / openPosition.entryPrice * 100;
      openPosition.mfePercent = Math.max(openPosition.mfePercent, favorableExcursion);
      openPosition.maePercent = Math.max(openPosition.maePercent, adverseExcursion);

      const hitTp = openPosition.tp !== null && (openPosition.side === 'LONG' ? candle.high >= openPosition.tp : candle.low <= openPosition.tp);
      const hitSl = openPosition.side === 'LONG' ? candle.low <= openPosition.sl : candle.high >= openPosition.sl;

      if (hitTp || hitSl) {
        const exitPrice = hitSl ? openPosition.sl : openPosition.tp!;
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPct * 100;
        // USD sobre o CONTRATO FIXO (0,01 BTC), não % de capital — pedido
        // explícito do Cleber pra dimensionar posição real a partir do
        // resultado em dólar de um contrato pequeno conhecido.
        const notionalUsd = openPosition.entryPrice * CONTRACT_SIZE_BTC;
        const profitUsd = (profitPercent / 100) * notionalUsd;

        trades.push({
          entryIndex: openPosition.entryIndex, exitIndex: i,
          entryTime: new Date(candles[openPosition.entryIndex].time).toISOString(),
          exitTime: new Date(candle.time).toISOString(),
          side: openPosition.side, entryPrice: openPosition.entryPrice, exitPrice,
          profitPercent, profitUsd,
          mfePercent: openPosition.mfePercent, maePercent: openPosition.maePercent,
        });
        openPosition = null;
      }
      continue;
    }

    while (signalPtr < signals.length && signals[signalPtr].index < i) signalPtr++;
    if (signalPtr >= signals.length || signals[signalPtr].index !== i) continue;

    const signal = signals[signalPtr];
    signalPtr++;

    const entryPrice = candle.close;
    const atrAtEntry = atr[i];
    const { tp, sl } = resolveTpSl(fakeStrategy, signal.side, entryPrice, pointValue, atrAtEntry);

    openPosition = { side: signal.side, entryPrice, entryIndex: i, tp, sl, originalSl: sl, mfePercent: 0, maePercent: 0 };
  }

  return trades.filter(t => t.entryIndex >= warmupBars);
}

function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return NaN;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const m2 = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const m3 = values.reduce((a, v) => a + (v - mean) ** 3, 0) / n;
  const sd = Math.sqrt(m2);
  return sd === 0 ? 0 : m3 / sd ** 3;
}

function maxDrawdownUsd(trades: CustomTrade[]): number {
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of trades) {
    cum += t.profitUsd;
    peak = Math.max(peak, cum);
    maxDd = Math.min(maxDd, cum - peak);
  }
  return maxDd; // negativo
}

async function evaluateTimeframe(timeframe: string) {
  console.log(`\n\n═══ Timeframe ${timeframe} — mesma regra, contrato fixo ${CONTRACT_SIZE_BTC} BTC ═══\n`);
  const sinceTime = Date.now() - MONTHS_BACK * 30 * 86_400_000;
  const candles = await fetchBinancePaginated(SYMBOL, timeframe, sinceTime);
  console.log(`${candles.length} candles de ${new Date(candles[0].time).toISOString()} até ${new Date(candles[candles.length - 1].time).toISOString()}`);

  const windows = splitWithEmbargo(candles, NUM_WINDOWS, 0.7, WARMUP_BARS);
  const trainTrades = windows.flatMap(w => runCustomBacktest(w.train, 0));
  const holdoutTrades = windows.flatMap(w => runCustomBacktest(w.holdout, w.warmupBars));

  console.log(`n_treino=${trainTrades.length}  n_holdout=${holdoutTrades.length}`);

  const mfeValues = holdoutTrades.map(t => t.mfePercent);
  const maeValues = holdoutTrades.map(t => t.maePercent);
  const ratios = holdoutTrades.map(t => (t.maePercent > 0 ? t.mfePercent / t.maePercent : t.mfePercent > 0 ? Infinity : 0)).filter(Number.isFinite);
  const medianRatio = ratios.length ? ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : NaN;
  console.log(`\nSkew MFE: ${skewness(mfeValues).toFixed(3)}  Skew MAE: ${skewness(maeValues).toFixed(3)}  Razão MFE/MAE mediana: ${Number.isFinite(medianRatio) ? medianRatio.toFixed(3) : 'n/d'}`);

  const usdValues = holdoutTrades.map(t => t.profitUsd);
  const wins = holdoutTrades.filter(t => t.profitUsd > 0);
  const losses = holdoutTrades.filter(t => t.profitUsd <= 0);
  const totalUsd = usdValues.reduce((a, b) => a + b, 0);
  const avgWinUsd = wins.length ? wins.reduce((a, t) => a + t.profitUsd, 0) / wins.length : 0;
  const avgLossUsd = losses.length ? losses.reduce((a, t) => a + t.profitUsd, 0) / losses.length : 0;
  const bestUsd = usdValues.length ? Math.max(...usdValues) : 0;
  const worstUsd = usdValues.length ? Math.min(...usdValues) : 0;
  const maxDd = maxDrawdownUsd(holdoutTrades);

  const returns = holdoutTrades.map(t => t.profitPercent);
  const sh = sharpeRatio(returns);
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(sh, sr0, returns.length);

  console.log(`\n── Resultado em DÓLAR (contrato fixo ${CONTRACT_SIZE_BTC} BTC, holdout, n=${holdoutTrades.length}) ──`);
  console.log(`Win rate: ${holdoutTrades.length ? ((wins.length / holdoutTrades.length) * 100).toFixed(1) : '0.0'}%`);
  console.log(`Resultado líquido total: ${totalUsd >= 0 ? '+' : ''}US$${totalUsd.toFixed(2)}`);
  console.log(`Ganho médio por trade vencedor: US$${avgWinUsd.toFixed(2)}`);
  console.log(`Perda média por trade perdedor: US$${avgLossUsd.toFixed(2)}`);
  console.log(`Melhor trade: US$${bestUsd.toFixed(2)}  |  Pior trade: US$${worstUsd.toFixed(2)}`);
  console.log(`Máximo drawdown (pico a vale, USD, contrato fixo): US$${maxDd.toFixed(2)}`);
  console.log(`Sharpe (retorno %): ${sh.toFixed(3)}  DSR: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅' : dsr >= 0.5 ? '⚠️' : '❌'}`);

  return {
    timeframe, nCandles: candles.length, nHoldout: holdoutTrades.length,
    winRate: holdoutTrades.length ? wins.length / holdoutTrades.length : 0,
    totalUsd, avgWinUsd, avgLossUsd, bestUsd, worstUsd, maxDrawdownUsd: maxDd,
    sharpe: sh, dsr, mfeSkew: skewness(mfeValues), maeSkew: skewness(maeValues), medianMfeMaeRatio: medianRatio,
    trades: holdoutTrades,
  };
}

async function main() {
  console.log(`Variação de timeframe do teste SMA${SMA_FAST}/SMA${SMA_SLOW}+pullback, ${SYMBOL}, contrato fixo ${CONTRACT_SIZE_BTC} BTC, últimos ${MONTHS_BACK} meses.`);

  const results = [];
  for (const tf of TIMEFRAMES) {
    results.push(await evaluateTimeframe(tf));
  }

  console.log('\n\n═══ RESUMO — comparação entre timeframes (contrato fixo 0,01 BTC) ═══\n');
  for (const r of results) {
    console.log(`${r.timeframe.padEnd(4)} n=${String(r.nHoldout).padEnd(5)} winRate=${(r.winRate * 100).toFixed(1).padStart(5)}%  totalUSD=${r.totalUsd >= 0 ? '+' : ''}${r.totalUsd.toFixed(2).padStart(9)}  maxDD=US$${r.maxDrawdownUsd.toFixed(2).padStart(8)}  Sharpe=${r.sharpe.toFixed(3).padStart(7)}  DSR=${(r.dsr * 100).toFixed(1).padStart(5)}%`);
  }

  const outPath = `${process.cwd()}/research/experiments/2026-07-30-custom-sma-pullback/output-mtf.json`;
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), symbol: SYMBOL, contractSizeBtc: CONTRACT_SIZE_BTC, monthsBack: MONTHS_BACK, results }, null, 2));
  console.log(`\nOutput bruto salvo em ${outPath}`);
}

main().catch(err => {
  console.error('Erro na variação multi-timeframe:', err);
  process.exit(1);
});
