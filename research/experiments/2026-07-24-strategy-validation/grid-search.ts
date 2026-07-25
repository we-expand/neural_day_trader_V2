/**
 * Busca sistemática, pedida pelo Cleber depois do resultado da seção 11.4
 * ("vamos pesquisar a fundo até acertar"). Diferença deste script pros
 * anteriores: aqui se testam DEZENAS de combinações de parâmetro de propósito
 * — e é exatamente por isso que precisa da correção estatística que
 * research/DeflatedSharpe.ts implementa. Testar muita coisa SEM essa correção
 * é como comprar cem bilhetes de loteria e apresentar o vencedor como prova de
 * sorte: alguma combinação vai parecer boa só por acaso, quanto mais se testa.
 *
 * Metodologia:
 * 1. Cada arquétipo é testado em 3 janelas de mercado cronológicas e NÃO
 *    sobrepostas (regimes de mercado diferentes: não é o mesmo período
 *    dividido 3x, são 3 pedaços distintos da história real do BTC).
 * 2. Dentro de cada janela, split 70/30 treino/holdout (mesma disciplina da
 *    seção 11.4) — a escolha de qual config é "melhor" olha só o treino; o
 *    holdout de cada janela nunca influencia a escolha, só mede o resultado.
 * 3. O Sharpe holdout AGREGADO (as 3 janelas concatenadas) do candidato
 *    escolhido no treino é o Sharpe reportado — e passa pelo Deflated Sharpe
 *    Ratio, corrigido pelo número real de candidatos testados naquele
 *    arquétipo (nTrials) e pela variância de Sharpe observada entre eles.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-24-strategy-validation/grid-search.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/grid-search.mjs && node /tmp/grid-search.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy, StrategyBlock } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';
import { sharpeRatio, expectedMaxSharpeUnderNull, deflatedSharpeRatio } from '../../DeflatedSharpe';

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
  }
  return all;
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
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;
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
  const holdoutNetPct = holdoutReturns.reduce((a, b) => a + b, 0); // soma simples de %/trade — proxy de retorno agregado, não composto (aceitável pra RANKEAR candidatos)
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

  // Escolha do campeão baseada SÓ no treino (holdout nunca influencia a escolha).
  const champion = results.reduce((best, r) => (r.trainSharpe > best.trainSharpe ? r : best));

  // Correção estatística: quantos candidatos foram testados, qual a variância
  // de Sharpe (treino) observada entre eles — isso é o que alimenta o piso
  // "esperado só por acaso" que o campeão precisa superar de verdade.
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
  console.log('\n═══ Busca sistemática com correção estatística (Deflated Sharpe Ratio) ═══\n');
  console.log('Buscando dados reais (Binance, paginado)...\n');

  const c4h = await fetchBinancePaginated('BTCUSDT', '4h', 9);
  const c1h = await fetchBinancePaginated('BTCUSDT', '1h', 27);
  const c15m = await fetchBinancePaginated('BTCUSDT', '15m', 30);

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
    runSearch('Rompimento de Canal (Donchian)', candidates, w4h, 'BTCUSDT');
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
    runSearch('Cruzamento de Médias com Filtro de Regime', candidates, w1h, 'BTCUSDT');
  }

  // ── Reversão à média: ADX threshold (mercado lateral) × RSI threshold × stop ──
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '3')!;
    const adxThresholds = [18, 22, 26, 30]; // afrouxar pode resolver a fome de sinal (só 4 trades na 1ª rodada)
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
    runSearch('Reversão à Média (RSI + Bollinger)', candidates, w15m, 'BTCUSDT');
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
    runSearch('Rompimento Confirmado (Volume)', candidates, w1h, 'BTCUSDT');
  }

  console.log('\n═══ Fim da busca sistemática. DSR ≥ 95% é o único critério aceito como "edge provável" — qualquer coisa abaixo disso, por melhor que pareça o retorno bruto, não se distingue de ruído dado quanto foi testado. ═══\n');
}

main().catch(err => {
  console.error('Erro na busca:', err);
  process.exit(1);
});
