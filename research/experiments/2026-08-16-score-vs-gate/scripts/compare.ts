/**
 * Item 2 do redesenho do cérebro (2026-08-16) — mede score contínuo vs. gate
 * binário atual nos MESMOS dados reais em cache de
 * research/experiments/2026-08-05-taxa-base/data/ (15m/1h; 5m fora de escopo
 * aqui — scalp já descartado por research/experiments/2026-08-16-scalp-cost-gate-calibration/).
 *
 * Compara, por preset × ativo × timeframe:
 *   - gate binário atual (runBacktest de produção, sem alteração)
 *   - score contínuo em 4 pisos (40/50/60/70) via runScoredBacktest.ts
 * Métrica: trades/dia (frequência) e netResultPercent (líquido de custo real,
 * mesmo CostModel.ts das medições anteriores).
 *
 * Uso: npx tsx research/experiments/2026-08-16-score-vs-gate/scripts/compare.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest } from '../../../../src/app/services/strategy/BacktestEngine';
import { runScoredBacktest } from './runScoredBacktest';
import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO',
  EURUSD: 'FOREX_MAJOR',
  XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY',
  US30: 'INDEX',
  NAS100: 'INDEX',
  SPX500: 'INDEX',
  GER40: 'INDEX',
};

const TIMEFRAMES = ['15m', '1h'];
const THRESHOLDS = [40, 50, 60, 70];

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles ?? null;
}

interface Row {
  preset: string;
  symbol: string;
  tf: string;
  spanDays: number;
  gateTrades: number;
  gateTradesPerDay: number;
  gateNetPercent: number;
  scoreRows: { threshold: number; trades: number; tradesPerDay: number; netPercent: number }[];
}

const rows: Row[] = [];

for (const preset of PRESET_STRATEGIES) {
  for (const symbol of Object.keys(ASSET_CLASS)) {
    for (const tf of TIMEFRAMES) {
      const candles = loadCandles(symbol, tf);
      if (!candles || !candles.length) continue;

      const assetClass = ASSET_CLASS[symbol];
      const pointValue = getPointValue(symbol);
      const priceLevel = candles[candles.length - 1].close;
      const roundTripCostPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
      const spanDays = (candles[candles.length - 1].time - candles[0].time) / 86_400_000;

      const gate = runBacktest(candles, preset, symbol, 'both', 10000, roundTripCostPercent);
      const gateNetPercent = gate.trades.reduce((a, t) => a + t.profitPercent, 0);

      const scoreRows = THRESHOLDS.map(threshold => {
        const scored = runScoredBacktest(candles, preset, symbol, 'both', 10000, roundTripCostPercent, threshold);
        const netPercent = scored.trades.reduce((a, t) => a + t.profitPercent, 0);
        return {
          threshold,
          trades: scored.trades.length,
          tradesPerDay: scored.trades.length / spanDays,
          netPercent,
        };
      });

      rows.push({
        preset: preset.name, symbol, tf, spanDays,
        gateTrades: gate.trades.length,
        gateTradesPerDay: gate.trades.length / spanDays,
        gateNetPercent,
        scoreRows,
      });
    }
  }
}

writeFileSync(join(RESULTS_DIR, 'score_vs_gate.json'), JSON.stringify(rows, null, 2));

const lines: string[] = [];
lines.push('# Score contínuo vs. gate binário — item 2 do redesenho do cérebro (2026-08-16)');
lines.push('');
lines.push('Mesmos dados reais em cache de `2026-08-05-taxa-base/data/` (15m/1h), mesmo');
lines.push('motor de produção pra saída (TP/SL/trailing), mesmo CostModel.ts. Única');
lines.push('diferença: entrada por score contínuo (`evaluateStrategyScoreAt`) em vez de');
lines.push('gate binário (`evaluateStrategyAt`). Direção `both` (= AUTO de produção).');
lines.push('');
lines.push('| Preset | Ativo | TF | Dias | Gate: trades | Gate: trades/dia | Gate: líq total % | Score40: trades/dia | líq% | Score50: trades/dia | líq% | Score60: trades/dia | líq% | Score70: trades/dia | líq% |');
lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  const cells = r.scoreRows.map(s => `${s.tradesPerDay.toFixed(3)} | ${s.netPercent.toFixed(2)}%`).join(' | ');
  lines.push(
    `| ${r.preset} | ${r.symbol} | ${r.tf} | ${r.spanDays.toFixed(0)} | ${r.gateTrades} | ${r.gateTradesPerDay.toFixed(3)} | ${r.gateNetPercent.toFixed(2)}% | ${cells} |`
  );
}
writeFileSync(join(RESULTS_DIR, 'score_vs_gate.md'), lines.join('\n') + '\n');

console.log(`Gravado: results/score_vs_gate.json e results/score_vs_gate.md (${rows.length} linhas)`);
