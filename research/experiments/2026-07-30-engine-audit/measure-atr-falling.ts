import { calculateATR, Candle } from '/Users/clebercouto/Projects/we-expand/Neural-Day-Trader/src/app/services/indicators/TechnicalIndicators';

function makeCandle(close: number, i: number, high?: number, low?: number): Candle {
  return { time: i * 60000, open: close, high: high ?? close, low: low ?? close, close, volume: 1000 };
}
// serie pseudo-realista determinística (sem Math.random), 2000 candles
const candles: Candle[] = [];
let price = 100;
for (let i = 0; i < 2000; i++) {
  const trend = Math.sin(i / 40) * 0.35;
  const noise = Math.sin(i * 2.399963229728653) * 0.6;
  price = Math.max(1, price + trend + noise);
  const rng = 0.4 + Math.abs(Math.sin(i * 1.7)) * 0.6;
  candles.push({ time: i, open: price - noise / 2, high: price + rng, low: price - rng, close: price, volume: 1000 });
}
const atr = calculateATR(candles, 14);
let falling = 0, total = 0;
for (let i = 15; i < atr.length; i++) {
  if (atr[i] === null || atr[i-1] === null) continue;
  total++;
  if (atr[i]! < atr[i-1]!) falling++;
}
console.log(`ATR FALLING dispara em ${falling}/${total} barras = ${(100*falling/total).toFixed(1)}%`);
console.log(`Holding period esperado (geométrico) ≈ ${(1/(falling/total)).toFixed(2)} barras`);
