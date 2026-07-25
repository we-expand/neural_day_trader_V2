/**
 * Hipótese #1 da seção 11.5 do AI_BRAIN_SPEC.md: os 4 arquétipos foram
 * testados só em BTCUSDT (seção 11.5) e no ensemble (11.7), sem edge
 * comprovado nos dois casos. A literatura de trend-following em que os
 * arquétipos se baseiam (Turtle Traders, AQR) foi construída sobre décadas de
 * futuros de moedas/commodities/índices — mercado com dinâmica macro diferente
 * de cripto. Este script repete EXATAMENTE a mesma metodologia estatística de
 * `../2026-07-24-strategy-validation/grid-search.ts` (mesmo protocolo de
 * janelas/holdout/DSR), trocando só a fonte de dado e o símbolo: EURUSD real
 * via MetaAPI (`/mt5-candles-history`, sem fallback simulado — erro explícito
 * se não houver dado real), classe de custo FOREX_MAJOR em vez de CRYPTO.
 *
 * Deliberadamente NÃO reintroduz o ensemble (seção 11.6/11.7) aqui — esta
 * rodada testa só a hipótese do instrumento, isolada, pra não confundir dois
 * resultados negativos possíveis (arquétipo individual vs. combinação).
 *
 * Fonte de dado: usa `/mt5-candles-history`, que já implementa paginação e
 * rate-limit (150ms entre chamadas, máx. 60 iterações) do lado do servidor —
 * este script faz só 3 chamadas HTTP (uma por timeframe), cada uma resolvendo
 * a paginação internamente. Não faz chamadas em paralelo contra a conta
 * MetaAPI compartilhada (risco crônico documentado no CLAUDE.md do projeto).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-forex-major/grid-search-forex.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/grid-search-forex.mjs && node /tmp/grid-search-forex.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy, StrategyBlock } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SYMBOL = 'EURUSD';
const API_BASE = `https://${projectId}.supabase.co/functions/v1/server`;

async function fetchForexHistory(timeframe: string, startTime: string, endTime: string): Promise<Candle[]> {
  const res = await fetch(`${API_BASE}/mt5-candles-history`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: SYMBOL, timeframe, startTime, endTime }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(
      `Sem dado real de ${SYMBOL} ${timeframe} (${startTime} a ${endTime}): ${body.message || body.error || res.status}. ` +
      `Sem fallback simulado por desenho — corrigir credencial/conta MetaAPI antes de rodar de novo.`
    );
  }
  return body.candles.map((c: any) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
}

/** 3 janelas cronológicas não sobrepostas, cada uma com split treino(70%)/holdout(30%) interno. */
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

function withBlock(blocks: StrategyBlock[], id: string, patch: Partial<StrategyBlock>): StrategyBlock[] {
  return blocks.map(b => (b.id === id ? { ...b, ...patch } : b));
}

interface Candidate {
  label: string;
  strategy: Strategy;
}

interface CandidateResult {
  label: string;
  trainSharpe: number;
  holdoutReturns: number[];
  holdoutSharpe: number;
  holdoutNetPct: number;
}

function evaluateCandidate(cand: Candidate, windows: Array<{ train: Candle[]; holdout: Candle[] }>, symbol: string): CandidateResult {
  const trainReturns = windows.flatMap(w => netTradeReturns(w.train, cand.strategy, symbol));
  const holdoutReturns = windows.flatMap(w => netTradeReturns(w.holdout, cand.strategy, symbol));
  const holdoutNetPct = holdoutReturns.reduce((a, b) => a + b, 0);
  return {
    label: cand.label,
    trainSharpe: sharpeRatio(trainReturns),
    holdoutReturns,
    holdoutSharpe: sharpeRatio(holdoutReturns),
    holdoutNetPct,
  };
}

function runSearch(archetypeName: string, candidates: Candidate[], windows: Array<{ train: Candle[]; holdout: Candle[] }>, symbol: string) {
  console.log(`\n── ${archetypeName} — ${candidates.length} candidatos testados, 3 janelas de mercado × treino/holdout ──`);

  const results = candidates.map(c => evaluateCandidate(c, windows, symbol));

  const champion = results.reduce((best, r) => (r.trainSharpe > best.trainSharpe ? r : best));

  const trainSharpes = results.map(r => r.trainSharpe);
  const meanTrain = trainSharpes.reduce((a, b) => a + b, 0) / trainSharpes.length;
  const varianceAcrossTrials = trainSharpes.reduce((a, s) => a + (s - meanTrain) ** 2, 0) / trainSharpes.length;
  const sr0 = expectedMaxSharpeUnderNull(varianceAcrossTrials, candidates.length);
  const dsr = deflatedSharpeRatio(champion.holdoutSharpe, sr0, champion.holdoutReturns.length);

  console.log(`  Campeão no TREINO: ${champion.label} (Sharpe treino=${champion.trainSharpe.toFixed(3)})`);
  console.log(`  Holdout (nunca visto): n=${champion.holdoutReturns.length}  Sharpe=${champion.holdoutSharpe.toFixed(3)}  retorno agregado=${champion.holdoutNetPct >= 0 ? '+' : ''}${champion.holdoutNetPct.toFixed(2)}%`);
  console.log(`  Sharpe esperado só por acaso (SR0, ${candidates.length} trials): ${sr0.toFixed(3)}`);
  console.log(`  Deflated Sharpe Ratio: ${(dsr * 100).toFixed(1)}%  ${dsr >= 0.95 ? '✅ acima do piso de 95% — provavelmente edge real' : dsr >= 0.5 ? '⚠️ abaixo do piso de 95% — não dá pra distinguir de acaso' : '❌ abaixo até do "mais provável que seja acaso do que edge"'}`);

  return { champion, dsr, sr0 };
}

async function main() {
  console.log(`\n═══ Hipótese #1 (seção 11.5): mesmos 4 arquétipos em ${SYMBOL} (forex major) ═══\n`);
  console.log('Buscando dados reais (MetaAPI, /mt5-candles-history)...\n');

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const yearsAgo = (n: number) => new Date(now.getTime() - n * 365 * 86_400_000);

  const c4h = await fetchForexHistory('4h', iso(yearsAgo(4)), iso(now));
  const c1h = await fetchForexHistory('1h', iso(yearsAgo(3)), iso(now));
  const c15m = await fetchForexHistory('15m', iso(yearsAgo(1)), iso(now));

  console.log(`4h: ${c4h.length} candles | 1h: ${c1h.length} candles | 15m: ${c15m.length} candles\n`);

  const w4h = threeWindows(c4h);
  const w1h = threeWindows(c1h);
  const w15m = threeWindows(c15m);

  // ── Donchian: período do canal × distância do stop ──────────────────────
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '1')!;
    const periods = [10, 20, 30, 55];
    const stops = [2, 3, 4, 5];
    const candidates: Candidate[] = [];
    for (const period of periods) {
      for (const stop of stops) {
        candidates.push({
          label: `Donchian(${period}) stop=${stop}xATR`,
          strategy: {
            ...base,
            atrStopMultiplier: stop,
            entryBlocks: withBlock(base.entryBlocks, base.entryBlocks[0].id, { comparePeriod: period }),
          },
        });
      }
    }
    runSearch('Rompimento de Canal (Donchian)', candidates, w4h, SYMBOL);
  }

  // ── Cruzamento de médias: períodos EMA × ADX threshold × stop ───────────
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '2')!;
    const emaPairs: Array<[number, number]> = [[10, 30], [20, 50], [50, 200]];
    const adxThresholds = [15, 20, 25];
    const stops = [2.5, 3.5, 4.5];
    const candidates: Candidate[] = [];
    for (const [fast, slow] of emaPairs) {
      for (const adx of adxThresholds) {
        for (const stop of stops) {
          candidates.push({
            label: `EMA(${fast}/${slow}) ADX>${adx} stop=${stop}xATR`,
            strategy: {
              ...base,
              atrStopMultiplier: stop,
              entryBlocks: base.entryBlocks.map(b =>
                b.indicator === 'EMA' && b.operator === 'CROSS_ABOVE' ? { ...b, period: fast, comparePeriod: slow } :
                b.indicator === 'EMA' && b.operator === 'RISING' ? { ...b, period: slow } : b
              ),
              exitBlocks: base.exitBlocks.map(b => (b.indicator === 'EMA' ? { ...b, period: fast, comparePeriod: slow } : b)),
              filterBlocks: withBlock(base.filterBlocks, base.filterBlocks[0].id, { value: adx }),
            },
          });
        }
      }
    }
    runSearch('Cruzamento de Médias com Filtro de Regime', candidates, w1h, SYMBOL);
  }

  // ── Reversão à média: ADX threshold (mercado lateral) × RSI threshold × stop ──
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '3')!;
    const adxThresholds = [18, 22, 26, 30];
    const rsiThresholds = [25, 30, 35];
    const stops = [1, 1.5, 2];
    const candidates: Candidate[] = [];
    for (const adx of adxThresholds) {
      for (const rsi of rsiThresholds) {
        for (const stop of stops) {
          candidates.push({
            label: `ADX<${adx} RSI<${rsi}/>${100 - rsi} stop=${stop}xATR`,
            strategy: {
              ...base,
              atrStopMultiplier: stop,
              entryBlocks: base.entryBlocks.map(b => (b.indicator === 'RSI' ? { ...b, value: rsi } : b)),
              filterBlocks: withBlock(base.filterBlocks, base.filterBlocks[0].id, { value: adx }),
            },
          });
        }
      }
    }
    runSearch('Reversão à Média (RSI + Bollinger)', candidates, w15m, SYMBOL);
  }

  // ── Rompimento Confirmado: período Donchian × stop × alvo ────────────────
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '4')!;
    const periods = [10, 20, 30];
    const stops = [1.5, 2, 3];
    const targets = [2, 3, 4];
    const candidates: Candidate[] = [];
    for (const period of periods) {
      for (const stop of stops) {
        for (const target of targets) {
          candidates.push({
            label: `Donchian(${period}) stop=${stop}xATR alvo=${target}xATR`,
            strategy: {
              ...base,
              atrStopMultiplier: stop,
              atrTakeProfitMultiplier: target,
              entryBlocks: withBlock(base.entryBlocks, base.entryBlocks[0].id, { comparePeriod: period }),
            },
          });
        }
      }
    }
    runSearch('Rompimento Confirmado (Volume)', candidates, w1h, SYMBOL);
  }

  console.log('\n═══ Fim da busca. DSR ≥ 95% é o único critério aceito como "edge provável". ═══\n');
}

main().catch(err => {
  console.error('Erro na busca:', err);
  process.exit(1);
});
