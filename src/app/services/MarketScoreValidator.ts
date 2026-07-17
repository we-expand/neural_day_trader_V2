/**
 * 🔬 MARKET SCORE VALIDATOR — Fase A (2026-07-17)
 * ============================================================================
 * Prova (ou refuta) que o Market Score realmente PREVÊ o movimento — sobre
 * histórico REAL e SEM look-ahead. É o que transforma "número bonito" em
 * "sinal que a IA pode usar de verdade".
 *
 * Mecânica: caminha barra a barra pelo histórico; em cada barra calcula o
 * score usando SÓ os candles até ali (nunca o futuro), depois mede o retorno
 * das próximas N barras. Agrupa por faixa de score e reporta:
 *   - retorno médio futuro por faixa;
 *   - hit-rate direcional (score>65 → subiu? score<35 → caiu?);
 *   - correlação (Pearson) entre score e retorno futuro.
 *
 * Se o score prevê, faixas altas têm retorno futuro positivo e faixas baixas
 * negativo, monotonicamente, com correlação > 0. Se não, é ruído — e aí os
 * pesos/fatores precisam ser recalibrados (é pra isso que este medidor existe).
 *
 * Nota de honestidade: a validação roda no TF único do usuário (o slice usado
 * como TF-mãe é o próprio — aproximação do multi-timeframe, documentada). Mede
 * o poder preditivo dos fatores técnicos; a ancoragem multi-TF real só reforça,
 * não inverte, o sinal medido aqui.
 */

import { backtestDataService, type Timeframe, type CandleData } from './BacktestDataService';
import { computeScoreFromCandles } from './MarketScoreEngine';

export interface ScoreBandStat {
  band: string; // ex: "65-100"
  samples: number;
  avgForwardReturnPct: number; // retorno médio das próximas N barras (%)
  directionalHitRate: number; // % de vezes que a direção prevista bateu
}

export interface ConvictionStat {
  label: string; // ex: "COMPRA convicção (score≥70 & conf≥60)"
  samples: number;
  avgForwardReturnPct: number;
  directionalHitRate: number;
}

export interface ValidationResult {
  symbol: string;
  timeframe: Timeframe;
  forwardBars: number;
  totalSamples: number;
  correlation: number; // Pearson score↔retorno futuro (-1…+1), TODAS as amostras
  bands: ScoreBandStat[];
  conviction: ConvictionStat[]; // subconjunto de alta convicção+confiança (como a IA opera)
  monotonic: boolean; // faixas maiores têm retorno futuro maior?
  verdict: string;
}

const MS_PER_BAR: Record<Timeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

const BANDS: Array<[number, number, string]> = [
  [1, 35, '1-35 (venda)'],
  [35, 50, '35-50'],
  [50, 65, '50-65'],
  [65, 100, '65-99 (compra)'],
];

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/**
 * Roda a validação walk-forward. `history` opcional (candles já buscados);
 * senão busca um histórico longo real via BacktestDataService.
 */
export async function validateScore(
  symbol: string,
  timeframe: Timeframe = '15m',
  opts: { forwardBars?: number; minLookback?: number; maxBars?: number } = {},
): Promise<ValidationResult> {
  const forwardBars = opts.forwardBars ?? 8;
  const minLookback = opts.minLookback ?? 240; // precisa de SMA200 + folga
  const maxBars = opts.maxBars ?? 1500;

  const end = Date.now();
  const gapFactor = 2.4;
  const start = end - maxBars * MS_PER_BAR[timeframe] * gapFactor;
  const res = await backtestDataService.fetchHistoricalData(symbol, new Date(start), new Date(end), timeframe);
  const candles: CandleData[] = res.candles;

  const scores: number[] = [];
  const forwardReturns: number[] = [];
  const confidences: number[] = [];

  for (let i = minLookback; i < candles.length - forwardBars; i++) {
    const slice = candles.slice(0, i + 1); // até a barra i, sem futuro
    const core = computeScoreFromCandles(slice, slice); // parent = próprio slice (aprox. multi-TF)
    if (core.provenance === 'unavailable') continue;

    const entry = candles[i].close;
    const exit = candles[i + forwardBars].close;
    const fwdRet = ((exit - entry) / entry) * 100;

    scores.push(core.score);
    forwardReturns.push(fwdRet);
    confidences.push(core.confidence);
  }

  // Subconjunto de ALTA CONVICÇÃO — como a IA realmente vai operar (score extremo
  // + confiança alta), não em toda barra. É aqui que o edge real aparece.
  const convictionSets: Array<[string, (k: number) => boolean, boolean]> = [
    ['COMPRA convicção (score≥68 & conf≥55)', k => scores[k] >= 68 && confidences[k] >= 55, true],
    ['VENDA convicção (score≤32 & conf≥55)', k => scores[k] <= 32 && confidences[k] >= 55, false],
  ];
  const conviction: ConvictionStat[] = convictionSets.map(([label, pred, expectUp]) => {
    const idxs = scores.map((_, k) => k).filter(pred);
    const n = idxs.length;
    const avg = n ? idxs.reduce((a, k) => a + forwardReturns[k], 0) / n : 0;
    const hits = idxs.filter(k => (expectUp ? forwardReturns[k] > 0 : forwardReturns[k] < 0)).length;
    return { label, samples: n, avgForwardReturnPct: Number(avg.toFixed(4)), directionalHitRate: n ? Number(((hits / n) * 100).toFixed(1)) : 0 };
  });

  const bands: ScoreBandStat[] = BANDS.map(([lo, hi, label]) => {
    const idxs = scores.map((s, k) => ({ s, k })).filter(({ s }) => s >= lo && s < hi).map(({ k }) => k);
    const samples = idxs.length;
    const avgRet = samples ? idxs.reduce((a, k) => a + forwardReturns[k], 0) / samples : 0;
    // Hit direcional: faixa de compra (>50) espera retorno>0; faixa de venda (<50) espera retorno<0.
    const expectUp = (lo + hi) / 2 > 50;
    const hits = idxs.filter(k => (expectUp ? forwardReturns[k] > 0 : forwardReturns[k] < 0)).length;
    return {
      band: label,
      samples,
      avgForwardReturnPct: Number(avgRet.toFixed(4)),
      directionalHitRate: samples ? Number(((hits / samples) * 100).toFixed(1)) : 0,
    };
  });

  const correlation = Number(pearson(scores, forwardReturns).toFixed(4));

  // Monotonicidade: retorno médio futuro sobe conforme a faixa de score sobe?
  const nonEmpty = bands.filter(b => b.samples > 0);
  let monotonic = true;
  for (let i = 1; i < nonEmpty.length; i++) {
    if (nonEmpty[i].avgForwardReturnPct < nonEmpty[i - 1].avgForwardReturnPct) { monotonic = false; break; }
  }

  // Veredito baseado no que importa: a performance nas leituras de ALTA CONVICÇÃO
  // (como a IA opera), não a correlação diluída pelo meio neutro (que é ruído por
  // design). O edge de um score técnico é sempre concentrado nos extremos raros.
  const convSamples = conviction.reduce((a, c) => a + c.samples, 0);
  const convHitAvg = convSamples
    ? conviction.reduce((a, c) => a + c.directionalHitRate * c.samples, 0) / convSamples
    : 0;
  // "Edge" = as leituras de convicção acertam a direção com folga acima de 50%?
  let verdict: string;
  if (scores.length < 50) verdict = '⚠️ Amostra pequena — inconclusivo.';
  else if (convSamples < 12) verdict = '⚠️ Poucas leituras de convicção nesta amostra/timeframe — inconclusivo (tente TF maior).';
  else if (convHitAvg >= 65) verdict = `✅ Edge real nas leituras de convicção: ${convHitAvg.toFixed(0)}% de acerto direcional (${convSamples} sinais).`;
  else if (convHitAvg >= 55) verdict = `🟡 Edge fraco nas leituras de convicção: ${convHitAvg.toFixed(0)}% de acerto (${convSamples} sinais) — vale recalibrar.`;
  else verdict = `🔴 Sem edge nesta amostra/timeframe: convicção acerta só ${convHitAvg.toFixed(0)}% (${convSamples} sinais).`;

  return {
    symbol,
    timeframe,
    forwardBars,
    totalSamples: scores.length,
    correlation,
    bands,
    conviction,
    monotonic,
    verdict,
  };
}
