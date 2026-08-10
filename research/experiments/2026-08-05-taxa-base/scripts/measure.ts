/**
 * Medição de taxa base — 2026-08-05.
 *
 * Responde ao critério do Cleber: frequência × pontos por trade − custo, para
 * cada combinação preset × ativo × timeframe. NÃO é busca de edge — a busca de
 * julho já fechou essa pergunta (ver CLAUDE.md, "Cérebro de decisão da IA").
 * Isto mede viabilidade OPERACIONAL do que já está implementado: com que
 * frequência cada config dispara e quanto ela captura/perde líquido de custo.
 *
 * Motor: o MESMO `runBacktest` que a UI usa (src/app/services/strategy/BacktestEngine.ts).
 * Nenhuma reimplementação — é o requisito "um motor" já em vigor no projeto.
 * Presets: PRESET_STRATEGIES, zero parâmetro ajustado.
 * Dado: research/experiments/2026-08-05-taxa-base/data/*.json, buscado por
 * fetch_candles.mjs — Binance (cripto) / MetaAPI conta de plataforma (resto).
 * Direção: 'both' (equivalente ao aiConfig.direction === 'AUTO' de produção).
 * Custo: research/CostModel.ts, mesma tabela usada pelos gates de produção.
 *
 * Saída: tabela markdown + JSON em ../results/.
 *
 * Uso: npx tsx research/experiments/2026-08-05-taxa-base/scripts/measure.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest } from '../../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

/**
 * Classe de ativo por símbolo, para o CostModel. Ancorado no que o produto já
 * assume em COST_TABLE (research/CostModel.ts) e no mapeamento de sizing
 * (src/app/services/strategy/TradeSizing.ts) — não é escolha nova.
 *
 * ⚠️ XBNUSD e BTCUSD são o MESMO subjacente no produto
 * (BacktestDataService.CRYPTO_CATALOG_TO_BINANCE_BASE: XBNUSD -> 'BTC').
 * Reportado como achado, não corrigido aqui — corrigir isso é decisão de
 * produto (removeria um "ativo" duplicado do catálogo), fora do escopo desta
 * medição.
 */
const ASSET_CLASS: Record<string, AssetClass> = {
  BTCUSD: 'CRYPTO',
  XBNUSD: 'CRYPTO',
  EURUSD: 'FOREX_MAJOR',
  XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY',
  US30: 'INDEX',
  NAS100: 'INDEX',
  SPX500: 'INDEX',
  GER40: 'INDEX',
};

interface Row {
  presetId: string;
  presetName: string;
  symbol: string;
  timeframe: string;
  candleCount: number;
  spanDays: number;
  trades: number;
  tradesPerDay: number;
  winRate: number;
  avgNetPoints: number;
  avgNetPercent: number;
  netResultPercent: number; // soma de todos os trades, % sobre capital inicial fixo, não composto
  ok: true;
}
interface RowMissing {
  presetId: string;
  presetName: string;
  symbol: string;
  timeframe: string;
  ok: false;
  reason: string;
}

const rows: (Row | RowMissing)[] = [];

function loadCandles(symbol: string, tf: string): { candles: Candle[]; source: string } | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return { candles: payload.candles, source: payload.source };
}

const TIMEFRAMES = ['5m', '15m', '1h'];
const symbolsWanted = Object.keys(ASSET_CLASS);

for (const preset of PRESET_STRATEGIES) {
  for (const symbol of symbolsWanted) {
    for (const tf of TIMEFRAMES) {
      const loaded = loadCandles(symbol, tf);
      if (!loaded || !loaded.candles?.length) {
        rows.push({ presetId: preset.id, presetName: preset.name, symbol, timeframe: tf, ok: false, reason: 'SEM DADO REAL' });
        continue;
      }
      const { candles } = loaded;
      const assetClass = ASSET_CLASS[symbol];
      const pointValue = getPointValue(symbol);
      const priceLevel = candles[candles.length - 1].close;
      const roundTripCostPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2; // ida + volta

      const { trades } = runBacktest(candles, preset, symbol, 'both', 10000, roundTripCostPercent);

      const spanDays = (candles[candles.length - 1].time - candles[0].time) / 86_400_000;
      const n = trades.length;
      if (n === 0) {
        rows.push({
          presetId: preset.id, presetName: preset.name, symbol, timeframe: tf,
          candleCount: candles.length, spanDays, trades: 0, tradesPerDay: 0,
          winRate: 0, avgNetPoints: 0, avgNetPercent: 0, netResultPercent: 0, ok: true,
        });
        continue;
      }
      const wins = trades.filter(t => t.status === 'win').length;
      const avgNetPercent = trades.reduce((a, t) => a + t.profitPercent, 0) / n;
      const netResultPercent = trades.reduce((a, t) => a + t.profitPercent, 0);
      // pontos = distância de preço / pointValue (unidade "ponto" do produto)
      const avgNetPoints = trades.reduce((a, t) => a + (t.exitPrice - t.entryPrice) * (t.type === 'BUY' ? 1 : -1), 0) / n / pointValue;

      rows.push({
        presetId: preset.id, presetName: preset.name, symbol, timeframe: tf,
        candleCount: candles.length, spanDays, trades: n,
        tradesPerDay: n / spanDays,
        winRate: wins / n,
        avgNetPoints, avgNetPercent, netResultPercent, ok: true,
      });
    }
  }
}

writeFileSync(join(RESULTS_DIR, 'taxa_base.json'), JSON.stringify(rows, null, 2));

const lines: string[] = [];
lines.push('# Taxa base — entradas/dia × pontos médios × resultado líquido');
lines.push('');
lines.push('Gerado por `measure.ts`. Motor de produção (`runBacktest`), presets de');
lines.push('produção (`PRESET_STRATEGIES`), custo real (`CostModel.ts`), direção `both`');
lines.push('(= `AUTO` de produção). Mede viabilidade operacional, NÃO edge.');
lines.push('');
lines.push('| Preset | Ativo | TF | Candles | Dias | Trades | Trades/dia | Win% | Pts líq/trade | %líq/trade | Resultado líq total % |');
lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
  if (r.ok === false) {
    lines.push(`| ${r.presetName} | ${r.symbol} | ${r.timeframe} | — | — | — | — | — | — | — | **${r.reason}** |`);
    continue;
  }
  lines.push(
    `| ${r.presetName} | ${r.symbol} | ${r.timeframe} | ${r.candleCount} | ${r.spanDays.toFixed(0)} | ${r.trades} | ${r.tradesPerDay.toFixed(3)} | ${(r.winRate * 100).toFixed(1)}% | ${r.avgNetPoints.toFixed(2)} | ${r.avgNetPercent.toFixed(3)}% | ${r.netResultPercent.toFixed(2)}% |`
  );
}
writeFileSync(join(RESULTS_DIR, 'taxa_base.md'), lines.join('\n') + '\n');

console.log(`Gravado: results/taxa_base.json e results/taxa_base.md (${rows.length} linhas)`);
