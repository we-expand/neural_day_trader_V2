/**
 * Investigação dos 2 achados de research/AI_BRAIN_SPEC.md seção 11.3, com
 * split treino/holdout cronológico (nunca embaralhado — walk-forward real,
 * mesma disciplina do MarketScoreValidator) pra não cair em otimização
 * retroativa: testa variações de parâmetro nos primeiros 70% do histórico,
 * escolhe a melhor, e só aceita se ela SUSTENTAR nos últimos 30% nunca vistos
 * durante o ajuste. Uma variação que só funciona no treino é descartada,
 * mesmo que pareça melhor.
 *
 * Hipóteses testadas (uma por arquétipo, decorrentes da decomposição por
 * motivo de saída da rodada anterior):
 *   1) Donchian / Cruzamento EMA+ADX: 89-91% dos trades batem STOP LOSS —
 *      testa se stop mais largo (menos ruído derrubando o trade antes da
 *      tendência real aparecer) melhora o resultado.
 *   2) Rompimento Confirmado: 67-82% fecham pela regra "ATR em contração"
 *      com retorno ~0% — testa remover essa saída (deixar só TP/SL/trailing
 *      decidir) pra ver se o R:R nominal se realiza melhor sem o corte cedo.
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-24-strategy-validation/investigate.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/investigate.mjs && node /tmp/investigate.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Strategy } from '../../../src/app/types/strategy';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';

async function fetchBinanceCandlesPaginated(symbol: string, interval: string, pages: number): Promise<Candle[]> {
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

function netReturnPct(candles: Candle[], strategy: Strategy, symbol: string, assetClass: 'CRYPTO'): { returnPct: number; n: number; hitRate: number } {
  const pointValue = getPointValue(symbol);
  const priceLevel = candles[candles.length - 1].close;
  const roundTripCostPct = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
  const res = runBacktest(candles, strategy, symbol, 'both', 10000, roundTripCostPct);
  const wins = res.trades.filter(t => t.status === 'win').length;
  return {
    returnPct: ((res.finalEquity - 10000) / 10000) * 100,
    n: res.trades.length,
    hitRate: res.trades.length > 0 ? (wins / res.trades.length) * 100 : 0,
  };
}

function fmt(r: { returnPct: number; n: number; hitRate: number }): string {
  return `n=${r.n.toString().padStart(4)}  hit=${r.hitRate.toFixed(1)}%  líquido=${r.returnPct >= 0 ? '+' : ''}${r.returnPct.toFixed(2)}%`;
}

async function main() {
  console.log('\n═══ Investigação — split treino(70%)/holdout(30%), cronológico, nunca embaralhado ═══\n');

  console.log('Buscando BTCUSDT 1h paginado (~27000 candles reais, Binance)...');
  const candles1h = await fetchBinanceCandlesPaginated('BTCUSDT', '1h', 27);
  console.log(`${candles1h.length} candles reais carregados.\n`);

  const splitAt = Math.floor(candles1h.length * 0.7);
  // Warmup de 60 candles se repete no início do holdout de propósito — o
  // motor precisa desse aquecimento pra EMA200/etc estabilizarem; sem
  // sobreposição de TRADE nenhum (o holdout só começa a abrir posição depois
  // do candle splitAt, mesma disciplina walk-forward do MarketScoreValidator).
  const train = candles1h.slice(0, splitAt);
  const holdout = candles1h.slice(splitAt - 60);

  console.log(`Treino: ${train.length} candles | Holdout: ${holdout.length} candles (últimos ~30%, nunca vistos durante o ajuste)\n`);

  // ─── Hipótese 1: Donchian — stop mais largo ajuda? ───────────────────────
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '1')!;
    console.log(`── ${base.name}: variando atrStopMultiplier (base=${base.atrStopMultiplier}) ──`);
    console.log(`  baseline (treino)  ${fmt(netReturnPct(train, base, 'BTCUSDT', 'CRYPTO'))}`);

    const candidates = [2.5, 3, 4].map(m => ({ ...base, atrStopMultiplier: m }));
    let best = { strategy: base, result: netReturnPct(train, base, 'BTCUSDT', 'CRYPTO') };
    for (const cand of candidates) {
      const r = netReturnPct(train, cand, 'BTCUSDT', 'CRYPTO');
      console.log(`  atrStopMultiplier=${cand.atrStopMultiplier}  (treino)  ${fmt(r)}`);
      if (r.returnPct > best.result.returnPct) best = { strategy: cand, result: r };
    }
    console.log(`  → melhor no treino: atrStopMultiplier=${best.strategy.atrStopMultiplier}`);
    if (best.strategy.atrStopMultiplier === base.atrStopMultiplier) {
      console.log(`  Nenhuma variação superou o baseline no treino — sem mudança a validar no holdout.\n`);
    } else {
      const holdoutBase = netReturnPct(holdout, base, 'BTCUSDT', 'CRYPTO');
      const holdoutBest = netReturnPct(holdout, best.strategy, 'BTCUSDT', 'CRYPTO');
      console.log(`  HOLDOUT (nunca visto) — baseline: ${fmt(holdoutBase)}`);
      console.log(`  HOLDOUT (nunca visto) — atrStopMultiplier=${best.strategy.atrStopMultiplier}: ${fmt(holdoutBest)}`);
      console.log(`  ${holdoutBest.returnPct > holdoutBase.returnPct ? '✅ SUSTENTOU no holdout' : '❌ NÃO sustentou no holdout — descartar, era ajuste ao ruído do treino'}\n`);
    }
  }

  // ─── Hipótese 2: Cruzamento EMA+ADX — stop mais largo ajuda? ─────────────
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '2')!;
    console.log(`── ${base.name}: variando atrStopMultiplier (base=${base.atrStopMultiplier}) ──`);
    console.log(`  baseline (treino)  ${fmt(netReturnPct(train, base, 'BTCUSDT', 'CRYPTO'))}`);

    const candidates = [3, 3.5, 4.5].map(m => ({ ...base, atrStopMultiplier: m }));
    let best = { strategy: base, result: netReturnPct(train, base, 'BTCUSDT', 'CRYPTO') };
    for (const cand of candidates) {
      const r = netReturnPct(train, cand, 'BTCUSDT', 'CRYPTO');
      console.log(`  atrStopMultiplier=${cand.atrStopMultiplier}  (treino)  ${fmt(r)}`);
      if (r.returnPct > best.result.returnPct) best = { strategy: cand, result: r };
    }
    console.log(`  → melhor no treino: atrStopMultiplier=${best.strategy.atrStopMultiplier}`);
    if (best.strategy.atrStopMultiplier === base.atrStopMultiplier) {
      console.log(`  Nenhuma variação superou o baseline no treino — sem mudança a validar no holdout.\n`);
    } else {
      const holdoutBase = netReturnPct(holdout, base, 'BTCUSDT', 'CRYPTO');
      const holdoutBest = netReturnPct(holdout, best.strategy, 'BTCUSDT', 'CRYPTO');
      console.log(`  HOLDOUT (nunca visto) — baseline: ${fmt(holdoutBase)}`);
      console.log(`  HOLDOUT (nunca visto) — atrStopMultiplier=${best.strategy.atrStopMultiplier}: ${fmt(holdoutBest)}`);
      console.log(`  ${holdoutBest.returnPct > holdoutBase.returnPct ? '✅ SUSTENTOU no holdout' : '❌ NÃO sustentou no holdout — descartar, era ajuste ao ruído do treino'}\n`);
    }
  }

  // ─── Hipótese 3: Rompimento Confirmado — remover a saída por ATR-falling ──
  {
    const base = PRESET_STRATEGIES.find(s => s.id === '4')!;
    const withoutAtrExit: Strategy = { ...base, exitBlocks: [] }; // só TP/SL/trailing decidem, nenhuma regra de saída antecipada
    console.log(`── ${base.name}: removendo a regra de saída "ATR em contração" ──`);
    const trainBase = netReturnPct(train, base, 'BTCUSDT', 'CRYPTO');
    const trainNoExit = netReturnPct(train, withoutAtrExit, 'BTCUSDT', 'CRYPTO');
    console.log(`  baseline (com exitBlock)     (treino)  ${fmt(trainBase)}`);
    console.log(`  sem exitBlock (só TP/SL)     (treino)  ${fmt(trainNoExit)}`);

    if (trainNoExit.returnPct <= trainBase.returnPct) {
      console.log(`  Remover a regra NÃO melhorou no treino — sem mudança a validar no holdout.\n`);
    } else {
      const holdoutBase = netReturnPct(holdout, base, 'BTCUSDT', 'CRYPTO');
      const holdoutNoExit = netReturnPct(holdout, withoutAtrExit, 'BTCUSDT', 'CRYPTO');
      console.log(`  HOLDOUT (nunca visto) — baseline (com exitBlock): ${fmt(holdoutBase)}`);
      console.log(`  HOLDOUT (nunca visto) — sem exitBlock (só TP/SL): ${fmt(holdoutNoExit)}`);
      console.log(`  ${holdoutNoExit.returnPct > holdoutBase.returnPct ? '✅ SUSTENTOU no holdout' : '❌ NÃO sustentou no holdout — descartar, era ajuste ao ruído do treino'}\n`);
    }
  }

  console.log('═══ Fim da investigação. ═══\n');
}

main().catch(err => {
  console.error('Erro na investigação:', err);
  process.exit(1);
});
