/**
 * Fase 2 do research/MASTER_PLAN.md (§6): remedir os 5 arquétipos-preset com
 * o motor de backtest CORRIGIDO na Fase 1 (2026-07-30) — ADX RMA, direção
 * explícita (fix da inversão do preset 3), exitBlock ATR FALLING removido do
 * preset 4, trailing sem look-ahead, empate TP/SL a favor do SL, sizing por
 * distância real do stop, split com embargo real (research/DataSplit.ts, sem
 * a sobreposição de 60 barras do padrão antigo).
 *
 * NENHUM resultado de 11.5-11.15 do AI_BRAIN_SPEC.md é reaproveitado — todos
 * mediram uma implementação com bugs confirmados (ver MASTER_PLAN.md §3).
 * Este script roda do zero, mesma cesta (7 pares forex major, 10 anos),
 * mesmos parâmetros JÁ em produção em presetStrategies.ts — ZERO grid search
 * novo (mesma disciplina anti-overfitting das rodadas anteriores).
 *
 * Ordem de teste por arquétipo, seguindo Livermore/Kestner (§4.6 do
 * MASTER_PLAN.md): primeiro skew de MFE/MAE (mais barato em poder
 * estatístico), só depois Sharpe/DSR pooled + por instrumento (nunca só
 * pooled — lição de Huang et al., §4.3).
 *
 * Chamadas SEQUENCIAIS entre símbolos (conta MetaAPI compartilhada, histórico
 * de HTTP 429/504 sob concorrência — ver CLAUDE.md). Output bruto salvo em
 * output.json ao final — cumprindo a regra criada pelo §3.6 do MASTER_PLAN.md
 * (nenhum experimento anterior salvou output, todo número existia só em prosa).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-30-fase2-remediation/remedir-arquetipos.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/fase2-remediation.mjs && node /tmp/fase2-remediation.mjs
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { runBacktest, Trade } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';
import { splitWithEmbargo } from '../../DataSplit';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;
// 2026-07-30: aumentado de 15s/20s depois que a 1a tentativa (sem cache)
// esgotou 6 retries com backoff exponencial no 3o de 35 fetches — a conta
// MetaAPI compartilhada estava sob mais pressão que o normal. Delays maiores
// + cache em disco (abaixo) reduzem o número de chamadas reais necessárias.
// 2026-07-30, 2a revisão: a 1a tentativa (25s/30s, cap 300s) ainda esgotou
// TODOS os retries no 1o símbolo — rate-limit sustentado, não pico isolado.
// Delays bem maiores agora; aceitando que uma rodada completa pode levar
// horas em vez de minutos.
const INTER_SYMBOL_DELAY_MS = 75000;
const INTER_ARCHETYPE_DELAY_MS = 90000;
const YEARS_BACK = 10;
const NUM_WINDOWS = 3;
const WARMUP_BARS = 200;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_RETRIES_ON_429 = 8;
const BACKOFF_BASE_MS = 45000;
const BACKOFF_CAP_MS = 600000; // 10min

// ── Cache em disco por (symbol, timeframe, janela de datas em dia) ──────────
// 2026-07-30: adicionado depois que a 1a tentativa deste script perdeu os
// fetches de EURUSD/GBPUSD (já pagos, rate-limit real) ao falhar em USDJPY —
// o script antigo só escrevia output.json no final, tudo ou nada. Com o
// cache, uma falha no meio (esperada, dado o rate-limit crônico da conta
// MetaAPI compartilhada — ver CLAUDE.md) custa só o(s) símbolo(s) que ainda
// não tinham sido buscados com sucesso, nunca o trabalho já feito. Também
// evita refetch duplicado entre presets que usam o MESMO timeframe (presets
// '2' e '4' são ambos 1h) — reduz o número real de chamadas à conta
// compartilhada, não só o custo de uma falha.
// import.meta.url aponta pro .mjs bundlado em /tmp (esbuild), não pro fonte —
// usa process.cwd() (sempre a raiz do repo, por convenção de como os scripts
// desta pasta são rodados) pra manter o cache dentro do experimento, não em
// /tmp (que evapora e quebraria a reprodutibilidade entre reruns).
const CACHE_DIR = `${process.cwd()}/research/experiments/2026-07-30-fase2-remediation/candle-cache/`;
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(symbol: string, timeframe: string, startTime: string, endTime: string): string {
  const day = (iso: string) => iso.slice(0, 10);
  return `${CACHE_DIR}${symbol}_${timeframe}_${day(startTime)}_${day(endTime)}.json`;
}

async function fetchForexHistory(symbol: string, timeframe: string, startTime: string, endTime: string): Promise<Candle[]> {
  const cachePath = cacheKey(symbol, timeframe, startTime, endTime);
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
    console.log(`[cache hit, ${cached.length} candles]`);
    return cached;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
    const res = await fetch(`${API_BASE}/mt5-candles-history`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timeframe, startTime, endTime }),
    });
    const body = await res.json();
    const isRetryable = res.status === 429 || res.status === 504 || /429|504|TimeoutError|TooManyRequests/.test(String(body.message || body.error || body.detail || ''));
    if (res.ok && body.success) {
      const candles: Candle[] = body.candles.map((c: any) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      writeFileSync(cachePath, JSON.stringify(candles));
      return candles;
    }
    if (isRetryable && attempt < MAX_RETRIES_ON_429) {
      const backoff = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_CAP_MS);
      console.log(`  [erro retryable em ${symbol} (tentativa ${attempt + 1}/${MAX_RETRIES_ON_429 + 1}) — esperando ${backoff / 1000}s]`);
      await sleep(backoff);
      continue;
    }
    throw new Error(
      `Sem dado real de ${symbol} ${timeframe} (${startTime} a ${endTime}): ${body.message || body.error || res.status}. ` +
      `Sem fallback simulado por desenho — corrigir credencial/conta MetaAPI antes de rodar de novo. ` +
      `Rerodar o script reaproveita via cache (${CACHE_DIR}) tudo que já foi buscado com sucesso.`
    );
  }
  throw new Error(`Sem dado real de ${symbol} ${timeframe}: esgotou tentativas de retry.`);
}

/** Assimetria amostral (g1, Fisher-Pearson, sem correção de viés — amostra já é o holdout inteiro, não uma estimativa de população maior). */
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

interface TradeSample {
  symbol: string;
  trades: Trade[];
}

function netTradeReturns(candles: Candle[], strategy: Strategy, symbol: string, warmupBars: number): Trade[] {
  const pointValue = getPointValue(symbol);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('FOREX_MAJOR', priceLevel, pointValue) * 2;
  const res = runBacktest(candles, strategy, symbol, 'both', 10000, roundTripCostPct);
  // Só trades cuja ENTRADA aconteceu depois do warmup contam como observação
  // real — ver research/DataSplit.ts, uso correto do split com embargo.
  return res.trades.filter(t => t.entryIndex >= warmupBars);
}

async function evaluateArchetype(archetypeName: string, presetId: string, strategy: Strategy, timeframe: string) {
  console.log(`\n═══ ${archetypeName} (preset id='${presetId}') — parâmetros de produção, zero ajuste, motor CORRIGIDO ═══\n`);

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const start = iso(new Date(now.getTime() - YEARS_BACK * 365 * 86_400_000));
  const end = iso(now);

  const trainSamples: TradeSample[] = [];
  const holdoutSamples: TradeSample[] = [];

  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`  buscando ${symbol} ${timeframe}... `);
    const candles = await fetchForexHistory(symbol, timeframe, start, end);
    console.log(`${candles.length} candles`);

    const windows = splitWithEmbargo(candles, NUM_WINDOWS, 0.7, WARMUP_BARS);
    const trainTrades = windows.flatMap(w => netTradeReturns(w.train, strategy, symbol, 0));
    const holdoutTrades = windows.flatMap(w => netTradeReturns(w.holdout, strategy, symbol, w.warmupBars));
    trainSamples.push({ symbol, trades: trainTrades });
    holdoutSamples.push({ symbol, trades: holdoutTrades });

    if (i < SYMBOLS.length - 1) await sleep(INTER_SYMBOL_DELAY_MS);
  }

  // ── 1. Skew de MFE/MAE primeiro (mais barato em poder estatístico, §4.6) ──
  const pooledHoldoutTrades = holdoutSamples.flatMap(s => s.trades);
  const mfeValues = pooledHoldoutTrades.map(t => t.mfePercent);
  const maeValues = pooledHoldoutTrades.map(t => t.maePercent);
  const mfeMaeRatio = pooledHoldoutTrades.map(t => (t.maePercent > 0 ? t.mfePercent / t.maePercent : t.mfePercent > 0 ? Infinity : 0));
  const mfeSkew = skewness(mfeValues);
  const maeSkew = skewness(maeValues);
  const meanMfe = mfeValues.reduce((a, b) => a + b, 0) / (mfeValues.length || 1);
  const meanMae = maeValues.reduce((a, b) => a + b, 0) / (maeValues.length || 1);
  const finiteRatios = mfeMaeRatio.filter(r => Number.isFinite(r));
  const medianRatio = finiteRatios.length ? finiteRatios.slice().sort((a, b) => a - b)[Math.floor(finiteRatios.length / 2)] : NaN;

  console.log(`\n  ── Skew de MFE/MAE (holdout pooled, n=${pooledHoldoutTrades.length}) — critério barato de vida-ou-morte (§4.6) ──`);
  console.log(`  MFE médio: ${meanMfe.toFixed(3)}%  skew: ${mfeSkew.toFixed(3)}`);
  console.log(`  MAE médio: ${meanMae.toFixed(3)}%  skew: ${maeSkew.toFixed(3)}`);
  console.log(`  Razão MFE/MAE (mediana): ${Number.isFinite(medianRatio) ? medianRatio.toFixed(3) : 'n/d'}  ${medianRatio > 1.2 ? '✅ assimetria positiva real — payoff convexo' : medianRatio < 0.8 ? '❌ assimetria negativa — payoff côncavo, contra a tese de tendência' : '⚠️ sem assimetria clara'}`);

  // ── 2. Sharpe/DSR por instrumento E pooled (nunca só pooled, §4.3) ──
  console.log('\n  ── Por ativo (diagnóstico) ──');
  const perSymbolStats = holdoutSamples.map(s => {
    const returns = s.trades.map(t => t.profitPercent);
    const sh = sharpeRatio(returns);
    const net = returns.reduce((a, b) => a + b, 0);
    console.log(`  ${s.symbol.padEnd(8)} n_holdout=${String(returns.length).padEnd(4)} Sharpe=${sh.toFixed(3).padStart(7)}  retorno=${net >= 0 ? '+' : ''}${net.toFixed(2)}%`);
    return { symbol: s.symbol, nHoldout: returns.length, sharpe: sh, netReturn: net };
  });

  const pooledHoldoutReturns = pooledHoldoutTrades.map(t => t.profitPercent);
  const pooledTrainReturns = trainSamples.flatMap(s => s.trades.map(t => t.profitPercent));
  const pooledHoldoutSharpe = sharpeRatio(pooledHoldoutReturns);
  const pooledHoldoutNet = pooledHoldoutReturns.reduce((a, b) => a + b, 0);
  const positiveCount = perSymbolStats.filter(s => s.sharpe > 0).length;

  const sr0 = expectedMaxSharpeUnderNull(0, 1); // nTrials=1: zero grid search novo, mesmo parâmetro de produção
  const dsr = deflatedSharpeRatio(pooledHoldoutSharpe, sr0, pooledHoldoutReturns.length);

  console.log(`\n  ── Pooled (${SYMBOLS.length} pares × ${NUM_WINDOWS} janelas, embargo real) — ESTE é o resultado que importa ──`);
  console.log(`  n_treino=${pooledTrainReturns.length}  n_holdout=${pooledHoldoutReturns.length}`);
  console.log(`  Sharpe holdout pooled: ${pooledHoldoutSharpe.toFixed(3)}`);
  console.log(`  Retorno agregado holdout: ${pooledHoldoutNet >= 0 ? '+' : ''}${pooledHoldoutNet.toFixed(2)}%`);
  console.log(`  Pares individuais com Sharpe holdout positivo: ${positiveCount} de ${SYMBOLS.length}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95%' : '❌ mais provável que seja acaso do que edge'}`);

  return {
    archetypeName, presetId, timeframe,
    mfeMae: { n: pooledHoldoutTrades.length, meanMfe, meanMae, mfeSkew, maeSkew, medianMfeMaeRatio: medianRatio },
    perSymbol: perSymbolStats,
    pooled: { nTrain: pooledTrainReturns.length, nHoldout: pooledHoldoutReturns.length, sharpe: pooledHoldoutSharpe, netReturn: pooledHoldoutNet, dsr, positiveCount, totalSymbols: SYMBOLS.length },
  };
}

async function main() {
  console.log(`Fase 2 (research/MASTER_PLAN.md §6) — remedição dos 5 arquétipos com o motor corrigido.`);
  console.log(`Cesta: ${SYMBOLS.join(', ')} — ${YEARS_BACK} anos, ${NUM_WINDOWS} janelas com embargo real (warmup=${WARMUP_BARS} barras).\n`);

  const presets = ['1', '2', '3', '4', '5'].map(id => PRESET_STRATEGIES.find(s => s.id === id)!);
  const names: Record<string, string> = {
    '1': 'Rompimento de Canal (Donchian)',
    '2': 'Cruzamento de Médias com Filtro de Regime',
    '3': 'Reversão à Média (RSI + Bollinger) — testar SE o sinal mudou de lado após o fix de inversão',
    '4': 'Rompimento Confirmado (Volume/OBV) — sem o exitBlock ATR FALLING removido',
    '5': 'Momentum de Curto Prazo (Scalp)',
  };

  const results = [];
  for (let i = 0; i < presets.length; i++) {
    const strategy = presets[i];
    results.push(await evaluateArchetype(names[strategy.id], strategy.id, strategy, strategy.timeframe));
    if (i < presets.length - 1) await sleep(INTER_ARCHETYPE_DELAY_MS);
  }

  console.log('\n\n═══ RESUMO FINAL — Fase 2, motor corrigido, DSR ≥ 95% é o único piso aceito como "edge provável" ═══\n');
  for (const r of results) {
    console.log(`  ${r.archetypeName.slice(0, 55).padEnd(55)} n=${String(r.pooled.nHoldout).padEnd(5)} Sharpe=${r.pooled.sharpe.toFixed(3).padStart(7)}  DSR=${(r.pooled.dsr * 100).toFixed(1).padStart(5)}%  ${r.pooled.positiveCount}/${r.pooled.totalSymbols} pares  skewMFE=${r.mfeMae.mfeSkew.toFixed(2)}  razãoMFE/MAE=${Number.isFinite(r.mfeMae.medianMfeMaeRatio) ? r.mfeMae.medianMfeMaeRatio.toFixed(2) : 'n/d'}`);
  }

  const outPath = `${process.cwd()}/research/experiments/2026-07-30-fase2-remediation/output.json`;
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), symbols: SYMBOLS, yearsBack: YEARS_BACK, numWindows: NUM_WINDOWS, warmupBars: WARMUP_BARS, results }, null, 2));
  console.log(`\nOutput bruto salvo em ${outPath}`);
}

main().catch(err => {
  console.error('Erro no experimento de remedição da Fase 2:', err);
  process.exit(1);
});
