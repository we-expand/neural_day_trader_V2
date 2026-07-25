/**
 * Continuação da 11.10/11.11: os únicos 2 arquétipos já testados com o método
 * correto (pooling cross-sectional, 7 pares forex major, calendário longo,
 * nTrials=1) são Donchian e Cruzamento EMA+ADX — e ambos já foram descartados
 * (34,0% e 39,3% de DSR respectivamente, ver seção 11.11). Os outros 3 presets
 * (Reversão à Média, Rompimento Confirmado, Scalp) só passaram pelo grid
 * search cripto (seção 11.5, DSR<1% pros dois primeiros) e forex isolado
 * (seção 11.8) — nunca pelo pooling que corrigiu o problema de poder
 * estatístico. Este script fecha essa lacuna.
 *
 * Mesma disciplina anti-overfitting da 11.10/11.11: ZERO grid search novo,
 * usa os parâmetros já em produção em `presetStrategies.ts` (ids '3', '4',
 * '5') sem nenhum ajuste — nTrials=1 por arquétipo, sr0=0 por desenho.
 * Calendário longo (10 anos) desde a primeira rodada — a 11.11 já mostrou que
 * confirmar em janela curta primeiro e estender depois é enganoso (o DSR
 * 85,3%/3 anos não sobreviveu a 10 anos).
 *
 * id '5' (Scalp, timeframe 1m) pode não ter 10 anos de candles 1m disponíveis
 * via broker — o fetch usa o que a MetaAPI devolver, sem fallback simulado
 * (mesma disciplina da 11.11, que já viu NZDUSD devolver só 2,75 anos em 1h).
 *
 * Chamadas SEQUENCIAIS entre símbolos E entre arquétipos (delay de 5s) —
 * risco crônico documentado no CLAUDE.md: conta MetaAPI compartilhada,
 * rajada já causou HTTP 429/504 no passado. Nunca paralelizar.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-pooled-crosssectional/pooled-validate-345.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/pooled-validate-345.mjs && node /tmp/pooled-validate-345.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;
const INTER_SYMBOL_DELAY_MS = 15000;
const INTER_ARCHETYPE_DELAY_MS = 20000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_RETRIES_ON_429 = 4;
const BACKOFF_BASE_MS = 30000;

async function fetchForexHistory(symbol: string, timeframe: string, startTime: string, endTime: string): Promise<Candle[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
    const res = await fetch(`${API_BASE}/mt5-candles-history`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe, startTime, endTime }),
    });
    const body = await res.json();
    const is429 = res.status === 429 || /429/.test(String(body.message || body.error || ''));
    if (res.ok && body.success) {
      return body.candles.map((c: any) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    }
    if (is429 && attempt < MAX_RETRIES_ON_429) {
      const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.log(`  [429 em ${symbol}, tentativa ${attempt + 1}/${MAX_RETRIES_ON_429 + 1} — esperando ${backoff / 1000}s antes de tentar de novo]`);
      await sleep(backoff);
      continue;
    }
    throw new Error(
      `Sem dado real de ${symbol} ${timeframe} (${startTime} a ${endTime}): ${body.message || body.error || res.status}. ` +
      `Sem fallback simulado por desenho — corrigir credencial/conta MetaAPI antes de rodar de novo.`
    );
  }
  throw new Error(`Sem dado real de ${symbol} ${timeframe}: esgotou tentativas de retry após 429 repetido.`);
}

/** Mesma disciplina das seções 11.5/11.8/11.10/11.11: 3 janelas cronológicas não sobrepostas, cada uma com split treino(70%)/holdout(30%) interno — nunca embaralhado. */
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
  const roundTripCostPct = estimateCostPercent('FOREX_MAJOR', priceLevel, pointValue) * 2;
  const res = runBacktest(candles, strategy, symbol, 'both', 10000, roundTripCostPct);
  return res.trades.map(t => t.profitPercent);
}

interface PerSymbolResult {
  symbol: string;
  nCandles: number;
  trainReturns: number[];
  holdoutReturns: number[];
}

async function evaluateArchetypePooled(
  archetypeName: string,
  strategy: Strategy,
  timeframe: string,
  yearsBack: number,
) {
  console.log(`\n═══ ${archetypeName} — parâmetros de produção (presetStrategies.ts), zero ajuste novo, pooled sobre ${SYMBOLS.length} pares ═══\n`);

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const start = iso(new Date(now.getTime() - yearsBack * 365 * 86_400_000));
  const end = iso(now);

  const perSymbol: PerSymbolResult[] = [];

  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`  buscando ${symbol} ${timeframe}... `);
    const candles = await fetchForexHistory(symbol, timeframe, start, end);
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
    console.log(`  ${r.symbol.padEnd(8)} n_holdout=${String(r.holdoutReturns.length).padEnd(4)} Sharpe=${sh.toFixed(3).padStart(7)}  retorno=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
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

  return { archetypeName, perSymbol, pooledHoldoutSharpe, pooledHoldoutNet, dsr, nHoldout: pooledHoldout.length, positiveCount };
}

async function main() {
  console.log('Buscando dados reais (MetaAPI, /mt5-candles-history) — 7 pares, 3 arquétipos, chamadas sequenciais espaçadas...');

  const rompimento = PRESET_STRATEGIES.find(s => s.id === '4')!;
  const scalp = PRESET_STRATEGIES.find(s => s.id === '5')!;

  // Reversão à Média (id '3') já rodou com sucesso na tentativa anterior:
  // DSR 0,0%, Sharpe pooled -0,311, 1/7 pares positivos — sem edge, não
  // repetir (rate-limit da conta MetaAPI é recurso escasso).
  const results = [];
  results.push(await evaluateArchetypePooled('Rompimento Confirmado (Volume/OBV, stop=1,5×ATR)', rompimento, '1h', 10));
  await sleep(INTER_ARCHETYPE_DELAY_MS);
  results.push(await evaluateArchetypePooled('Momentum de Curto Prazo (Scalp, stop=1×ATR)', scalp, '1m', 10));

  console.log('\n═══ Resumo final — DSR ≥ 95% é o único critério aceito como "edge provável" (mesmo piso da seção 8) ═══\n');
  for (const r of results) {
    console.log(`  ${r.archetypeName.padEnd(55)} n=${String(r.nHoldout).padEnd(5)} Sharpe=${r.pooledHoldoutSharpe.toFixed(3).padStart(7)}  DSR=${(r.dsr * 100).toFixed(1).padStart(5)}%  ${r.positiveCount}/${SYMBOLS.length} pares positivos`);
  }
}

main().catch(err => {
  console.error('Erro no experimento pooled:', err);
  process.exit(1);
});
