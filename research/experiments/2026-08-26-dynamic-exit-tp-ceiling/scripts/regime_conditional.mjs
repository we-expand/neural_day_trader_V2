/**
 * Teste: "deixar correr" (TP como alvo mínimo) só quando o trade foi
 * ABERTO durante regime TENDENCIA real (ADX>25, já medido pelo
 * MarketScoreEngine.ts em produção desde 2026-08-24) — em vez de sempre
 * (rejeitado) ou condicionado a MACD no toque do TP (também rejeitado).
 *
 * Amostra pequena e nova (regime só é gravado por trade desde 2026-08-24,
 * ~2 dias de dado real) — resultado é uma leitura inicial, não validação.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ATR_PERIOD = 14, ATR_MULT = 2.0, MAX_HOLD_HOURS_CUTOFF = 30;

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'real_trades.json'), 'utf8'));
const sessionsMode = JSON.parse(readFileSync(join(DATA_DIR, 'sessions_mode.json'), 'utf8'));
const regimeAtEntry = JSON.parse(readFileSync(join(DATA_DIR, 'regime_at_entry.json'), 'utf8'));
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
function replay(trade, candles, { useTrailing, tpBehavior }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle' };
  const side = trade.side;
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco' };
  let effectiveSl = originalSl, tpSuspended = false;
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;
  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'cutoff' };
    const freshAtr = atr(candles, i, ATR_PERIOD);
    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * 1.5) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }
    if (useTrailing && freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * ATR_MULT;
      const refPrice = side === 'LONG' ? c.high : c.low;
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }
    const hitSl = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const touchedTp = originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);
    if (hitSl) return { exitPrice: effectiveSl, exitTime: c.time, reason: 'SL' };
    if (touchedTp && !tpSuspended) {
      if (tpBehavior === 'CEILING') return { exitPrice: originalTp, exitTime: c.time, reason: 'TP' };
      tpSuspended = true;
    }
  }
  return { skipped: 'candles_acabaram' };
}

const rows = [];
for (const trade of trades) {
  const info = regimeAtEntry[trade.id];
  if (!info) continue; // só a janela onde regime já é gravado
  const mode = sessionsMode[trade.session_id];
  if (mode !== 'DINAMICO') continue; // hipótese só faz sentido com trailing ativo
  const candles = candlesBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;

  const A = replay(trade, candles, { useTrailing: true, tpBehavior: 'CEILING' });
  const B = replay(trade, candles, { useTrailing: true, tpBehavior: 'NO_CEILING' });
  if (A.skipped || B.skipped) continue;

  rows.push({
    id: trade.id, symbol: trade.symbol, regime: info.regime, adx: info.adx,
    netA: grossPnl(trade, A.exitPrice) - commission,
    netB: grossPnl(trade, B.exitPrice) - commission,
  });
}

function summarizeGroup(regimeFilter) {
  const g = rows.filter(r => regimeFilter(r.regime));
  return {
    n: g.length,
    net_A_teto: g.reduce((s, r) => s + r.netA, 0),
    net_B_sem_teto: g.reduce((s, r) => s + r.netB, 0),
    delta: g.reduce((s, r) => s + (r.netB - r.netA), 0),
    melhoraram: g.filter(r => r.netB > r.netA).length,
    pioraram: g.filter(r => r.netB < r.netA).length,
  };
}

const out = {
  aviso: 'regime só gravado por trade desde 2026-08-24 — amostra pequena, leitura inicial',
  n_total_com_regime_e_dinamico: rows.length,
  TENDENCIA: summarizeGroup(r => r === 'TENDENCIA'),
  INDEFINIDO: summarizeGroup(r => r === 'INDEFINIDO'),
};
writeFileSync(join(RESULTS_DIR, 'regime_conditional.json'), JSON.stringify({ ...out, detail: rows }, null, 2));
console.log(JSON.stringify(out, null, 2));
