/**
 * Validação determinística do Expectancy Engine (Bloco C do cérebro cognitivo,
 * `research/AI_COGNITIVE_SPEC.md`) — expectativa matemática, risco de ruína
 * (Monte Carlo seedado) e Kelly honesto.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__expectancy__.ts --bundle --platform=node --outfile=/tmp/validate-expectancy.js && node /tmp/validate-expectancy.js
 */
import { computeExpectancy, estimateRiskOfRuin, computeHonestKelly, MIN_SAMPLE_EXPECTANCY, type TradeOutcome, type ExpectancyResult } from './ExpectancyEngine';

let passed = 0;
let failed = 0;

function assertTrue(label: string, condition: boolean) {
  if (!condition) {
    console.error(`❌ FALHOU: ${label}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label}`);
    passed++;
  }
}

function assertClose(label: string, actual: number, expected: number, tol = 0.01) {
  assertTrue(`${label} (esperado ≈${expected}, obtido ${actual})`, Math.abs(actual - expected) <= tol);
}

// ─── computeExpectancy: casos com resultado conhecido de antemão ───────────
{
  // 10 trades, todos arriscando 1%: 5 vitórias de +2% (R=+2), 5 derrotas de -1% (R=-1).
  // winRate=50%, avgWinR=2, avgLossR=1, payoff=2, expectancyR = 0.5*2 - 0.5*1 = 0.5
  const trades: TradeOutcome[] = [
    ...Array(5).fill({ pnlPercent: 2, riskedPercent: 1 }),
    ...Array(5).fill({ pnlPercent: -1, riskedPercent: 1 }),
  ];
  const r = computeExpectancy(trades);
  assertTrue('n=10 amostra registrada corretamente', r.sampleSize === 10);
  assertClose('winRate = 50%', r.winRate, 50);
  assertClose('avgWinR = 2', r.avgWinR, 2);
  assertClose('avgLossR = 1', r.avgLossR, 1);
  assertClose('payoffRatio = 2', r.payoffRatio, 2);
  assertClose('expectancyR = 0.5 (sistema com edge positivo por construção)', r.expectancyR, 0.5);
  assertTrue('n=10 < MIN_SAMPLE -> conclusive=false (amostra pequena, não esconder)', r.conclusive === false);
}

{
  // Sistema com edge NEGATIVO por construção: 40% win, payoff 1:1 -> E[R] = 0.4*1 - 0.6*1 = -0.2
  const trades: TradeOutcome[] = [
    ...Array(40).fill({ pnlPercent: 1, riskedPercent: 1 }),
    ...Array(60).fill({ pnlPercent: -1, riskedPercent: 1 }),
  ];
  const r = computeExpectancy(trades);
  assertTrue('n=100 >= MIN_SAMPLE -> conclusive=true', r.conclusive === true && MIN_SAMPLE_EXPECTANCY <= 100);
  assertClose('expectancyR = -0.2 (edge negativo detectado corretamente)', r.expectancyR, -0.2);
  assertTrue('winRateCI95 é um intervalo válido (lower <= winRate <= upper)', r.winRateCI95.lower <= r.winRate && r.winRate <= r.winRateCI95.upper);
}

{
  // Amostra vazia -> zeros, nunca NaN/Infinity, conclusive=false
  const r = computeExpectancy([]);
  assertTrue('amostra vazia: sampleSize=0', r.sampleSize === 0);
  assertTrue('amostra vazia: expectancyR=0 (não NaN)', r.expectancyR === 0 && !Number.isNaN(r.expectancyR));
  assertTrue('amostra vazia: conclusive=false', r.conclusive === false);
}

{
  // Todos vencedores -> avgLossR=0, payoffRatio=Infinity (declarado, não fabricado)
  const trades: TradeOutcome[] = Array(35).fill({ pnlPercent: 3, riskedPercent: 1 });
  const r = computeExpectancy(trades);
  assertTrue('só vitórias: winRate=100%', r.winRate === 100);
  assertTrue('só vitórias: payoffRatio=Infinity (sem derrota pra dividir)', r.payoffRatio === Infinity);
}

{
  // riskedPercent <= 0 -> erro explícito, nunca fabrica R-multiple
  let threw = false;
  try { computeExpectancy([{ pnlPercent: 1, riskedPercent: 0 }]); } catch { threw = true; }
  assertTrue('riskedPercent=0 lança erro em vez de dividir por zero silenciosamente', threw);
}

// ─── estimateRiskOfRuin: casos extremos com resultado óbvio + determinismo ──
{
  // Edge fortemente negativo, sizing agressivo -> ruína quase certa
  const r = estimateRiskOfRuin({
    winRate: 20, payoffRatio: 1, riskPerTradePercent: 10, ruinThresholdPercent: 50,
    tradesPerPath: 200, simulations: 300, seed: 42,
  });
  assertTrue('edge muito negativo + sizing agressivo -> ruína provável (>70%)', r.ruinProbabilityPercent > 70);
}

{
  // Edge fortemente positivo, sizing pequeno -> ruína rara
  const r = estimateRiskOfRuin({
    winRate: 80, payoffRatio: 2, riskPerTradePercent: 1, ruinThresholdPercent: 50,
    tradesPerPath: 200, simulations: 300, seed: 42,
  });
  assertTrue('edge muito positivo + sizing conservador -> ruína rara (<10%)', r.ruinProbabilityPercent < 10);
}

{
  // Mesma seed -> mesmo resultado (determinismo, pré-requisito de ser testável)
  const params = { winRate: 50, payoffRatio: 1.5, riskPerTradePercent: 5, ruinThresholdPercent: 40, tradesPerPath: 100, simulations: 200, seed: 7 };
  const a = estimateRiskOfRuin(params);
  const b = estimateRiskOfRuin(params);
  assertTrue('mesma seed produz exatamente o mesmo resultado (determinístico)', a.ruinProbabilityPercent === b.ruinProbabilityPercent);
}

{
  // Validação de parâmetros
  let threw = false;
  try { estimateRiskOfRuin({ winRate: 150, payoffRatio: 1, riskPerTradePercent: 1, ruinThresholdPercent: 50, tradesPerPath: 10, simulations: 10, seed: 1 }); } catch { threw = true; }
  assertTrue('winRate fora de [0,100] lança erro', threw);
}

// ─── computeHonestKelly: casos com resultado conhecido ──────────────────────
{
  // Amostra pequena -> sempre 0, mesmo com edge aparente
  const smallSample: ExpectancyResult = {
    sampleSize: 10, winRate: 70, winRateCI95: { lower: 40, upper: 90 },
    avgWinR: 2, avgLossR: 1, payoffRatio: 2, expectancyR: 1.1, expectancyPercent: 1.1, conclusive: false,
  };
  const k = computeHonestKelly(smallSample);
  assertTrue('amostra pequena -> Kelly aplicado = 0, mesmo com edge aparente forte', k.kellyFractionApplied === 0 && k.reliable === false);
}

{
  // Edge negativo -> Kelly bruto negativo, aplicado sempre 0 (nunca posição negativa)
  const negativeEdge: ExpectancyResult = {
    sampleSize: 100, winRate: 30, winRateCI95: { lower: 22, upper: 39 },
    avgWinR: 1, avgLossR: 1, payoffRatio: 1, expectancyR: -0.4, expectancyPercent: -0.4, conclusive: true,
  };
  const k = computeHonestKelly(negativeEdge);
  assertTrue('edge negativo -> kellyFractionRaw < 0', k.kellyFractionRaw < 0);
  assertTrue('edge negativo -> kellyFractionApplied = 0 (nunca posição negativa)', k.kellyFractionApplied === 0);
}

{
  // Edge positivo no ponto estimado, mas IC 95% inferior já negativo -> conservador vence
  // winRate ponto=55% parece positivo com payoff 1:1, mas lower=48% já é edge negativo.
  const shakyEdge: ExpectancyResult = {
    sampleSize: 40, winRate: 55, winRateCI95: { lower: 48, upper: 62 },
    avgWinR: 1, avgLossR: 1, payoffRatio: 1, expectancyR: 0.1, expectancyPercent: 0.1, conclusive: true,
  };
  const k = computeHonestKelly(shakyEdge);
  assertTrue('IC 95% inferior já implica edge<=0 -> aplicado=0, mesmo com ponto estimado positivo', k.kellyFractionApplied === 0 && k.reliable === false);
}

{
  // Edge sólido e robusto ao IC inferior -> Kelly fracionário positivo, dentro do teto
  const robustEdge: ExpectancyResult = {
    sampleSize: 200, winRate: 65, winRateCI95: { lower: 58, upper: 71 },
    avgWinR: 2, avgLossR: 1, payoffRatio: 2, expectancyR: 0.6, expectancyPercent: 0.6, conclusive: true,
  };
  const k = computeHonestKelly(robustEdge, { kellyMultiplier: 0.25, maxPositionPercent: 10 });
  assertTrue('edge robusto -> kellyFractionRaw > 0', k.kellyFractionRaw > 0);
  assertTrue('edge robusto -> reliable=true', k.reliable === true);
  assertTrue('recommendedPositionPercent respeita o teto de 10%', k.recommendedPositionPercent <= 10);
  assertTrue('recommendedPositionPercent > 0 (recomenda operar)', k.recommendedPositionPercent > 0);
}

{
  // payoffRatio inválido (Infinity, sem derrotas na amostra) -> Kelly não calculável, tratado como 0
  const allWins: ExpectancyResult = {
    sampleSize: 35, winRate: 100, winRateCI95: { lower: 90, upper: 100 },
    avgWinR: 3, avgLossR: 0, payoffRatio: Infinity, expectancyR: 3, expectancyPercent: 3, conclusive: true,
  };
  const k = computeHonestKelly(allWins);
  assertTrue('payoffRatio=Infinity -> Kelly não calculável, aplicado=0 (nunca divide por zero silenciosamente)', k.kellyFractionApplied === 0 && k.reliable === false);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
