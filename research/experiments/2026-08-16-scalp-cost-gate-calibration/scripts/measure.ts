/**
 * Medição do movimento típico REAL de 1 minuto, por ativo — pra recalibrar o
 * gate de custo (`CostViabilityGate.ts`) especificamente pro modo SCALP.
 *
 * Motivo (achado da investigação de 2026-08-16, sessão de calibração do
 * runner): o gate em produção usa ATR(14) INSTANTÂNEO do candle atual como
 * proxy de "movimento típico" (`runTradingCycle.ts`), mas os limiares
 * (7%/12%) foram calibrados com movimento típico de BTCUSDT em 15m/1h/4h/1d
 * (seção 14.3 da spec) — nunca com 1m. Resultado observado: 89% dos sinais
 * do preset 5 (scalp, 1m) são vetados por COST_GATE, com razões custo/ATR de
 * 116%-228% (`ai_decisions`, sessão 41378b46...).
 *
 * Este script mede, com dado REAL de 1m (`../data/*.json`, buscado por
 * fetch_candles.mjs), a MEDIANA do ATR(14) como % do preço em cada barra de
 * 1m — não o valor instantâneo de uma barra isolada, a distribuição inteira
 * — e compara contra o custo round-trip real (mesmo CostModel.ts do produto).
 * Saída: tabela com o ratio custo/movimento típico medido por ativo, pra
 * embasar uma calibração SCALP_TYPICAL_MOVEMENT_1M nova (só usada quando
 * strategy.regime === 'SCALP').
 *
 * Uso: npx tsx research/experiments/2026-08-16-scalp-cost-gate-calibration/scripts/measure.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateATR, type Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO',
  XBNUSD: 'CRYPTO',
  EURUSD: 'FOREX_MAJOR',
  XAUUSD: 'COMMODITY',
  GER40: 'INDEX',
  SPX500: 'INDEX',
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * s.length)));
  return s[idx];
}

interface Row {
  symbol: string;
  n: number;
  medianAtrPercent: number;
  p25AtrPercent: number;
  costPercent: number;
  ratioMedian: number; // custo / mediana do movimento
  ratioP25: number; // custo / movimento no percentil 25 (cenário conservador, barra parada)
}

const rows: Row[] = [];

for (const symbol of Object.keys(ASSET_CLASS)) {
  const file = join(DATA_DIR, `${symbol}_1m.json`);
  if (!existsSync(file)) {
    console.log(`✗ ${symbol}: sem arquivo de dado real, pulado`);
    continue;
  }
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const candles: Candle[] = raw.candles.map((c: any) => ({
    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
  }));
  const atrSeries = calculateATR(candles, 14);
  const atrPercentSeries: number[] = [];
  for (let i = 0; i < atrSeries.length; i++) {
    const atr = atrSeries[i];
    const price = candles[i]?.close;
    if (atr && price > 0) atrPercentSeries.push((atr / price) * 100);
  }
  if (!atrPercentSeries.length) {
    console.log(`✗ ${symbol}: ATR não calculável (série curta demais)`);
    continue;
  }

  const medianAtrPercent = median(atrPercentSeries);
  const p25AtrPercent = percentile(atrPercentSeries, 25);

  const lastPrice = candles[candles.length - 1].close;
  const pointValue = getPointValue(symbol);
  const costPercent = estimateCostPercent(ASSET_CLASS[symbol], lastPrice, pointValue) * 2 * 100;

  rows.push({
    symbol,
    n: atrPercentSeries.length,
    medianAtrPercent,
    p25AtrPercent,
    costPercent,
    ratioMedian: costPercent / medianAtrPercent,
    ratioP25: costPercent / p25AtrPercent,
  });
}

const lines: string[] = [];
lines.push('# Movimento típico REAL de 1m vs. custo round-trip — medição 2026-08-16');
lines.push('');
lines.push('Dado real (Binance/MetaAPI conta de plataforma), ver `../data/*.json` e `fetch_candles.mjs`.');
lines.push('ATR(14) calculado sobre cada barra de 1m; "mediana" e "p25" são a distribuição inteira da série, não um valor instantâneo isolado.');
lines.push('');
lines.push('| Ativo | n barras | ATR mediana (%preço) | ATR p25 (%preço) | Custo round-trip (%) | Custo/ATR mediana | Custo/ATR p25 |');
lines.push('|---|---|---|---|---|---|---|');
for (const r of rows) {
  lines.push(
    `| ${r.symbol} | ${r.n} | ${r.medianAtrPercent.toFixed(4)}% | ${r.p25AtrPercent.toFixed(4)}% | ${r.costPercent.toFixed(4)}% | ${(r.ratioMedian * 100).toFixed(1)}% | ${(r.ratioP25 * 100).toFixed(1)}% |`
  );
}
lines.push('');
lines.push('Limiares do gate: FRONTEIRA=7%, INVIAVEL=12% (razão custo/movimento).');
console.log(lines.join('\n'));

writeFileSync(join(RESULTS_DIR, 'RESULTADOS.md'), lines.join('\n') + '\n');
writeFileSync(join(RESULTS_DIR, 'results.json'), JSON.stringify(rows, null, 2));
