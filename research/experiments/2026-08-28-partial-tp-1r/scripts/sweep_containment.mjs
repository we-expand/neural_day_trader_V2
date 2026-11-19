/**
 * Sweep de contenção: gatilho de breakeven+parcial (0,3R a 1,0R) × % do
 * parcial (30/50/70%), sobre candle REAL de 5m (mais fino que o 15m
 * anterior — próximo passo já apontado no experimento de 2026-08-26,
 * Adendo 4). Réplica fiel de positionManager.ts, sem look-ahead.
 *
 * Motivação (2026-08-28): achado de MFE mostrou que 89,2% dos trades
 * perdedores tiveram lucro flutuante real (mediana $0,55) — a maioria
 * REVERTE ANTES de 1R, faixa que o TP parcial já implementado (gatilho
 * 1R) não cobre. Cleber pediu contenção severa. Este sweep testa gatilhos
 * mais cedo, sobre dado real, antes de mudar produção de novo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const RR_BY_TARGET = { POUCOS: 1.5, CURTO: 2.0, MÉDIO: 3.0, LONGO: 4.0, MUITOS: 5.0 };
const ATR_PERIOD = 14;
const ATR_MULT = 2.0;
const MAX_HOLD_HOURS_CUTOFF = 30;

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'trades_sweep.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_5m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_5m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_5m.json'), 'utf8')),
};
const BAR_MS = 5 * 60_000;

function atr(candles, uptoIdx, period) {
  if (uptoIdx < period) return null;
  let sum = 0;
  for (let i = uptoIdx - period + 1; i <= uptoIdx; i++) {
    const cur = candles[i], prev = candles[i - 1];
    if (!prev) return null;
    sum += Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
  }
  return sum / period;
}
function findEntryIndex(candles, entryTimeMs) {
  for (let i = 0; i < candles.length; i++) if (candles[i].time + BAR_MS > entryTimeMs) return i;
  return -1;
}
function grossPnlFraction(trade, price, fraction) {
  const entryPrice = parseFloat(trade.entry_price);
  const units = (parseFloat(trade.quantity) * fraction) / entryPrice;
  return trade.side === 'LONG' ? (price - entryPrice) * units : (entryPrice - price) * units;
}

/** breakevenR e partial (null = sem parcial) compartilham o mesmo gatilho, de propósito (mesma lógica de produção). */
function replay(trade, candles, { useTrailing, breakevenR, partialPercent }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle_entrada_ou_aquecimento_atr' };

  const side = trade.side;
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco_original' };

  const partialTriggerPrice = partialPercent
    ? (side === 'LONG' ? entryPrice + originalRisk * breakevenR : entryPrice - originalRisk * breakevenR)
    : null;

  let effectiveSl = originalSl;
  let partialFill = null;
  let remainingFraction = 1.0;
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'estourou_cutoff_seguranca' };
    const freshAtr = atr(candles, i, ATR_PERIOD);

    const hitSlBeforeMove = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    if (partialPercent && !partialFill) {
      const touched = side === 'LONG' ? c.high >= partialTriggerPrice : c.low <= partialTriggerPrice;
      if (touched && !hitSlBeforeMove) {
        partialFill = { price: partialTriggerPrice, fraction: partialPercent, time: c.time };
        remainingFraction = 1 - partialPercent;
      }
    }

    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * breakevenR) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }

    if (useTrailing && freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * ATR_MULT;
      const refPrice = side === 'LONG' ? c.high : c.low;
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }

    const hitSl = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const hitTp = originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);
    if (hitSl || hitTp) {
      const reason = hitSl ? 'SL' : 'TP';
      const exitPrice = hitSl ? effectiveSl : originalTp;
      return { exitPrice, exitTime: c.time, reason, partialFill, remainingFraction };
    }
  }
  return { skipped: 'candles_acabaram_antes_de_fechar' };
}

function runConfig(breakevenR, partialPercent) {
  let net = 0, n = 0, skippedCount = 0, wins = 0, partialFires = 0;
  for (const t of trades) {
    const candles = candlesBySymbol[t.symbol];
    const commission = parseFloat(t.commission) || 0;
    const useTrailing = t.slmode === 'DINAMICO';
    const r = replay(t, candles, { useTrailing, breakevenR, partialPercent });
    if (r.skipped) { skippedCount++; continue; }
    n++;
    let gp;
    if (r.partialFill) {
      partialFires++;
      gp = grossPnlFraction(t, r.partialFill.price, r.partialFill.fraction) + grossPnlFraction(t, r.exitPrice, r.remainingFraction);
    } else {
      gp = grossPnlFraction(t, r.exitPrice, 1.0);
    }
    const netPnl = gp - commission;
    net += netPnl;
    if (netPnl > 0) wins++;
  }
  return { breakevenR, partialPercent: partialPercent ?? 'sem_parcial', n, skippedCount, net: +net.toFixed(4), winRate: n ? +(wins / n * 100).toFixed(1) : null, partialFires };
}

const results = [];
const BE_GRID = [0.3, 0.4, 0.5, 0.6, 0.75, 1.0];
// baseline: breakeven no gatilho, SEM parcial (isola o efeito do parcial vs. só apertar o breakeven)
for (const be of BE_GRID) results.push(runConfig(be, null));
// com parcial, mesmo gatilho do breakeven, variando %
for (const be of BE_GRID) for (const pct of [0.3, 0.5, 0.7]) results.push(runConfig(be, pct));

writeFileSync(join(RESULTS_DIR, 'sweep_containment.json'), JSON.stringify(results, null, 2));
console.table(results.map(r => ({ ...r })));

const best = [...results].sort((a, b) => b.net - a.net)[0];
console.log('\nMELHOR CONFIG:', JSON.stringify(best, null, 2));

const prodBaseline = results.find(r => r.breakevenR === 1.0 && r.partialPercent === 'sem_parcial');
const shippedToday = results.find(r => r.breakevenR === 1.0 && r.partialPercent === 0.5);
console.log('\nProdução ANTES de hoje (breakeven 1R, sem parcial):', JSON.stringify(prodBaseline));
console.log('Produção HOJE (breakeven 1R + parcial 50%, já deployado):', JSON.stringify(shippedToday));
