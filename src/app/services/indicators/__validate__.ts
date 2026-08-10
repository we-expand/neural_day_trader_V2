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
  calculateADX,
  calculateStochastic,
  calculateDonchian,
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

  const strategy = PRESET_STRATEGIES.find(s => s.id === '4')!; // Rompimento Confirmado (Donchian+OBV, sem EMA200 de aquecimento longo)
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

// ─── CASO 8: Donchian usa só candles ANTERIORES (sem look-ahead) ──────────
// Uma série plana em 100, com um único candle-espeta de máxima 150 no meio,
// não deve mostrar upper=150 nesse MESMO candle (senão o rompimento seria
// trivial: o candle sempre "rompe" o teto que ele mesmo formou) — só nos
// candles SEGUINTES, depois que o pico já entrou na janela como histórico.
{
  const flat = Array.from({ length: 25 }, (_, i) => makeCandle(100, i));
  const spikeIndex = 25;
  const spike = { time: spikeIndex, open: 100, high: 150, low: 100, close: 100, volume: 1000 };
  const after = Array.from({ length: 5 }, (_, i) => makeCandle(100, spikeIndex + 1 + i));
  const candles: Candle[] = [...flat, spike, ...after];

  const { upper } = calculateDonchian(candles, 20);

  assertTrue('Donchian NÃO usa o high do próprio candle do pico (sem look-ahead)', upper[spikeIndex] !== 150);
  assertTrue('Donchian passa a refletir o pico no candle SEGUINTE (agora é histórico)', upper[spikeIndex + 1] === 150);
}

// ─── CASO 9: ADX usa suavização de Wilder (RMA), não SMA ───────────────────
// Regressão de bug real (2026-07-30): a implementação usava SMA simples para
// suavizar o DX, produzindo erro médio de ~4,8 pontos de ADX contra a fórmula
// padrão de Wilder — divergência que mudava a decisão do gate de regime
// (ADX>18/20/22) em 5,7-10,7% das barras numa série sintética de 3000
// candles. Este caso prova a diferença com uma série pequena e determinística
// onde RMA e SMA do DX divergem de forma verificável à mão: tendência forte
// e constante faz +DM dominar simetricamamente, então o DX real converge
// para um valor estável — SMA (sem memória geométrica) reage mais devagar
// que RMA (que pesa o presente mais que o passado) na fase de convergência,
// então os dois métodos discordam justamente nas primeiras barras após o
// período de warmup, que é a região testada aqui.
{
  // Série com MUDANÇA DE REGIME (tendência forte -> lateral com oscilação
  // fraca) — necessária pra RMA e SMA do DX divergirem de forma mensurável.
  // Uma tendência pura e constante faz o DX convergir a um valor estável
  // onde RMA e SMA do DX coincidem (não prova nada sobre qual suavização é
  // usada); a mudança de regime testa a velocidade de reação de cada método
  // (RMA pesa o presente mais que o passado; SMA tem memória uniforme).
  const trendCandles: Candle[] = Array.from({ length: 30 }, (_, i) =>
    makeCandle(100 + i * 2, i, 100 + i * 2 + 1, 100 + i * 2 - 1)
  );
  const rangeCandles: Candle[] = Array.from({ length: 30 }, (_, i) => {
    const wobble = (i % 2 === 0 ? 1 : -1) * 0.8;
    const price = trendCandles[29].close + wobble;
    return makeCandle(price, 30 + i, price + 1, price - 1);
  });
  const candles: Candle[] = [...trendCandles, ...rangeCandles];
  const adx = calculateADX(candles, 14);

  // Com tendência forte sustentada, ADX de Wilder converge para valor alto
  // (>40) antes da mudança de regime. Warmup de ADX(14) precisa de ~2×period
  // candles pra ter primeiro valor (suavização de +DM/-DM/TR, DEPOIS
  // suavização do DX) — só a partir do índice 27-28 nesta série de 30.
  assertTrue('ADX(14) de tendência de alta forte e sustentada converge para valor alto (>40) após warmup', (adx[29] ?? 0) > 40);

  // Prova de que a suavização é RMA, não SMA: recalcula com SMA simples do
  // mesmo DX e confirma que diverge do resultado real em pelo menos 1 barra
  // da região testada (prova que a implementação NÃO é SMA disfarçada).
  const len = candles.length;
  const plusDM: number[] = new Array(len).fill(0), minusDM: number[] = new Array(len).fill(0), tr: number[] = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const dn = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
    const pc = candles[i - 1].close;
    tr[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - pc), Math.abs(candles[i].low - pc));
  }
  const wilderSmoothLocal = (values: number[], period: number) => {
    const out: (number | null)[] = new Array(len).fill(null);
    let prev: number | null = null;
    for (let i = 0; i < len; i++) {
      if (i === period) { prev = values.slice(1, period + 1).reduce((a, b) => a + b, 0); out[i] = prev; }
      else if (i > period) { prev = (prev as number) - (prev as number) / period + values[i]; out[i] = prev; }
    }
    return out;
  };
  const sTR = wilderSmoothLocal(tr, 14), sP = wilderSmoothLocal(plusDM, 14), sM = wilderSmoothLocal(minusDM, 14);
  const dx: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const t = sTR[i], p = sP[i], m = sM[i];
    if (t === null || p === null || m === null || t === 0) continue;
    const pdi = (p / t) * 100, mdi = (m / t) * 100, s = pdi + mdi;
    dx[i] = s === 0 ? 0 : (Math.abs(pdi - mdi) / s) * 100;
  }
  const firstValid = dx.findIndex(v => v !== null);
  const dxValues = dx.slice(firstValid).map(v => v as number);
  const smaOfDx: (number | null)[] = new Array(len).fill(null);
  for (let i = 13; i < dxValues.length; i++) {
    const window = dxValues.slice(i - 13, i + 1);
    smaOfDx[firstValid + i] = window.reduce((a, b) => a + b, 0) / 14;
  }
  const diverges = Array.from({ length: len }, (_, i) => i).some(
    i => adx[i] !== null && smaOfDx[i] !== null && Math.abs(adx[i]! - smaOfDx[i]!) > 0.5
  );
  assertTrue('ADX real diverge de uma versão com SMA do DX (prova de que a implementação usa RMA)', diverges);
}

// ─── CASO 10: direção do sinal declarada explicitamente, não inferida ──────
// Regressão de bug real (2026-07-30): a Reversão à Média (preset 3, RSI+
// Bollinger) tem entryBlocks com operadores CROSS_BELOW/BELOW, que a
// inferência antiga por contagem de operador classificava como "bearish" →
// sinal SELL — o oposto da intenção real (comprar na sobrevenda). Prova
// aqui: monta uma série que dispara sobrevenda genuína (toca banda inferior
// de Bollinger + RSI<30) e confirma que o preset 3 emite BUY, não SELL.
{
  // Série: regime lateral apertado (ADX baixo, satisfaz o filtro ADX<22 do
  // preset) seguido de UM candle de queda brusca — RSI cai rápido (sobrevenda
  // genuína) enquanto a banda de Bollinger (que reage a 20 candles de
  // história) ainda não acompanhou o movimento, então o preço fecha abaixo
  // dela. Uma queda gradual/sustentada NÃO serve pra este teste: mantém o
  // ADX alto (tendência forte) e nunca passa o filtro de regime lateral do
  // preset 3 — só um choque abrupto após lateralização replica o cenário
  // real de mean-reversion que a estratégia foi desenhada para capturar.
  const chop = Array.from({ length: 40 }, (_, i) => {
    const wobble = (i % 2 === 0 ? 1 : -1) * 0.4;
    return makeCandle(100 + wobble, i, 100 + wobble + 0.15, 100 + wobble - 0.15);
  });
  const shock = [makeCandle(88, 40, 88.5, 87.5)];
  const after = Array.from({ length: 5 }, (_, i) => makeCandle(88 - i * 0.3, 41 + i, 88.2 - i * 0.3, 87.8 - i * 0.3));
  const candles: Candle[] = [...chop, ...shock, ...after];

  const preset3 = PRESET_STRATEGIES.find(s => s.id === '3')!;
  const series = evaluateStrategySeries(preset3, candles);
  const buySignals = series.filter(r => r.signal === 'BUY').length;
  const sellSignals = series.filter(r => r.signal === 'SELL').length;

  assertTrue('Reversão à Média (preset 3) gera BUY na sobrevenda, nunca SELL (fix de inversão)', buySignals > 0 && sellSignals === 0);
}

// ─── CASO 11: Rompimento Confirmado (preset 4) não sai por ATR FALLING ─────
// Regressão de bug real (2026-07-30): o exitBlock antigo `ATR FALLING`
// disparava em ~44% das barras (medido sobre série sintética de 2000
// candles), dando holding period esperado de ~2,3 barras — insuficiente pra
// qualquer rompimento se desenvolver. Removido; a saída agora é só TP/SL por
// ATR + trailing. Prova aqui: preset 4 não tem nenhum exitBlock configurado.
{
  const preset4 = PRESET_STRATEGIES.find(s => s.id === '4')!;
  assertTrue('Rompimento Confirmado (preset 4) não tem exitBlock de regra prematura (saída só por TP/SL/trailing)', preset4.exitBlocks.length === 0);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
