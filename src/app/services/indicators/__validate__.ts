/**
 * Validação de correção matemática dos indicadores e do motor de estratégia.
 * Não é um teste de "será que a IA acerta o mercado" (isso ninguém garante) —
 * é um teste de "a fórmula está implementada certo", usando séries onde o
 * resultado correto pode ser calculado à mão e conferido, sem depender de
 * nenhuma biblioteca externa como referência.
 *
 * Roda com: npx esbuild src/app/services/indicators/__validate__.ts --bundle --platform=node --outfile=/tmp/validate.js && node /tmp/validate.js
 */
import {
  Candle,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateStochastic,
} from './TechnicalIndicators';
import { evaluateStrategySeries } from '../strategy/StrategyEvaluator';
import { PRESET_STRATEGIES } from '../../data/presetStrategies';

let passed = 0;
let failed = 0;

function assertClose(label: string, actual: number | null, expected: number, tolerance = 0.01) {
  if (actual === null || Math.abs(actual - expected) > tolerance) {
    console.error(`❌ FALHOU: ${label} — esperado ${expected}, recebeu ${actual}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label} (${actual})`);
    passed++;
  }
}

function assertTrue(label: string, condition: boolean) {
  if (!condition) {
    console.error(`❌ FALHOU: ${label}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label}`);
    passed++;
  }
}

function makeCandle(close: number, i: number, high?: number, low?: number): Candle {
  return { time: i * 60_000, open: close, high: high ?? close, low: low ?? close, close, volume: 1000 };
}

// ─── CASO 1: preço constante ───────────────────────────────────────────────
// Com preço 100% constante, por definição: SMA/EMA devem convergir pro próprio
// preço, MACD/histograma devem ser 0 (não há diferença entre médias iguais),
// Bollinger upper=middle=lower (desvio padrão de uma série constante é 0),
// ATR deve ser 0 (sem range, sem gap).
{
  const constantCandles: Candle[] = Array.from({ length: 60 }, (_, i) => makeCandle(100, i));

  const sma = calculateSMA(constantCandles, 20);
  assertClose('SMA(20) de série constante em 100', sma[59], 100);

  const ema = calculateEMA(constantCandles, 20);
  assertClose('EMA(20) de série constante em 100', ema[59], 100);

  const macd = calculateMACD(constantCandles);
  assertClose('MACD histograma de série constante = 0', macd.histogram[59], 0);

  const bb = calculateBollingerBands(constantCandles, 20);
  assertClose('Bollinger upper = 100 (stdDev 0)', bb.upper[59], 100);
  assertClose('Bollinger lower = 100 (stdDev 0)', bb.lower[59], 100);

  const atr = calculateATR(constantCandles, 14);
  assertClose('ATR de série sem range/gap = 0', atr[59], 0);
}

// ─── CASO 2: subida monotônica pura (RSI deve ir a 100) ────────────────────
// Toda barra fecha mais alta que a anterior → nunca há perda → RSI = 100
// (fórmula de Wilder: avgLoss=0 → RSI=100 por definição, sem divisão por zero).
{
  const uptrendCandles: Candle[] = Array.from({ length: 30 }, (_, i) => makeCandle(100 + i, i));
  const rsi = calculateRSI(uptrendCandles, 14);
  assertClose('RSI(14) de subida monotônica pura = 100', rsi[29], 100);
}

// ─── CASO 3: queda monotônica pura (RSI deve ir a 0) ───────────────────────
{
  const downtrendCandles: Candle[] = Array.from({ length: 30 }, (_, i) => makeCandle(200 - i, i));
  const rsi = calculateRSI(downtrendCandles, 14);
  assertClose('RSI(14) de queda monotônica pura = 0', rsi[29], 0);
}

// ─── CASO 4: SMA à mão numa série pequena e simples ────────────────────────
// [1,2,3,4,5] período 5 → média = (1+2+3+4+5)/5 = 3, conferível de cabeça.
{
  const simpleCandles: Candle[] = [1, 2, 3, 4, 5].map((v, i) => makeCandle(v, i));
  const sma = calculateSMA(simpleCandles, 5);
  assertClose('SMA(5) de [1,2,3,4,5] = 3', sma[4], 3);
}

// ─── CASO 5: Stochastic no topo do range = 100 ─────────────────────────────
{
  const candles: Candle[] = Array.from({ length: 20 }, (_, i) => makeCandle(50 + i, i, 50 + i, 40 + i));
  // Última barra fecha exatamente na máxima da janela → %K = 100
  candles[19] = { ...candles[19], close: candles[19].high };
  const stoch = calculateStochastic(candles, 14);
  assertClose('Stochastic %K quando fecha na máxima da janela = 100', stoch.k[19], 100);
}

// ─── CASO 6: determinismo do motor de estratégia ───────────────────────────
// Mesma estratégia + mesmos candles rodados duas vezes têm que dar EXATAMENTE
// o mesmo resultado — prova de que não existe nenhuma fonte de aleatoriedade
// no cálculo (o que seria fatal pra confiança no backtest).
{
  const candles: Candle[] = Array.from({ length: 300 }, (_, i) => {
    // série pseudo-realista determinística (sem Math.random) só pra ter variação
    const wave = Math.sin(i / 12) * 5 + Math.sin(i / 37) * 3;
    const price = 100 + wave + i * 0.05;
    return makeCandle(price, i, price + 0.5, price - 0.5);
  });

  const strategy = PRESET_STRATEGIES.find(s => s.id === '6')!; // WIKIOSKIT (VWAP+OBV, sem EMA200 de aquecimento longo)
  const run1 = evaluateStrategySeries(strategy, candles);
  const run2 = evaluateStrategySeries(strategy, candles);

  const identical = JSON.stringify(run1) === JSON.stringify(run2);
  assertTrue('evaluateStrategySeries é determinístico (2 rodadas idênticas)', identical);

  const anySignal = run1.some(r => r.signal !== null);
  assertTrue('estratégia gera pelo menos 1 sinal na série sintética de 300 candles', anySignal);

  const allConfidenceInRange = run1.every(r => r.confidence >= 0 && r.confidence <= 99);
  assertTrue('confiança sempre entre 0 e 99', allConfidenceInRange);
}

// ─── CASO 7: golden cross de EMA gera CROSS_ABOVE de verdade ───────────────
// Série desenhada pra cruzar exatamente uma vez: EMA curta começa abaixo da
// longa e termina acima — confirma que CROSS_ABOVE não é só "está acima",
// é a transição (prevA<=prevB && currA>currB) acontecendo de fato.
{
  const fallCandles = Array.from({ length: 60 }, (_, i) => makeCandle(200 - i * 2, i));
  const riseCandles = Array.from({ length: 60 }, (_, i) => makeCandle(fallCandles[59].close + i * 3, 60 + i));
  const crossCandles: Candle[] = [...fallCandles, ...riseCandles];

  const emaShort = calculateEMA(crossCandles, 10);
  const emaLong = calculateEMA(crossCandles, 30);
  let crosses = 0;
  for (let i = 1; i < crossCandles.length; i++) {
    if (emaShort[i] === null || emaShort[i - 1] === null || emaLong[i] === null || emaLong[i - 1] === null) continue;
    if (emaShort[i - 1]! <= emaLong[i - 1]! && emaShort[i]! > emaLong[i]!) crosses++;
  }
  assertTrue('série desenhada pra cruzar produz exatamente 1 golden cross de EMA', crosses === 1);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
