/**
 * Baseline do Market Score — walk-forward sobre candle real, sem look-ahead.
 *
 * Ver `hypothesis.md` (escrito ANTES desta execução) para desenho, amostra,
 * limitações declaradas e os 4 critérios de sucesso pré-registrados.
 *
 * Reuso deliberado: NÃO recria a lógica de validação. Chama o
 * `MarketScoreValidator.validateScore()` que já existe (CRITERIA.md: "já
 * existe, não recriar"). Este runner só orquestra a grade ativo×timeframe,
 * aplica a correção estatística que o validador não faz, e salva o resultado
 * em arquivo — que é exatamente o que nunca tinha sido feito.
 *
 * Rodar:
 *   npx esbuild research/experiments/2026-07-31-marketscore-baseline/run.ts \
 *     --bundle --platform=node --format=esm --outfile=/tmp/ms-baseline.mjs && \
 *   node /tmp/ms-baseline.mjs
 */
import { writeFileSync } from 'node:fs';
import { validateScore, type ValidationResult } from '../../../src/app/services/MarketScoreValidator';
import type { Timeframe } from '../../../src/app/services/BacktestDataService';
import { estimateCostPercent } from '../../CostModel';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];
const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h'];
const FORWARD_BARS = 8;

/** Bonferroni sobre a grade inteira (21 combinações), pré-registrado. */
const N_TESTS = SYMBOLS.length * TIMEFRAMES.length;
const ALPHA = 0.05 / N_TESTS;

/** Amostra mínima para reportar como conclusivo (critério 4). */
const MIN_CONVICTION_SAMPLES = 30;

/**
 * p-valor binomial unilateral: P(X >= hits | n, p=0.5).
 * Soma exata da cauda — n aqui é pequeno o bastante (centenas), sem
 * necessidade de aproximação normal.
 */
function binomialTailP(hits: number, n: number): number {
  if (n === 0) return 1;
  // log-fatorial para evitar overflow em n grande
  const logFact: number[] = [0];
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  let p = 0;
  for (let k = hits; k <= n; k++) {
    const logC = logFact[n] - logFact[k] - logFact[n - k];
    p += Math.exp(logC + n * Math.log(0.5));
  }
  return Math.min(1, p);
}

interface ComboResult {
  symbol: string;
  timeframe: Timeframe;
  totalSamples: number;
  correlation: number;
  monotonic: boolean;
  convictionBuy: { samples: number; hitRate: number; avgForwardReturnPct: number };
  convictionSell: { samples: number; hitRate: number; avgForwardReturnPct: number };
  convictionPooled: { samples: number; hits: number; hitRate: number; pValue: number; passesBonferroni: boolean };
  roundTripCostPercent: number | null;
  /** retorno médio absoluto das leituras de convicção, líquido de custo */
  netEdgePercent: number | null;
  conclusive: boolean;
  validatorVerdict: string;
  error?: string;
}

async function main() {
  const results: ComboResult[] = [];
  const startedAt = new Date().toISOString();

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      process.stdout.write(`▸ ${symbol} ${timeframe} ... `);
      try {
        const r: ValidationResult = await validateScore(symbol, timeframe, { forwardBars: FORWARD_BARS });

        const buy = r.conviction.find(c => c.label.startsWith('COMPRA'))!;
        const sell = r.conviction.find(c => c.label.startsWith('VENDA'))!;

        const nBuy = buy.samples;
        const nSell = sell.samples;
        const hitsBuy = Math.round((buy.directionalHitRate / 100) * nBuy);
        const hitsSell = Math.round((sell.directionalHitRate / 100) * nSell);
        const nPooled = nBuy + nSell;
        const hitsPooled = hitsBuy + hitsSell;
        const hitRatePooled = nPooled ? (hitsPooled / nPooled) * 100 : 0;
        const pValue = binomialTailP(hitsPooled, nPooled);

        // Custo round-trip: cripto usa % direto do preço (correção da seção
        // 11.13). pointValue=1 é irrelevante nesse ramo da fórmula.
        //
        // ⚠️ ARMADILHA DE UNIDADE (errei nela na 1ª execução, 2026-07-31):
        // apesar do nome, `estimateCostPercent` devolve FRAÇÃO, não pontos
        // percentuais — é o `toNetReturn` logo abaixo dela no CostModel.ts que
        // multiplica por 100. Sem o ×100 aqui, o custo round-trip sai 0,0026%
        // em vez de 0,26% (fator 100), e todo netEdge fica otimista demais.
        // 0,26% é exatamente o custo da tabela 14.3 do AI_BRAIN_SPEC.md.
        let roundTripCostPercent: number | null = null;
        try {
          roundTripCostPercent = estimateCostPercent('CRYPTO', 1, 1) * 2 * 100;
        } catch {
          roundTripCostPercent = null;
        }

        // Retorno médio absoluto das leituras de convicção (ponderado por n),
        // com sinal já orientado: compra espera +, venda espera −.
        const grossEdge = nPooled
          ? (buy.avgForwardReturnPct * nBuy + -sell.avgForwardReturnPct * nSell) / nPooled
          : 0;
        const netEdgePercent = roundTripCostPercent === null ? null : Number((grossEdge - roundTripCostPercent).toFixed(4));

        results.push({
          symbol,
          timeframe,
          totalSamples: r.totalSamples,
          correlation: r.correlation,
          monotonic: r.monotonic,
          convictionBuy: { samples: nBuy, hitRate: buy.directionalHitRate, avgForwardReturnPct: buy.avgForwardReturnPct },
          convictionSell: { samples: nSell, hitRate: sell.directionalHitRate, avgForwardReturnPct: sell.avgForwardReturnPct },
          convictionPooled: {
            samples: nPooled,
            hits: hitsPooled,
            hitRate: Number(hitRatePooled.toFixed(1)),
            pValue: Number(pValue.toFixed(6)),
            passesBonferroni: pValue < ALPHA,
          },
          roundTripCostPercent,
          netEdgePercent,
          conclusive: nPooled >= MIN_CONVICTION_SAMPLES,
          validatorVerdict: r.verdict,
        });
        console.log(`n=${r.totalSamples} convicção=${nPooled} hit=${hitRatePooled.toFixed(1)}% p=${pValue.toFixed(4)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`ERRO: ${msg}`);
        results.push({
          symbol, timeframe, totalSamples: 0, correlation: 0, monotonic: false,
          convictionBuy: { samples: 0, hitRate: 0, avgForwardReturnPct: 0 },
          convictionSell: { samples: 0, hitRate: 0, avgForwardReturnPct: 0 },
          convictionPooled: { samples: 0, hits: 0, hitRate: 0, pValue: 1, passesBonferroni: false },
          roundTripCostPercent: null, netEdgePercent: null, conclusive: false,
          validatorVerdict: 'erro', error: msg,
        });
      }
      // Espaçar chamadas: Binance pública tem rate-limit por peso.
      await new Promise(res => setTimeout(res, 400));
    }
  }

  // ==== Agregação pooled (com a ressalva de correlação da hypothesis.md) ====
  const ok = results.filter(r => !r.error && r.conclusive);
  const pooledN = ok.reduce((a, r) => a + r.convictionPooled.samples, 0);
  const pooledHits = ok.reduce((a, r) => a + r.convictionPooled.hits, 0);
  const pooledHitRate = pooledN ? (pooledHits / pooledN) * 100 : 0;
  const pooledP = binomialTailP(pooledHits, pooledN);

  const byTimeframe = TIMEFRAMES.map(tf => {
    const subset = ok.filter(r => r.timeframe === tf);
    const n = subset.reduce((a, r) => a + r.convictionPooled.samples, 0);
    const h = subset.reduce((a, r) => a + r.convictionPooled.hits, 0);
    return {
      timeframe: tf,
      combos: subset.length,
      convictionSamples: n,
      hitRate: n ? Number(((h / n) * 100).toFixed(1)) : 0,
      pValue: n ? Number(binomialTailP(h, n).toFixed(6)) : 1,
    };
  });

  const summary = {
    experiment: '2026-07-31-marketscore-baseline',
    startedAt,
    finishedAt: new Date().toISOString(),
    config: { symbols: SYMBOLS, timeframes: TIMEFRAMES, forwardBars: FORWARD_BARS, nTests: N_TESTS, alphaBonferroni: ALPHA, minConvictionSamples: MIN_CONVICTION_SAMPLES },
    criteria: {
      c1_significance: `hit rate > 50% com p < ${ALPHA.toFixed(5)} (Bonferroni, 21 testes)`,
      c2_consistency: 'efeito presente em compra E venda',
      c3_economic: 'retorno médio de convicção > custo round-trip',
      c4_sample: `>= ${MIN_CONVICTION_SAMPLES} leituras de convicção`,
    },
    combosPassingBonferroni: results.filter(r => r.convictionPooled.passesBonferroni && r.conclusive).map(r => `${r.symbol} ${r.timeframe}`),
    pooled: {
      caveat: 'Cesta com correlação 0,7-0,9 entre pares (AI_BRAIN_SPEC 14.4): ~1,5 apostas independentes, NAO 7. n pooled infla a mesma aposta.',
      conclusiveCombos: ok.length,
      convictionSamples: pooledN,
      hits: pooledHits,
      hitRate: Number(pooledHitRate.toFixed(2)),
      pValue: Number(pooledP.toFixed(6)),
    },
    byTimeframe,
    results,
  };

  // Caminho fixo no repo: `import.meta.url` apontaria pro bundle temporário do
  // esbuild, não pra pasta do experimento.
  const outPath = 'research/experiments/2026-07-31-marketscore-baseline/results.json';
  writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('\n═══ RESUMO ═══');
  console.log(`Combinações conclusivas: ${ok.length}/${N_TESTS}`);
  console.log(`Convicção pooled: n=${pooledN}, hit=${pooledHitRate.toFixed(2)}%, p=${pooledP.toExponential(3)}`);
  console.log(`Passam Bonferroni (α=${ALPHA.toFixed(5)}): ${summary.combosPassingBonferroni.length ? summary.combosPassingBonferroni.join(', ') : 'NENHUMA'}`);
  console.log('\nPor timeframe:');
  for (const t of byTimeframe) console.log(`  ${t.timeframe}: n=${t.convictionSamples} hit=${t.hitRate}% p=${t.pValue}`);
  console.log(`\nSalvo em: ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
