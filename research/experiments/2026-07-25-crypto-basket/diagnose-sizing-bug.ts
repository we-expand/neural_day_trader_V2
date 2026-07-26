/**
 * Diagnóstico do bug de sizing suspeitado na 11.13 (retornos absurdos de
 * -80.000% em XRP/ADA/DOGE no pooling cripto): investiga se o fallback de
 * stop/TP por PONTOS FIXOS (`strategy.stopLoss * pointValue`, ativado quando
 * ATR falha na entrada) está gerando distância de stop desproporcional pra
 * moedas de preço baixo, já que `getPointValue()` retorna 1.0 pra TODA
 * cripto (calibrado implicitamente pra escala BTC/ETH, não pra sub-US$1).
 *
 * Roda com:
 *   npx esbuild research/experiments/2026-07-25-crypto-basket/diagnose-sizing-bug.ts \
 *     --bundle --platform=node --format=esm \
 *     --outfile=/tmp/diagnose-sizing-bug.mjs && node /tmp/diagnose-sizing-bug.mjs
 */
import { runBacktest } from '../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../src/app/data/presetStrategies';
import { Candle } from '../../../src/app/services/indicators/TechnicalIndicators';
import { estimateCostPercent } from '../../CostModel';
import { getPointValue } from '../../../src/app/services/strategy/TradeSizing';

async function fetchBinancePaginated(symbol: string, interval: string, pages: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let endTime = Date.now();
  for (let p = 0; p < pages; p++) {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime}`);
    if (!res.ok) break;
    const raw: any[] = await res.json();
    if (raw.length === 0) break;
    const page: Candle[] = raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    all.unshift(...page);
    endTime = page[0].time - 1;
    await new Promise(r => setTimeout(r, 150));
  }
  return all;
}

async function main() {
  const symbol = 'DOGEUSDT';
  const timeframe = '4h';
  const donchian = PRESET_STRATEGIES.find(s => s.id === '1')!;
  console.log(`Buscando ${symbol} ${timeframe}...`);
  const candles = await fetchBinancePaginated(symbol, timeframe, 22);
  console.log(`${candles.length} candles. Preço mín/máx no período: ${Math.min(...candles.map(c => c.low)).toFixed(6)} / ${Math.max(...candles.map(c => c.high)).toFixed(6)}`);

  const pointValue = getPointValue(symbol);
  const priceLevel = candles[candles.length - 1]?.close ?? 1;
  const roundTripCostPct = estimateCostPercent('CRYPTO', priceLevel, pointValue) * 2;
  const res = runBacktest(candles, donchian, symbol, 'both', 10000, roundTripCostPct);

  const sorted = [...res.trades].sort((a, b) => a.profitPercent - b.profitPercent);
  console.log(`\nTotal trades: ${res.trades.length}. Piores 5 por profitPercent:\n`);
  for (const t of sorted.slice(0, 5)) {
    const slDistanceFromEntry = Math.abs(t.entryPrice - (t.result?.exitPrice ?? t.exitPrice));
    console.log(
      `  ${t.type} entry=${t.entryPrice.toFixed(6)} exit=${t.exitPrice.toFixed(6)} profitPercent=${t.profitPercent.toFixed(1)}% ` +
      `motivo=${t.result?.exitReason} distância_preço=${slDistanceFromEntry.toFixed(6)}`
    );
  }

  const extreme = res.trades.filter(t => Math.abs(t.profitPercent) > 150);
  console.log(`\nTrades com |profitPercent| > 150%: ${extreme.length} de ${res.trades.length}`);
  if (extreme.length > 0) {
    console.log('Isso só é possível (num LONG, perda máx teórica é -100%) se a saída foi via regra de exit/SL com distância desproporcional ao preço do ativo.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
