/**
 * Opção (b) da pendência #1 (seções 11.11/11.12): ampliar a cesta de
 * instrumentos, escolhida pelo Cleber depois que os 5 presets da spec
 * esgotaram edge em forex major (11.5→11.12, todos DSR≤39,3%). Cripto
 * adicional é o único caminho pronto pra rodar sem violar a disciplina
 * "nunca fabricar dado": forex minors têm spread extrapolado (não medido,
 * ver CostModel.ts) e índices exigem trabalho de engenharia ainda não feito
 * (sem pointValue em TradeSizing.ts, disponibilidade de símbolo não
 * confirmada). Cripto tem custo modelado real (spread proporcional ao
 * preço, CostModel.ts) e dado público via Binance — sem depender da conta
 * MetaAPI compartilhada (risco de rate-limit documentado no CLAUDE.md).
 *
 * Mesma disciplina anti-overfitting de 11.10/11.11/11.12: ZERO grid search
 * novo, parâmetros de produção de `presetStrategies.ts` sem nenhum ajuste
 * (nTrials=1 por arquétipo, sr0=0 por desenho, DSR vira teste direto de
 * significância do Sharpe pooled contra zero). Os 5 arquétipos foram
 * calibrados originalmente sobre BTCUSDT (seção 11.4) — testar em 6 pares
 * cripto adicionais + BTCUSDT de novo (pooled) é um teste justo de
 * generalização, não reaproveitamento de fit.
 *
 * Cesta: 7 pares cripto líquidos (paralelo aos 7 majors forex da 11.10/11.11),
 * via Binance spot público (klines), sem chave de API.
 *
 * Profundidade de histórico por timeframe: capada em paridade com o que a
 * conta MetaAPI devolveu de fato pros mesmos timeframes na cesta forex
 * (11.11/11.12) — ~10 anos pros timeframes 1h/4h (poucas páginas, rápido),
 * ~60.000 candles pros timeframes 15m/1m (mesmo teto que a MetaAPI aplicou
 * de fato em 15m/1m na 11.12) — não é escolha arbitrária, é paridade com o
 * experimento anterior.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-crypto-basket/pooled-validate-crypto.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/pooled-validate-crypto.mjs && node /tmp/pooled-validate-crypto.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const INTER_SYMBOL_DELAY_MS = 1000;
const INTER_ARCHETYPE_DELAY_MS = 3000;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 5000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Páginas necessárias por timeframe pra bater a paridade de histórico descrita acima. */
function pagesForTimeframe(interval: string): number {
  switch (interval) {
    case '4h': return 22;  // ~10 anos
    case '1h': return 88;  // ~10 anos
    case '15m': return 60; // 60.000 candles — paridade com teto real da MetaAPI em 15m (11.12)
    case '1m': return 60;  // 60.000 candles — paridade com teto real da MetaAPI em 1m (11.12)
    default: throw new Error(`timeframe sem página calibrada: ${interval}`);
  }
}

async function fetchBinancePaginated(symbol: string, interval: string, pages: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (let p = 0; p < pages; p++) {
    let attempt = 0;
    for (;;) {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
      if (res.ok) {
        const raw: any[] = await res.json();
        if (raw.length === 0) return all;
        const page: Candle[] = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
        all.unshift(...page);
        endTime = page[0].time - 1;
        break;
      }
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`  [429 Binance ${symbol}, tentativa ${attempt + 1}/${MAX_RETRIES} — esperando ${backoff / 1000}s]`);
        await sleep(backoff);
        attempt++;
        continue;
      }
      throw new Error(`Sem dado real de ${symbol} ${interval}: HTTP ${res.status}. Sem fallback simulado por desenho.`);
    }
    if (p < pages - 1) await sleep(150);
  }
  return all;
}

/** Mesma disciplina das seções 11.5→11.12: 3 janelas cronológicas não sobrepostas, cada uma com split treino(70%)/holdout(30%) interno — nunca embaralhado. */
function threeWindows(candles: Candle[]): Array<{ train: Candle[]; holdout: Candle[] }> {
  const chunk = Math.floor(candles.length / 3);
  const windows: Array<{ train: Candle[]; holdout: Candle[] }> = [];
  for (let w = 0; w < 3; w++) {
    const slice = candles.slice(w * chunk, w === 2 ? candles.length : (w + 1) * chunk);
    const splitAt = Math.floor(slice.length * 0.7);
    windows.push({ train: slice.slice(0, splitAt), holdout: slice.slice(Math.max(0, splitAt - 60)) });
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

interface PerSymbolResult {
  symbol: string;
  nCandles: number;
  trainReturns: number[];
  holdoutReturns: number[];
}

async function evaluateArchetypePooled(archetypeName: string, strategy: Strategy, timeframe: string) {
  console.log(`\n═══ ${archetypeName} — parâmetros de produção (presetStrategies.ts), zero ajuste novo, pooled sobre ${SYMBOLS.length} pares cripto ═══\n`);

  const pages = pagesForTimeframe(timeframe);
  const perSymbol: PerSymbolResult[] = [];

  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`  buscando ${symbol} ${timeframe}... `);
    const candles = await fetchBinancePaginated(symbol, timeframe, pages);
    console.log(`${candles.length} candles`);

    const windows = threeWindows(candles);
    const trainReturns = windows.flatMap(w => netTradeReturns(w.train, strategy, symbol));
    const holdoutReturns = windows.flatMap(w => netTradeReturns(w.holdout, strategy, symbol));
    perSymbol.push({ symbol, nCandles: candles.length, trainReturns, holdoutReturns });

    if (i < SYMBOLS.length - 1) await sleep(INTER_SYMBOL_DELAY_MS);
  }

  console.log('\n  ── Por ativo (diagnóstico — não é o critério de decisão) ──');
  for (const r of perSymbol) {
    const sh = sharpeRatio(r.holdoutReturns);
    const net = r.holdoutReturns.reduce((a, b) => a + b, 0);
    console.log(`  ${r.symbol.padEnd(9)} n_holdout=${String(r.holdoutReturns.length).padEnd(4)} Sharpe=${sh.toFixed(3).padStart(7)}  retorno=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
  }

  const pooledTrain = perSymbol.flatMap(r => r.trainReturns);
  const pooledHoldout = perSymbol.flatMap(r => r.holdoutReturns);
  const pooledHoldoutSharpe = sharpeRatio(pooledHoldout);
  const pooledHoldoutNet = pooledHoldout.reduce((a, b) => a + b, 0);
  const positiveCount = perSymbol.filter(r => sharpeRatio(r.holdoutReturns) > 0).length;

  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(pooledHoldoutSharpe, sr0, pooledHoldout.length);

  console.log(`\n  ── Pooled (${SYMBOLS.length} pares × 3 janelas) — ESTE é o resultado que importa ──`);
  console.log(`  n_treino=${pooledTrain.length}  n_holdout=${pooledHoldout.length}`);
  console.log(`  Sharpe holdout pooled: ${pooledHoldoutSharpe.toFixed(3)}`);
  console.log(`  Retorno agregado holdout: ${pooledHoldoutNet >= 0 ? '+' : ''}${pooledHoldoutNet.toFixed(2)}%`);
  console.log(`  Pares individuais com Sharpe holdout positivo: ${positiveCount} de ${SYMBOLS.length}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95%' : '❌ mais provável que seja acaso do que edge'}`);

  return { archetypeName, pooledHoldoutSharpe, pooledHoldoutNet, dsr, nHoldout: pooledHoldout.length, positiveCount };
}

async function main() {
  console.log('Buscando dados reais (Binance spot público) — 7 pares cripto, 5 arquétipos, chamadas sequenciais espaçadas...');

  const donchian = PRESET_STRATEGIES.find(s => s.id === '1')!;
  const cruzamento = PRESET_STRATEGIES.find(s => s.id === '2')!;
  const reversao = PRESET_STRATEGIES.find(s => s.id === '3')!;
  const rompimento = PRESET_STRATEGIES.find(s => s.id === '4')!;
  const scalp = PRESET_STRATEGIES.find(s => s.id === '5')!;

  const results = [];
  results.push(await evaluateArchetypePooled('Rompimento de Canal (Donchian, stop=4×ATR)', donchian, '4h'));
  await sleep(INTER_ARCHETYPE_DELAY_MS);
  results.push(await evaluateArchetypePooled('Cruzamento EMA+ADX (stop=4,5×ATR)', cruzamento, '1h'));
  await sleep(INTER_ARCHETYPE_DELAY_MS);
  results.push(await evaluateArchetypePooled('Reversão à Média (RSI+Bollinger, stop=1,5×ATR)', reversao, '15m'));
  await sleep(INTER_ARCHETYPE_DELAY_MS);
  results.push(await evaluateArchetypePooled('Rompimento Confirmado (Volume/OBV, stop=1,5×ATR)', rompimento, '1h'));
  await sleep(INTER_ARCHETYPE_DELAY_MS);
  results.push(await evaluateArchetypePooled('Momentum de Curto Prazo (Scalp, stop=1×ATR)', scalp, '1m'));

  console.log('\n═══ Resumo final — DSR ≥ 95% é o único critério aceito como "edge provável" (mesmo piso da seção 8) ═══\n');
  for (const r of results) {
    console.log(`  ${r.archetypeName.padEnd(48)} n=${String(r.nHoldout).padEnd(5)} Sharpe=${r.pooledHoldoutSharpe.toFixed(3).padStart(7)}  DSR=${(r.dsr * 100).toFixed(1).padStart(5)}%  ${r.positiveCount}/${SYMBOLS.length} pares positivos`);
  }
}

main().catch(err => {
  console.error('Erro no experimento cripto:', err);
  process.exit(1);
});
