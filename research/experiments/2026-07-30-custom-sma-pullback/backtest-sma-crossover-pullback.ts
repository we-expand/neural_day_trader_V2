/**
 * Teste ad-hoc pedido pelo Cleber (2026-07-30, fora da linha 11.5-11.15 e
 * fora da Fase 2 do MASTER_PLAN.md — estratégia NOVA, nunca testada neste
 * projeto): cruzamento de SMA(40)/SMA(100) no gráfico de 1 minuto, últimos 6
 * meses, entrada só depois de um pullback.
 *
 * Regra de entrada, definida explicitamente (confirmada com o Cleber antes de
 * rodar, pra não inventar critério sem avisar):
 *   1. Cruzamento: SMA40 cruza acima da SMA100 (viés de ALTA) ou abaixo
 *      (viés de BAIXA) — ambos os lados habilitados.
 *   2. Depois do cruzamento, espera pelo menos 1 candle CONTRA a direção da
 *      cruza (candle vermelho depois de cruza de alta, ou candle verde
 *      depois de cruza de baixa) — isso é o "pull back".
 *   3. Entrada no primeiro candle SEGUINTE que fechar A FAVOR da direção da
 *      cruza (candle verde pra cruza de alta, vermelho pra cruza de baixa).
 *      Entra no close desse candle (mesma convenção do BacktestEngine.ts).
 *   Se um novo cruzamento oposto acontecer antes do pullback resolver, o
 *   estado reseta pro novo cruzamento (não empilha sinais de cruzamentos
 *   antigos).
 *
 * Sem filtro adicional (sem ADX, sem volume) — é um teste direto da regra
 * como descrita, não uma versão "melhorada" dela.
 *
 * Saída (confirmada com o Cleber): reaproveita a mecânica EXATA do motor
 * corrigido na Fase 1 — resolveTpSl/trailStopLoss/calculatePositionSize de
 * TradeSizing.ts — SL 1,5×ATR(14), TP 3×ATR(14) (R:R 1:2), trailing stop
 * ativo, sizing por distância real do stop. Não usa runBacktest() porque o
 * motor de blocos (StrategyEvaluator) não expressa uma regra de entrada
 * stateful de 3 estágios (cruza → pullback → confirmação) — mas reusa toda a
 * mecânica de execução já corrigida e testada, só substitui a GERAÇÃO do
 * sinal de entrada.
 *
 * Ativo: BTCUSDT via Binance spot público (klines) — sem depender da conta
 * MetaAPI compartilhada (que está sob rate-limit sustentado nesta sessão,
 * ver research/MASTER_PLAN.md handoff). Zero grid search, zero ajuste de
 * parâmetro — os períodos de SMA (40/100) e a regra de pullback vieram
 * literalmente do pedido do Cleber, não de otimização.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-30-custom-sma-pullback/backtest-sma-crossover-pullback.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/sma-pullback.mjs && node /tmp/sma-pullback.mjs
 */
import { writeFileSync } from 'fs';
import { Candle, calculateSMA, calculateATR } from '../../../src/app/services/indicators/TechnicalIndicators';
import { resolveTpSl, trailStopLoss, calculatePositionSize, getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { Strategy } from '../../../src/app/types/strategy';
import { estimateCostPercent } from '../../CostModel';
import { splitWithEmbargo } from '../../DataSplit';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m';
const MONTHS_BACK = 6;
const SMA_FAST = 40;
const SMA_SLOW = 100;
const WARMUP_BARS = 200; // >SMA_SLOW, mesma folga usada nas outras validações
const NUM_WINDOWS = 3;

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
    if (all.length % 20000 === 0) console.log(`  ... ${all.length} candles buscados até agora`);
  }
}

type Side = 'LONG' | 'SHORT';

interface CustomTrade {
  entryIndex: number;
  exitIndex: number;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  profitPercent: number;
  mfePercent: number;
  maePercent: number;
  crossIndex: number;
  pullbackIndex: number;
}

/**
 * Gera os índices de ENTRADA (candle a favor da cruza, após pullback
 * confirmado) para toda a série — não depende de warmup separado, o chamador
 * filtra por entryIndex >= warmupBars antes de contar como observação.
 */
function generateEntrySignals(candles: Candle[], smaFast: (number | null)[], smaSlow: (number | null)[]): Array<{ index: number; side: Side; crossIndex: number; pullbackIndex: number }> {
  const signals: Array<{ index: number; side: Side; crossIndex: number; pullbackIndex: number }> = [];

  let state: 'IDLE' | 'WAITING_PULLBACK' | 'PULLBACK_SEEN' = 'IDLE';
  let biasSide: Side | null = null;
  let crossIndex = -1;
  let pullbackIndex = -1;

  for (let i = 1; i < candles.length; i++) {
    const f0 = smaFast[i - 1], s0 = smaSlow[i - 1], f1 = smaFast[i], s1 = smaSlow[i];
    if (f0 === null || s0 === null || f1 === null || s1 === null) continue;

    const crossedUp = f0 <= s0 && f1 > s1;
    const crossedDown = f0 >= s0 && f1 < s1;

    if (crossedUp || crossedDown) {
      // Novo cruzamento reseta o estado, mesmo que um pullback anterior
      // ainda estivesse pendente — não empilha sinal de cruzamento velho.
      state = 'WAITING_PULLBACK';
      biasSide = crossedUp ? 'LONG' : 'SHORT';
      crossIndex = i;
      pullbackIndex = -1;
      continue;
    }

    if (state === 'IDLE') continue;

    const candle = candles[i];
    const isBullishCandle = candle.close > candle.open;
    const isBearishCandle = candle.close < candle.open;
    const isAgainstBias = biasSide === 'LONG' ? isBearishCandle : isBullishCandle;
    const isWithBias = biasSide === 'LONG' ? isBullishCandle : isBearishCandle;

    if (state === 'WAITING_PULLBACK') {
      if (isAgainstBias) {
        state = 'PULLBACK_SEEN';
        pullbackIndex = i;
      }
      continue;
    }

    if (state === 'PULLBACK_SEEN') {
      if (isWithBias) {
        signals.push({ index: i, side: biasSide!, crossIndex, pullbackIndex });
        state = 'IDLE';
      }
      // candle neutro (close===open) ou mais um candle contra a bias: continua esperando.
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

  let equity = 10000;
  let openPosition: null | {
    side: Side; entryPrice: number; entryIndex: number; tp: number | null; sl: number; originalSl: number;
    tradeCapital: number; mfePercent: number; maePercent: number; crossIndex: number; pullbackIndex: number;
  } = null;

  let signalPtr = 0;
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;

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
        const exitPrice = hitSl ? openPosition.sl : openPosition.tp!; // empate: SL primeiro (pior caso), mesma disciplina do BacktestEngine.ts
        const priceDiff = openPosition.side === 'LONG' ? exitPrice - openPosition.entryPrice : openPosition.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / openPosition.entryPrice) * 100;
        const profitPercent = grossProfitPercent - roundTripCostPct * 100;

        trades.push({
          entryIndex: openPosition.entryIndex, exitIndex: i, side: openPosition.side,
          entryPrice: openPosition.entryPrice, exitPrice, profitPercent,
          mfePercent: openPosition.mfePercent, maePercent: openPosition.maePercent,
          crossIndex: openPosition.crossIndex, pullbackIndex: openPosition.pullbackIndex,
        });
        equity += (10000 * profitPercent) / 100; // equity nominal fixo — só pra dimensionar sizing, não acumula composto (mesma simplificação de análise que os outros scripts desta pasta)
        openPosition = null;
      }
      continue;
    }

    // Avança o ponteiro de sinais até o candle atual; só abre posição se
    // exatamente este candle é o gatilho de entrada.
    while (signalPtr < signals.length && signals[signalPtr].index < i) signalPtr++;
    if (signalPtr >= signals.length || signals[signalPtr].index !== i) continue;

    const signal = signals[signalPtr];
    signalPtr++;

    const entryPrice = candle.close;
    const atrAtEntry = atr[i];
    const { tp, sl, slDistance } = resolveTpSl(fakeStrategy, signal.side, entryPrice, pointValue, atrAtEntry);
    const stopDistancePercent = slDistance / entryPrice;
    const tradeCapital = calculatePositionSize({
      currentBalance: equity, allocatedCapital: equity, riskPerTradePercent: fakeStrategy.positionSizePercent,
      riskProfile: fakeStrategy.riskProfile, stopDistancePercent,
    });

    openPosition = {
      side: signal.side, entryPrice, entryIndex: i, tp, sl, originalSl: sl, tradeCapital,
      mfePercent: 0, maePercent: 0, crossIndex: signal.crossIndex, pullbackIndex: signal.pullbackIndex,
    };
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
  if (sd === 0) return 0;
  return m3 / sd ** 3;
}

async function main() {
  console.log(`Teste ad-hoc: cruzamento SMA${SMA_FAST}/SMA${SMA_SLOW} + pullback, ${SYMBOL} ${INTERVAL}, últimos ${MONTHS_BACK} meses.`);
  console.log('Buscando dado real via Binance spot público (sem depender da conta MetaAPI compartilhada)...\n');

  const sinceTime = Date.now() - MONTHS_BACK * 30 * 86_400_000;
  const candles = await fetchBinancePaginated(SYMBOL, INTERVAL, sinceTime);
  console.log(`${candles.length} candles de ${new Date(candles[0].time).toISOString()} até ${new Date(candles[candles.length - 1].time).toISOString()}\n`);

  const windows = splitWithEmbargo(candles, NUM_WINDOWS, 0.7, WARMUP_BARS);
  const trainTrades = windows.flatMap(w => runCustomBacktest(w.train, 0));
  const holdoutTrades = windows.flatMap(w => runCustomBacktest(w.holdout, w.warmupBars));

  console.log(`n_treino=${trainTrades.length}  n_holdout=${holdoutTrades.length}\n`);

  // ── Skew de MFE/MAE primeiro (mesma disciplina da Fase 2, §4.6 do MASTER_PLAN.md) ──
  const mfeValues = holdoutTrades.map(t => t.mfePercent);
  const maeValues = holdoutTrades.map(t => t.maePercent);
  const mfeSkew = skewness(mfeValues);
  const meanMfe = mfeValues.reduce((a, b) => a + b, 0) / (mfeValues.length || 1);
  const meanMae = maeValues.reduce((a, b) => a + b, 0) / (maeValues.length || 1);
  const ratios = holdoutTrades.map(t => (t.maePercent > 0 ? t.mfePercent / t.maePercent : t.mfePercent > 0 ? Infinity : 0)).filter(Number.isFinite);
  const medianRatio = ratios.length ? ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : NaN;

  console.log('── Skew de MFE/MAE (holdout) ──');
  console.log(`MFE médio: ${meanMfe.toFixed(3)}%  skew: ${mfeSkew.toFixed(3)}`);
  console.log(`MAE médio: ${meanMae.toFixed(3)}%  skew: ${mfeSkew === mfeSkew ? '' : ''}${skewness(maeValues).toFixed(3)}`);
  console.log(`Razão MFE/MAE (mediana): ${Number.isFinite(medianRatio) ? medianRatio.toFixed(3) : 'n/d'}\n`);

  // ── Long vs Short separado (a regra pede os dois lados — reportar cada um) ──
  for (const side of ['LONG', 'SHORT'] as Side[]) {
    const sideTrades = holdoutTrades.filter(t => t.side === side);
    const returns = sideTrades.map(t => t.profitPercent);
    const sh = sharpeRatio(returns);
    const wins = sideTrades.filter(t => t.profitPercent > 0).length;
    const net = returns.reduce((a, b) => a + b, 0);
    console.log(`${side.padEnd(6)} n=${String(sideTrades.length).padEnd(4)} winRate=${sideTrades.length ? ((wins / sideTrades.length) * 100).toFixed(1) : '0.0'}%  Sharpe=${sh.toFixed(3)}  retorno agregado=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
  }

  // ── Pooled (os dois lados juntos) ──
  const holdoutReturns = holdoutTrades.map(t => t.profitPercent);
  const trainReturns = trainTrades.map(t => t.profitPercent);
  const sh = sharpeRatio(holdoutReturns);
  const net = holdoutReturns.reduce((a, b) => a + b, 0);
  const wins = holdoutTrades.filter(t => t.profitPercent > 0).length;
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(sh, sr0, holdoutReturns.length);

  console.log(`\n── Pooled (LONG+SHORT), holdout ──`);
  console.log(`n=${holdoutReturns.length}  winRate=${holdoutTrades.length ? ((wins / holdoutTrades.length) * 100).toFixed(1) : '0.0'}%  Sharpe=${sh.toFixed(3)}  retorno agregado=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
  console.log(`Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95%' : dsr >= 0.5 ? '⚠️ abaixo do piso' : '❌ mais provável acaso que edge'}`);
  console.log(`\nAVISO DE RIGOR: teste de UM único instrumento (BTCUSDT), UM único run, sem grid search — nTrials=1 é honesto aqui.`);
  console.log(`Mas isto NÃO é o mesmo padrão de evidência da Fase 2 pooled (7 instrumentos) — n pequeno aqui tem poder estatístico bem menor pra separar "sem edge" de "edge real e modesto" (mesma lição do §4.5 do MASTER_PLAN.md).`);

  const outPath = `${process.cwd()}/research/experiments/2026-07-30-custom-sma-pullback/output.json`;
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(), symbol: SYMBOL, interval: INTERVAL, monthsBack: MONTHS_BACK,
    smaFast: SMA_FAST, smaSlow: SMA_SLOW, numWindows: NUM_WINDOWS, warmupBars: WARMUP_BARS,
    nCandles: candles.length,
    trades: holdoutTrades,
    stats: { nHoldout: holdoutReturns.length, nTrain: trainReturns.length, sharpe: sh, netReturn: net, dsr, mfeSkew, meanMfe, meanMae, medianMfeMaeRatio: medianRatio },
  }, null, 2));
  console.log(`\nOutput bruto salvo em ${outPath}`);
}

main().catch(err => {
  console.error('Erro no teste ad-hoc SMA crossover + pullback:', err);
  process.exit(1);
});
