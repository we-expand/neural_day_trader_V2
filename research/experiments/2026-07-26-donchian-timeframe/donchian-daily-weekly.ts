/**
 * Opção (c) da pendência #1 (seções 11.12/11.13): revisar timeframe antes de
 * inventar mais arquétipo ou ampliar mais instrumento. Donchian é o único
 * arquétipo com sinal não-negativo de toda a investigação (seção 11.13, DSR
 * 52,0% em cripto 4h, Sharpe pooled ~0,003, 4/7 pares positivos) — e é
 * trend-following clássico (Turtle Traders/AQR, citado na seção 11.5), estilo
 * historicamente construído sobre barras DIÁRIAS/SEMANAIS, nunca sobre
 * intraday. Nenhum dos 5 presets da spec foi testado acima de 4h até agora.
 *
 * Testa o MESMO Donchian (id '1', stop=4×ATR, sem nenhum ajuste de parâmetro
 * — mesma disciplina anti-overfitting de 11.10→11.13) em 1d e 1w, na mesma
 * cesta de 7 pares cripto da seção 11.13 (Binance público, custo já corrigido
 * no CostModel.ts). nTrials=1 por timeframe testado (não é grid search: é
 * mudar o dado observado, não escolher entre configurações).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-26-donchian-timeframe/donchian-daily-weekly.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/donchian-daily-weekly.mjs && node /tmp/donchian-daily-weekly.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (raw.length < 1000) break;
    await sleep(150);
  }
  return all;
}

function threeWindows(candles: Candle[]): Array<{ train: Candle[]; holdout: Candle[] }> {
  const chunk = Math.floor(candles.length / 3);
  const windows: Array<{ train: Candle[]; holdout: Candle[] }> = [];
  for (let w = 0; w < 3; w++) {
    const slice = candles.slice(w * chunk, w === 2 ? candles.length : (w + 1) * chunk);
    const splitAt = Math.floor(slice.length * 0.7);
    windows.push({ train: slice.slice(0, splitAt), holdout: slice.slice(Math.max(0, splitAt - 20)) });
  }
  return windows;
}

function netTradeReturns(candles: Candle[], strategy: Strategy, symbol: string): number[] {
  const pointValue = getPointValue(symbol);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;
  const res = runBacktest(candles, strategy, symbol, 'both', 10000, roundTripCostPct);
  return res.trades.map(t => t.profitPercent);
}

async function evaluateTimeframe(strategy: Strategy, timeframe: string, pages: number) {
  console.log(`\n═══ Donchian (stop=4×ATR, produção) em ${timeframe} — pooled sobre ${SYMBOLS.length} pares cripto ═══\n`);

  const perSymbol: Array<{ symbol: string; nCandles: number; trainReturns: number[]; holdoutReturns: number[] }> = [];

  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`  buscando ${symbol} ${timeframe}... `);
    const candles = await fetchBinancePaginated(symbol, timeframe, pages);
    console.log(`${candles.length} candles`);

    const windows = threeWindows(candles);
    const trainReturns = windows.flatMap(w => netTradeReturns(w.train, strategy, symbol));
    const holdoutReturns = windows.flatMap(w => netTradeReturns(w.holdout, strategy, symbol));
    perSymbol.push({ symbol, nCandles: candles.length, trainReturns, holdoutReturns });

    if (i < SYMBOLS.length - 1) await sleep(500);
  }

  console.log('\n  ── Por ativo (diagnóstico) ──');
  for (const r of perSymbol) {
    const sh = sharpeRatio(r.holdoutReturns);
    const net = r.holdoutReturns.reduce((a, b) => a + b, 0);
    console.log(`  ${r.symbol.padEnd(9)} n_holdout=${String(r.holdoutReturns.length).padEnd(4)} Sharpe=${sh.toFixed(3).padStart(7)}  retorno=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
  }

  const pooledHoldout = perSymbol.flatMap(r => r.holdoutReturns);
  const pooledHoldoutSharpe = sharpeRatio(pooledHoldout);
  const pooledHoldoutNet = pooledHoldout.reduce((a, b) => a + b, 0);
  const positiveCount = perSymbol.filter(r => sharpeRatio(r.holdoutReturns) > 0).length;
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(pooledHoldoutSharpe, sr0, pooledHoldout.length);

  console.log(`\n  ── Pooled — ESTE é o resultado que importa ──`);
  console.log(`  n_holdout=${pooledHoldout.length}`);
  console.log(`  Sharpe holdout pooled: ${pooledHoldoutSharpe.toFixed(3)}`);
  console.log(`  Retorno agregado holdout: ${pooledHoldoutNet >= 0 ? '+' : ''}${pooledHoldoutNet.toFixed(2)}%`);
  console.log(`  Pares individuais com Sharpe holdout positivo: ${positiveCount} de ${SYMBOLS.length}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95%' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95%' : '❌ mais provável acaso'}`);

  if (pooledHoldout.length < 100) {
    console.log(`  ⚠️ n_holdout=${pooledHoldout.length} < 100 — abaixo da amostra mínima da seção 8 do AI_BRAIN_SPEC.md. Resultado inconclusivo por desenho, mesmo que o número pareça bom.`);
  }

  return { timeframe, pooledHoldoutSharpe, dsr, nHoldout: pooledHoldout.length, positiveCount };
}

async function main() {
  const donchian = PRESET_STRATEGIES.find(s => s.id === '1')!;
  const results = [];
  results.push(await evaluateTimeframe(donchian, '1d', 4));
  await sleep(1000);
  results.push(await evaluateTimeframe(donchian, '1w', 1));

  console.log('\n═══ Resumo — Donchian por timeframe (mesma cesta cripto, mesmo parâmetro) ═══\n');
  console.log(`  4h (seção 11.13, referência): n=329  Sharpe=0.003  DSR=52.0%  4/7 pares positivos`);
  for (const r of results) {
    console.log(`  ${r.timeframe.padEnd(4)} n=${String(r.nHoldout).padEnd(5)} Sharpe=${r.pooledHoldoutSharpe.toFixed(3).padStart(7)}  DSR=${(r.dsr * 100).toFixed(1).padStart(5)}%  ${r.positiveCount}/${SYMBOLS.length} pares positivos`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
