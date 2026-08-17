/**
 * Recálculo dos ranges de riskProfiles.ts (item 2 do handoff 2026-08-16).
 *
 * Motivo: taxa_base.json (2026-08-05, fonte atual de
 * `expectedTradesPerDayRange`/`expectedNetPercentPerTradeRange` em
 * src/app/data/riskProfiles.ts) foi medido com capital de $10.000 e
 * positionSizePercent fixo do preset (1%) — nunca aciona o piso de $10
 * (`TradeSizing.calculatePositionSize`), porque 1% de $10k é $100, muito
 * acima do piso. O produto real assume aporte mínimo de US$50. Este script
 * reroda EXATAMENTE as combinações preset×timeframe×ativos já selecionadas
 * pelos 3 perfis, mas com capital=$50 e o riskPerTrade real de cada perfil
 * (0.5% / 1.0% / 1.5%), pra medir se o piso de $10 corrigido (pula o trade
 * em vez de inflar risco, commit d0d28406a) reduz a frequência esperada
 * numa conta no aporte mínimo.
 *
 * Mesmo motor (`runBacktest`), mesmo dado cacheado (`../../2026-08-05-taxa-base/data`),
 * mesmo custo real (`CostModel.ts`). Não é nova busca de edge.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBacktest } from '../../../../src/app/services/strategy/BacktestEngine';
import { PRESET_STRATEGIES } from '../../../../src/app/data/presetStrategies';
import { getPointValue } from '../../../../src/app/services/strategy/TradeSizing';
import { estimateCostPercent, type AssetClass } from '../../../CostModel';
import { RISK_PROFILES } from '../../../../src/app/data/riskProfiles';
import type { Candle } from '../../../../src/app/services/indicators/TechnicalIndicators';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', '2026-08-05-taxa-base', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ASSET_CLASS: Record<string, AssetClass> = {
  XAUUSD: 'COMMODITY',
  XAGUSD: 'COMMODITY',
  US30: 'INDEX',
  NAS100: 'INDEX',
};

function loadCandles(symbol: string, tf: string): Candle[] | null {
  const file = join(DATA_DIR, `${symbol}_${tf}.json`);
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return payload.candles;
}

const ACCOUNT_CAPITAL = 50; // aporte mínimo real do produto

interface RowResult {
  profileId: string;
  symbol: string;
  timeframe: string;
  riskPerTrade: number;
  trades: number;
  skippedByFloor: number; // trades que a versão anterior (piso inflando) teria aberto, mas agora são pulados
  spanDays: number;
  tradesPerDay: number;
  avgNetPercent: number;
}

const results: RowResult[] = [];

for (const profile of RISK_PROFILES) {
  const preset = PRESET_STRATEGIES.find(p => p.id === profile.activeStrategyId);
  if (!preset) throw new Error(`Preset ${profile.activeStrategyId} não encontrado`);
  const tf = profile.timeframe.toLowerCase();

  for (const symbol of profile.activeAssets) {
    const candles = loadCandles(symbol, tf);
    if (!candles?.length) {
      console.error(`SEM DADO: ${symbol} ${tf}`);
      continue;
    }
    const assetClass = ASSET_CLASS[symbol];
    const pointValue = getPointValue(symbol);
    const priceLevel = candles[candles.length - 1].close;
    const roundTripCostPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;

    // Preset com positionSizePercent substituído pelo riskPerTrade real do perfil
    // (na produção, aiConfig.riskPerTrade é quem manda — não strategy.positionSizePercent,
    // ver runTradingCycle.ts; aqui replicamos isso pro backtest de pesquisa).
    const strategyWithProfileRisk = { ...preset, positionSizePercent: profile.riskPerTrade };

    const { trades } = runBacktest(candles, strategyWithProfileRisk, symbol, 'both', ACCOUNT_CAPITAL, roundTripCostPercent);
    // Referência: mesma corrida com capital "grande" (nunca aciona piso), pra saber quantos
    // trades o piso de $10 corrigido está descartando numa conta de $50.
    const { trades: tradesNoFloor } = runBacktest(candles, strategyWithProfileRisk, symbol, 'both', 10_000_000, roundTripCostPercent);

    const spanDays = (candles[candles.length - 1].time - candles[0].time) / 86_400_000;
    const n = trades.length;
    const avgNetPercent = n > 0 ? trades.reduce((a, t) => a + t.profitPercent, 0) / n : 0;

    results.push({
      profileId: profile.id,
      symbol,
      timeframe: profile.timeframe,
      riskPerTrade: profile.riskPerTrade,
      trades: n,
      skippedByFloor: tradesNoFloor.length - n,
      spanDays,
      tradesPerDay: n / spanDays,
      avgNetPercent,
    });
  }
}

writeFileSync(join(RESULTS_DIR, 'recalculo_perfis.json'), JSON.stringify(results, null, 2));

const lines: string[] = [];
lines.push('# Recálculo dos ranges de riskProfiles.ts com capital real ($50) — 2026-08-16');
lines.push('');
lines.push('| Perfil | Ativo | TF | Risco/trade | Trades | Pulados p/ piso | Dias | Trades/dia | %líq/trade médio |');
lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|');
for (const r of results) {
  lines.push(`| ${r.profileId} | ${r.symbol} | ${r.timeframe} | ${r.riskPerTrade}% | ${r.trades} | ${r.skippedByFloor} | ${r.spanDays.toFixed(0)} | ${r.tradesPerDay.toFixed(3)} | ${r.avgNetPercent.toFixed(3)}% |`);
}
writeFileSync(join(RESULTS_DIR, 'recalculo_perfis.md'), lines.join('\n') + '\n');

// Agregado por perfil, no mesmo formato de riskProfiles.ts (range min-max da soma de trades/dia da cesta)
console.log('\n=== Agregado por perfil (soma trades/dia da cesta) ===');
for (const profile of RISK_PROFILES) {
  const rows = results.filter(r => r.profileId === profile.id);
  const totalTradesPerDay = rows.reduce((a, r) => a + r.tradesPerDay, 0);
  const netPercents = rows.filter(r => r.trades > 0).map(r => r.avgNetPercent);
  const minNet = netPercents.length ? Math.min(...netPercents) : 0;
  const maxNet = netPercents.length ? Math.max(...netPercents) : 0;
  const totalSkipped = rows.reduce((a, r) => a + r.skippedByFloor, 0);
  console.log(`${profile.id}: tradesPerDay(soma)=${totalTradesPerDay.toFixed(3)} | netPercentRange=[${minNet.toFixed(3)}%, ${maxNet.toFixed(3)}%] | pulados_pelo_piso=${totalSkipped}`);
}

console.log(`\nGravado: results/recalculo_perfis.json e results/recalculo_perfis.md (${results.length} linhas)`);
