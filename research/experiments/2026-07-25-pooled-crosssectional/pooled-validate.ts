/**
 * Sugestão 1 do consultor quant (2026-07-25, ver conversa com o Cleber):
 * o problema real das rodadas 11.5→11.9 pode não ser "não há edge" — pode
 * ser poder estatístico insuficiente. Erro padrão do Sharpe estimado
 * (Lo, 2002): SE(SR) ≈ √((1 + 0,5·SR²) / n). Com n=19 (holdout Donchian,
 * seção 11.5/11.8), mesmo um Sharpe real de 0,5 (excelente pra day trade
 * sistemático) tem SE≈0,24 — t-stat na fronteira da significância ANTES da
 * correção do DSR por múltiplos testes. As rodadas anteriores não conseguem
 * distinguir "sem edge" de "edge moderado, amostra pequena demais pra provar".
 *
 * Este script NÃO faz grid search de parâmetro (isso já foi feito e esgotado
 * nas seções 11.5/11.8 — mais combinações só infla a penalidade do DSR sem
 * gerar mais n). Em vez disso, usa os parâmetros JÁ calibrados fora de amostra
 * na seção 11.4 (Donchian stop=4×ATR, Cruzamento EMA+ADX stop=4,5×ATR — presets
 * id '1' e '2' de `presetStrategies.ts`, sem nenhuma mudança) e roda a MESMA
 * estratégia fixa sobre uma cesta de 7 pares forex major, agrupando (pooling)
 * os trades de holdout de todos os pares num único vetor de retornos.
 *
 * Por que isso é estatisticamente correto e não "mais um grid search
 * disfarçado": a penalidade do DSR (seção 8 do AI_BRAIN_SPEC.md) é por
 * CONFIGURAÇÃO testada, não por ativo agrupado — nTrials aqui é 1 por
 * arquétipo (nenhum parâmetro foi ajustado olhando este dado), então
 * `expectedMaxSharpeUnderNull` retorna 0 e o DSR vira um teste direto de
 * significância do Sharpe pooled contra zero. Ganha-se ~7x mais n sem pagar
 * mais imposto de seleção.
 *
 * Efeito colateral diagnóstico: se o "edge" só aparecer isolado num par
 * específico e sumir no pool, isso por si só é evidência de que era
 * idiossincrasia daquele ativo, não edge do arquétipo.
 *
 * Fonte de dado: EXCLUSIVAMENTE `/mt5-candles-history` (MetaAPI real, mesma
 * rota da seção 11.8) — sem fallback simulado, erro explícito se faltar dado
 * real. Chamadas SEQUENCIAIS entre símbolos (delay de 2s) — risco crônico
 * documentado no CLAUDE.md do projeto: a conta MetaAPI é compartilhada entre
 * usuários e rajadas de chamada já causaram rate-limit (HTTP 429/504) no
 * passado. Nunca paralelizar contra ela.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-pooled-crosssectional/pooled-validate.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/pooled-validate.mjs && node /tmp/pooled-validate.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// 7 majors — todos elegíveis pra classe de custo FOREX_MAJOR (evita a
// extrapolação não confirmada de FOREX_MINOR/EXOTIC, ver CostModel.ts).
const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF'];
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;
const INTER_SYMBOL_DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchForexHistory(symbol: string, timeframe: string, startTime: string, endTime: string): Promise<Candle[]> {
  const res = await fetch(`${API_BASE}/mt5-candles-history`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, timeframe, startTime, endTime }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(
      `Sem dado real de ${symbol} ${timeframe} (${startTime} a ${endTime}): ${body.message || body.error || res.status}. ` +
      `Sem fallback simulado por desenho — corrigir credencial/conta MetaAPI antes de rodar de novo.`
    );
  }
  return body.candles.map((c: any) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

/** Mesma disciplina das seções 11.5/11.8: 3 janelas cronológicas não sobrepostas, cada uma com split treino(70%)/holdout(30%) interno — nunca embaralhado. */
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
  console.log(`\n═══ ${archetypeName} — parâmetros fixos (já calibrados na seção 11.4), pooled sobre ${SYMBOLS.length} pares ═══\n`);

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

  // nTrials=1: nenhum parâmetro foi ajustado olhando este dado (herda a
  // calibração da seção 11.4, feita sobre BTCUSDT, dado totalmente diferente)
  // — não há seleção a corrigir, sr0=0 por desenho de expectedMaxSharpeUnderNull.
  const sr0 = expectedMaxSharpeUnderNull(0, 1);
  const dsr = deflatedSharpeRatio(pooledHoldoutSharpe, sr0, pooledHoldout.length);

  console.log(`\n  ── Pooled (${SYMBOLS.length} pares × 3 janelas) — ESTE é o resultado que importa ──`);
  console.log(`  n_treino=${pooledTrain.length}  n_holdout=${pooledHoldout.length}`);
  console.log(`  Sharpe holdout pooled: ${pooledHoldoutSharpe.toFixed(3)}`);
  console.log(`  Retorno agregado holdout: ${pooledHoldoutNet >= 0 ? '+' : ''}${pooledHoldoutNet.toFixed(2)}%`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95%' : '❌ mais provável que seja acaso do que edge'}`);

  return { perSymbol, pooledHoldoutSharpe, pooledHoldoutNet, dsr, nHoldout: pooledHoldout.length };
}

async function main() {
  console.log('Buscando dados reais (MetaAPI, /mt5-candles-history) — 7 pares, chamadas sequenciais espaçadas...');

  // Donchian já descartado (seção 11.10, DSR 34%) — pulado aqui pra economizar
  // rate-limit da conta MetaAPI compartilhada e focar no que decide a pendência.
  const cruzamento = PRESET_STRATEGIES.find(s => s.id === '2')!;
  await evaluateArchetypePooled('Cruzamento de Médias EMA+ADX (stop=4,5×ATR)', cruzamento, '1h', 10);

  console.log('\n═══ Fim. DSR ≥ 95% é o único critério aceito como "edge provável" (mesmo piso da seção 8). ═══\n');
}

main().catch(err => {
  console.error('Erro no experimento pooled:', err);
  process.exit(1);
});
