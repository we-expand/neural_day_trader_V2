/**
 * Validação determinística do Context Gate (Bloco B do cérebro cognitivo,
 * `research/AI_COGNITIVE_SPEC.md`) — regime (ADX/ATR) + estrutura (BOS/CHoCH),
 * NUNCA Market Score (decisão explícita, ver comentário no topo de ContextGate.ts).
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__context__.ts --bundle --platform=node --outfile=/tmp/validate-context.js && node /tmp/validate-context.js
 */
import { classifyRegime, evaluateContextGate } from './ContextGate';
import type { Candle } from '@/app/services/indicators/TechnicalIndicators';

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

function makeCandles(n: number, opts: { trend?: number; noise?: number; basePrice?: number; volSpikeAt?: number; volSpikeMultiplier?: number } = {}): Candle[] {
  const { trend = 0, noise = 0.5, basePrice = 100, volSpikeAt, volSpikeMultiplier = 1 } = opts;
  const out: Candle[] = [];
  let price = basePrice;
  // PRNG determinístico simples (LCG) — sem Math.random(), reprodutível.
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let i = 0; i < n; i++) {
    const spikeFactor = volSpikeAt !== undefined && i >= volSpikeAt ? volSpikeMultiplier : 1;
    const move = trend + (rand() - 0.5) * noise * spikeFactor;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + Math.abs(move) * 0.3 * spikeFactor;
    const low = Math.min(open, close) - Math.abs(move) * 0.3 * spikeFactor;
    out.push({ time: i * 60_000, open, high, low, close, volume: 1000 });
    price = close;
  }
  return out;
}

// ─── Dado insuficiente -> ILLIQUID_NO_DATA, nunca fabrica regime ───────────
{
  const candles = makeCandles(10);
  const r = classifyRegime(candles);
  assertTrue('poucos candles -> ILLIQUID_NO_DATA', r.classification === 'ILLIQUID_NO_DATA');
  const gate = evaluateContextGate(candles, 'LONG');
  assertTrue('poucos candles -> gate recusa por padrão (podeOperar=false)', gate.podeOperar === false);
}

// ─── Tendência de alta clara e persistente -> TRENDING + bias bullish ──────
{
  const candles = makeCandles(80, { trend: 1.2, noise: 0.3 });
  const r = classifyRegime(candles);
  assertTrue('tendência de alta persistente -> TRENDING', r.classification === 'TRENDING');
  assertTrue('tendência de alta -> ADX medido (não null)', r.adx !== null);
}

// ─── Mercado lateral (oscilação simétrica, sem deslocamento líquido) -> RANGING ─
{
  // Oscilação determinística em torno de um centro fixo (sem random walk, que
  // pode acumular tendência por acaso mesmo com drift=0) — o jeito mais
  // confiável de gerar "sem tendência" pro ADX de propósito.
  const candles: Candle[] = [];
  const center = 100;
  const amplitude = 2;
  for (let i = 0; i < 80; i++) {
    const angle = (i / 6) * Math.PI; // oscila rápido, várias voltas completas
    const price = center + Math.sin(angle) * amplitude;
    const prevPrice = i === 0 ? center : center + Math.sin(((i - 1) / 6) * Math.PI) * amplitude;
    const high = Math.max(price, prevPrice) + 0.1;
    const low = Math.min(price, prevPrice) - 0.1;
    candles.push({ time: i * 60_000, open: prevPrice, high, low, close: price, volume: 1000 });
  }
  const r = classifyRegime(candles);
  assertTrue('oscilação simétrica sem deslocamento líquido -> RANGING', r.classification === 'RANGING');
}

// ─── Expansão de volatilidade no final da série -> HIGH_VOLATILITY ─────────
{
  const candles = makeCandles(80, { trend: 0.1, noise: 0.3, volSpikeAt: 70, volSpikeMultiplier: 8 });
  const r = classifyRegime(candles);
  assertTrue('expansão forte de ATR recente -> HIGH_VOLATILITY', r.classification === 'HIGH_VOLATILITY');
  assertTrue('atrExpansionRatio medido e > 1', r.atrExpansionRatio !== null && r.atrExpansionRatio! > 1);
}

// ─── HIGH_VOLATILITY sempre recusa, independente do lado proposto ──────────
{
  const candles = makeCandles(80, { trend: 0.1, noise: 0.3, volSpikeAt: 70, volSpikeMultiplier: 8 });
  const gateLong = evaluateContextGate(candles, 'LONG');
  const gateShort = evaluateContextGate(candles, 'SHORT');
  assertTrue('HIGH_VOLATILITY recusa LONG', gateLong.podeOperar === false);
  assertTrue('HIGH_VOLATILITY recusa SHORT', gateShort.podeOperar === false);
}

// ─── Estrutura contrária ao lado proposto -> recusa (Brooks como veto, não gatilho) ─
{
  // Série em "ondas" (impulso-correção-impulso, cada impulso rompendo o topo
  // do anterior) — a única forma de gerar swing points REAIS e um rompimento
  // confirmado: uma rampa quase monotônica nunca forma topo local (definição
  // de swing exige reversão nos dois lados). Jitter pequeno e determinístico
  // quebra empates exatos de high/low entre candles adjacentes de segmentos
  // diferentes (sem ele, a comparação de igualdade do detector fractal — que
  // exige estritamente MAIOR, não maior-ou-igual — nunca confirma o swing).
  function wave(candles: Candle[], startPrice: number, endPrice: number, n: number, tRef: { t: number }, idxRef: { i: number }): number {
    const step = (endPrice - startPrice) / n;
    let price = startPrice;
    for (let k = 0; k < n; k++) {
      const jitter = ((idxRef.i * 37) % 11) * 0.007;
      const open = price;
      const close = price + step;
      const high = Math.max(open, close) + 0.15 + jitter;
      const low = Math.min(open, close) - 0.15 - jitter;
      candles.push({ time: tRef.t, open, high, low, close, volume: 1000 });
      tRef.t += 60_000; idxRef.i++;
      price = close;
    }
    return price;
  }
  const candles: Candle[] = [];
  const tRef = { t: 0 }; const idxRef = { i: 0 };
  let p = 100;
  p = wave(candles, p, 115, 15, tRef, idxRef); // impulso 1
  p = wave(candles, p, 108, 8, tRef, idxRef);  // correção
  p = wave(candles, p, 125, 15, tRef, idxRef); // impulso 2, rompe o topo do impulso 1
  p = wave(candles, p, 118, 8, tRef, idxRef);  // correção
  p = wave(candles, p, 135, 14, tRef, idxRef); // impulso 3, rompe o topo do impulso 2

  const r = classifyRegime(candles);
  assertTrue('série em ondas de alta, com rompimento confirmado -> estrutura bullish (BOS)', r.structureBias === 'bullish');

  const gateAgainstStructure = evaluateContextGate(candles, 'SHORT');
  assertTrue('estrutura bullish + proposta SHORT -> recusa (contradiz o viés)', gateAgainstStructure.podeOperar === false);
  const gateWithStructure = evaluateContextGate(candles, 'LONG');
  assertTrue('estrutura bullish + proposta LONG -> não recusa por motivo de estrutura', gateWithStructure.podeOperar === true);
}

// ─── Reasoning nunca vazio ──────────────────────────────────────────────────
{
  const candles = makeCandles(80, { trend: 0.5, noise: 0.4 });
  const r = classifyRegime(candles);
  assertTrue('reasoning sempre presente e não-vazio', r.reasoning.length > 0);
  const gate = evaluateContextGate(candles, 'LONG');
  assertTrue('motivo sempre presente e não-vazio', gate.motivo.length > 0);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
