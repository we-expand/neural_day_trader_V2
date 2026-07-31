/**
 * Teste executável pedido pelo Cleber (2026-07-30), passo seguinte ao
 * diagnóstico barato de MFE/MAE (`../2026-07-30-breakout-mfe-mae-diagnostic/`):
 * lá o payoff ratio real (sem custo) deu ~1,8-1,9x com win rate de 34-35% —
 * EV bruto levemente negativo, ponto de equilíbrio. Este script aplica CUSTO
 * REAL de transação (`CostModel.ts`, mesma calibração usada em todos os
 * outros testes desta sessão) e SIZING FIXO em contrato 0,01 BTC (pedido
 * explícito do Cleber), pra ver se sobra alguma coisa depois do custo.
 *
 * MESMO sinal/saída do diagnóstico, zero mudança de parâmetro:
 *   - Entrada: fechamento rompe Donchian(20) (máxima = LONG, mínima = SHORT).
 *   - Saída: Donchian(10) oposto (mesma regra do preset "Rompimento de
 *     Canal" em produção, `presetStrategies.ts`).
 *   - Sem TP/SL fixo, sem trailing extra — a saída Donchian(10) É o
 *     mecanismo inteiro de gestão de risco/saída deste arquétipo.
 *
 * Escopo: BTCUSDT (pedido explícito do Cleber pra este teste — o diagnóstico
 * anterior poolou 7 criptos, mas o teste executável em dólar foi pedido só
 * pra BTC), 15m e 1h (os dois timeframes do diagnóstico), 24 meses (mesmo
 * calendário da rodada estendida do diagnóstico, garante n consistente com
 * o que já foi medido), holdout com embargo (3 janelas 70/30).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-30-breakout-donchian-executable/backtest-breakout-donchian-btc.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/breakout-donchian-btc.mjs && node /tmp/breakout-donchian-btc.mjs
 */
import { writeFileSync } from 'fs';
import { Candle, calculateDonchian } from '../../../src/app/services/indicators/TechnicalIndicators';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent } from '../../CostModel';
import { splitWithEmbargo } from '../../DataSplit';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOL = 'BTCUSDT';
const INTERVALS = ['15m', '1h'] as const;
const MONTHS_BACK = 24;
const ENTRY_PERIOD = 20;
const EXIT_PERIOD = 10;
const WARMUP_BARS = 60;
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
    if (all.length % 20000 === 0) console.log(`  ... ${all.length} candles buscados até agora`);
  }
}

type Side = 'LONG' | 'SHORT';

interface Trade {
  entryIndex: number;
  exitIndex: number;
  entryTime: string;
  exitTime: string;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  grossProfitPercent: number;
  netProfitPercent: number;
  profitUsd: number;
  holdingBars: number;
}

function runBacktest(candles: Candle[], warmupBars: number, roundTripCostPct: number): Trade[] {
  const entryChannel = calculateDonchian(candles, ENTRY_PERIOD);
  const exitChannel = calculateDonchian(candles, EXIT_PERIOD);

  const trades: Trade[] = [];
  let open: { side: Side; entryIndex: number; entryPrice: number } | null = null;

  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];

    if (open) {
      const exitLower = exitChannel.lower[i];
      const exitUpper = exitChannel.upper[i];
      const hitExit = open.side === 'LONG'
        ? (exitLower !== null && candle.close < exitLower)
        : (exitUpper !== null && candle.close > exitUpper);

      if (hitExit) {
        const exitPrice = candle.close;
        const priceDiff = open.side === 'LONG' ? exitPrice - open.entryPrice : open.entryPrice - exitPrice;
        const grossProfitPercent = (priceDiff / open.entryPrice) * 100;
        const netProfitPercent = grossProfitPercent - roundTripCostPct * 100;
        const notionalUsd = open.entryPrice * CONTRACT_SIZE_BTC;
        const profitUsd = (netProfitPercent / 100) * notionalUsd;

        trades.push({
          entryIndex: open.entryIndex, exitIndex: i,
          entryTime: new Date(candles[open.entryIndex].time).toISOString(),
          exitTime: new Date(candle.time).toISOString(),
          side: open.side, entryPrice: open.entryPrice, exitPrice,
          grossProfitPercent, netProfitPercent, profitUsd,
          holdingBars: i - open.entryIndex,
        });
        open = null;
      }
      continue;
    }

    const upper = entryChannel.upper[i];
    const lower = entryChannel.lower[i];
    if (upper === null || lower === null) continue;

    if (candle.close > upper) {
      open = { side: 'LONG', entryIndex: i, entryPrice: candle.close };
    } else if (candle.close < lower) {
      open = { side: 'SHORT', entryIndex: i, entryPrice: candle.close };
    }
  }

  return trades.filter(t => t.entryIndex >= warmupBars);
}

function maxDrawdownUsd(trades: Trade[]): number {
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of trades) {
    cum += t.profitUsd;
    peak = Math.max(peak, cum);
    maxDd = Math.min(maxDd, cum - peak);
  }
  return maxDd;
}

function reportGroup(label: string, trades: Trade[]) {
  if (trades.length === 0) {
    console.log(`${label.padEnd(10)} n=0 — sem trade`);
    return null;
  }
  const usdValues = trades.map(t => t.profitUsd);
  const wins = trades.filter(t => t.profitUsd > 0);
  const losses = trades.filter(t => t.profitUsd <= 0);
  const totalUsd = usdValues.reduce((a, b) => a + b, 0);
  const avgWinUsd = wins.length ? wins.reduce((a, t) => a + t.profitUsd, 0) / wins.length : 0;
  const avgLossUsd = losses.length ? losses.reduce((a, t) => a + t.profitUsd, 0) / losses.length : 0;
  const bestUsd = Math.max(...usdValues);
  const worstUsd = Math.min(...usdValues);
  const maxDd = maxDrawdownUsd(trades);
  const winRate = wins.length / trades.length;

  const returns = trades.map(t => t.netProfitPercent);
  const sh = sharpeRatio(returns);
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(sh, sr0, returns.length);

  console.log(`${label.padEnd(10)} n=${String(trades.length).padEnd(5)} winRate=${(winRate * 100).toFixed(1)}%  total=${totalUsd >= 0 ? '+' : ''}US$${totalUsd.toFixed(2)}  ganhoMedio=US$${avgWinUsd.toFixed(2)}  perdaMedia=US$${avgLossUsd.toFixed(2)}  melhor=US$${bestUsd.toFixed(2)}  pior=US$${worstUsd.toFixed(2)}  maxDD=US$${maxDd.toFixed(2)}  Sharpe=${sh.toFixed(3)}  DSR=${(dsr * 100).toFixed(1)}%`);

  return { n: trades.length, winRate, totalUsd, avgWinUsd, avgLossUsd, bestUsd, worstUsd, maxDrawdownUsd: maxDd, sharpe: sh, dsr };
}

async function runForInterval(interval: string) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${SYMBOL} ${interval} — rompimento Donchian(${ENTRY_PERIOD})/saída Donchian(${EXIT_PERIOD}), contrato ${CONTRACT_SIZE_BTC} BTC, custo real`);
  console.log('='.repeat(78));

  const sinceTime = Date.now() - MONTHS_BACK * 30 * 86_400_000;
  const candles = await fetchBinancePaginated(SYMBOL, interval, sinceTime);
  console.log(`${candles.length} candles de ${new Date(candles[0].time).toISOString()} até ${new Date(candles[candles.length - 1].time).toISOString()}`);

  const pointValue = getPointValue(SYMBOL);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;
  console.log(`Custo round-trip estimado (CostModel.ts): ${(roundTripCostPct * 100).toFixed(4)}%`);

  const windows = splitWithEmbargo(candles, NUM_WINDOWS, 0.7, WARMUP_BARS);
  const trainTrades = windows.flatMap(w => runBacktest(w.train, 0, roundTripCostPct));
  const holdoutTrades = windows.flatMap(w => runBacktest(w.holdout, w.warmupBars, roundTripCostPct));

  console.log(`n_treino=${trainTrades.length}  n_holdout=${holdoutTrades.length}\n`);

  const results: Record<string, any> = {};
  results.LONG = reportGroup('LONG', holdoutTrades.filter(t => t.side === 'LONG'));
  results.SHORT = reportGroup('SHORT', holdoutTrades.filter(t => t.side === 'SHORT'));
  results.POOLED = reportGroup('POOLED', holdoutTrades);

  return { interval, nCandles: candles.length, roundTripCostPct, nHoldout: holdoutTrades.length, results, trades: holdoutTrades };
}

async function main() {
  console.log(`Teste executável: rompimento Donchian(${ENTRY_PERIOD})/saída Donchian(${EXIT_PERIOD}), ${SYMBOL}, contrato ${CONTRACT_SIZE_BTC} BTC, CUSTO REAL aplicado.`);
  console.log(`Objetivo: ver se o payoff ratio real (~1,8-1,9x, medido sem custo no diagnóstico) sobrevive ao custo de transação real.`);

  const allResults = [];
  for (const interval of INTERVALS) {
    const r = await runForInterval(interval);
    allResults.push(r);
    await sleep(500);
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log('AVISO DE RIGOR: mesma disciplina de holdout com embargo dos outros testes desta');
  console.log('sessão. Resultado líquido de custo real (CostModel.ts calibrado contra corretoras');
  console.log('reais Raw/ECN) — não é retorno bruto. n por grupo reportado explicitamente pra');
  console.log('avaliar poder estatístico contra o piso de 100 sinais do CRITERIA.md.');
  console.log('='.repeat(78));

  const outPath = `${process.cwd()}/research/experiments/2026-07-30-breakout-donchian-executable/output.json`;
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(), symbol: SYMBOL, entryPeriod: ENTRY_PERIOD, exitPeriod: EXIT_PERIOD,
    monthsBack: MONTHS_BACK, contractSizeBtc: CONTRACT_SIZE_BTC, perInterval: allResults,
  }, null, 2));
  console.log(`\nOutput bruto salvo em ${outPath}`);
}

main().catch(err => {
  console.error('Erro no teste executável de rompimento Donchian:', err);
  process.exit(1);
});
