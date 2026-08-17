import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IndicatorCache } from '../../../../src/app/services/strategy/StrategyEvaluator';
import { resolveTpSl, getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '2026-08-05-taxa-base', 'data');

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')).candles ?? null;
}

// Threshold onde o piso de $10 passa a distorcer: stopDistancePercent > riskCapital/10
// riskCapital = 50 * riskPerTrade% * sizeMultiplier(MODERATE=1.0)
function floorTriggerThreshold(riskPerTradePercent: number) {
  const riskCapital = 50 * (riskPerTradePercent / 100) * 1.0;
  return riskCapital / 10; // stopDistancePercent (fração) acima disso aciona o piso
}

const combos: [string, string[], number][] = [
  ['1', ['XAUUSD','XAGUSD','NAS100','US30'], 0.5], // Conservador
  ['4', ['XAUUSD','XAGUSD','US30'], 1.0],           // Moderado
  ['4', ['XAUUSD','XAGUSD','US30'], 1.5],           // Agressivo
];

for (const [presetId, symbols, riskPerTrade] of combos) {
  const preset = PRESET_STRATEGIES.find(p => p.id === presetId)!;
  const threshold = floorTriggerThreshold(riskPerTrade);
  let total = 0, hitsFloor = 0;
  for (const symbol of symbols) {
    const candles = loadCandles(symbol, '1h');
    if (!candles) continue;
    const cache = new IndicatorCache(candles);
    const pointValue = getPointValue(symbol);
    for (let i = 60; i < candles.length; i++) {
      const atr = cache.get('ATR', 14)[i];
      if (atr === null) continue;
      const entryPrice = candles[i].close;
      const { slDistance } = resolveTpSl(preset, 'LONG', entryPrice, pointValue, atr);
      const stopDistancePercent = slDistance / entryPrice;
      total++;
      if (stopDistancePercent > threshold) hitsFloor++;
    }
  }
  console.log(`preset=${presetId} risco=${riskPerTrade}% threshold(stopDist%)=${(threshold*100).toFixed(3)}% -> ${hitsFloor}/${total} candles teriam stop largo o bastante pra acionar o piso de $10 (${((hitsFloor/total)*100).toFixed(2)}%)`);
}
