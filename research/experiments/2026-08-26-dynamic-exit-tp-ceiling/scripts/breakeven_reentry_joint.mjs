/**
 * Fecha a pendência do Adendo 2: varredura de gatilho de breakeven JUNTO
 * com o custo estimado de reentrada — pra saber se apertar o gatilho
 * (que parecia ótimo isolado) ainda compensa depois de descontar o custo
 * real de round-trip extra que motivou o 1R→1,5R em 2026-08-25.
 *
 * Custo de reentrada não é simulado do zero — é medido EMPIRICAMENTE do
 * histórico real: qual a chance real de reabrir o mesmo símbolo/sessão em
 * até 30min depois de um fechamento perto de zero vs. um fechamento normal,
 * e qual o custo médio real dessa reentrada (commission já inclui round-trip
 * desde o fix de 2026-08-24).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

// Medido via SQL real em produção (ai_trades, 45 dias, BTC/ETH/SOL, SL/TP, stop_loss>0):
const REOPEN_PROB_NEAR_ZERO = 0.578; // fechamentos com |net_pnl| < $0.15
const REOPEN_PROB_NORMAL = 0.484;    // demais fechamentos
const AVG_REENTRY_COMMISSION = 0.0114; // custo médio real da reentrada quando acontece

const ATR_PERIOD = 14, ATR_MULT = 2.0, MAX_HOLD_HOURS_CUTOFF = 30;

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'real_trades.json'), 'utf8'));
const sessionsMode = JSON.parse(readFileSync(join(DATA_DIR, 'sessions_mode.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_15m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_15m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_15m.json'), 'utf8')),
};

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
  for (let i = 0; i < candles.length; i++) if (candles[i].time + 15 * 60_000 > entryTimeMs) return i;
  return -1;
}
function grossPnl(trade, exitPrice) {
  const entryPrice = parseFloat(trade.entry_price);
  const units = parseFloat(trade.quantity) / entryPrice;
  return trade.side === 'LONG' ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
}

function replay(trade, candles, { breakevenR, useTrailing }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle' };
  const side = trade.side;
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco' };
  let effectiveSl = originalSl;
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;
  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'cutoff' };
    const freshAtr = atr(candles, i, ATR_PERIOD);
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
    if (hitSl) return { exitPrice: effectiveSl, reason: 'SL' };
    if (hitTp) return { exitPrice: originalTp, reason: 'TP' };
  }
  return { skipped: 'candles_acabaram' };
}

const breakevenLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const rows = [];
for (const R of breakevenLevels) {
  let netSum = 0, reentryCostSum = 0, n = 0, skipped = 0, nearZeroCount = 0;
  for (const trade of trades) {
    const mode = sessionsMode[trade.session_id];
    if (!mode) { skipped++; continue; }
    const candles = candlesBySymbol[trade.symbol];
    const commission = parseFloat(trade.commission) || 0;
    const r = replay(trade, candles, { breakevenR: R, useTrailing: mode === 'DINAMICO' });
    if (r.skipped) { skipped++; continue; }
    const entryPrice = parseFloat(trade.entry_price);
    const originalRisk = Math.abs(entryPrice - parseFloat(trade.stop_loss));
    const netPnl = grossPnl(trade, r.exitPrice) - commission;
    const isNearZero = Math.abs(netPnl) < 0.15;
    if (isNearZero) nearZeroCount++;
    const reopenProb = isNearZero ? REOPEN_PROB_NEAR_ZERO : REOPEN_PROB_NORMAL;
    reentryCostSum += reopenProb * AVG_REENTRY_COMMISSION;
    netSum += netPnl;
    n++;
  }
  rows.push({
    breakevenR: R, n, skipped, netSum_bruto: netSum,
    fechamentos_perto_do_zero: nearZeroCount,
    custo_esperado_reentrada: reentryCostSum,
    netSum_ajustado: netSum - reentryCostSum,
  });
}

writeFileSync(join(RESULTS_DIR, 'breakeven_reentry_joint.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
