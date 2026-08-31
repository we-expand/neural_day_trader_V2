/**
 * Teste da proposta refinada do Cleber: breakeven MAIS CEDO (stop pro preço
 * de entrada logo no início do movimento a favor) + trailing MAIS APERTADO
 * (stop "pouco atrás do preço") + SEM teto de TP (deixa correr).
 *
 * Testes anteriores (backtest.mjs, sweep_and_momentum.mjs) já mostraram que:
 * - Remover o teto de TP com o trailing ATUAL (2x ATR, largo) piora (dá de
 *   volta demais do lucro antes de fechar).
 * - Breakeven mais cedo sozinho (mantendo teto de TP) já ajuda (0.5R > 1.5R
 *   atual nos trades fechados).
 * Hipótese nova: talvez remover o teto SÓ funcione se o trailing também for
 * mais apertado (protege mais do pico, dá menos de volta) — é isso que o
 * Cleber está descrevendo ("stop pouco atrás do preço").
 *
 * Varredura 2D sobre os 110 trades DINAMICO com candle completo: breakeven
 * R × multiplicador de ATR do trailing, sempre com TP como alvo mínimo (não
 * teto). Sem look-ahead.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ATR_PERIOD = 14;
const MAX_HOLD_HOURS_CUTOFF = 30;

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
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time + 15 * 60_000 > entryTimeMs) return i;
  }
  return -1;
}

function grossPnl(trade, exitPrice) {
  const entryPrice = parseFloat(trade.entry_price);
  const units = parseFloat(trade.quantity) / entryPrice;
  return trade.side === 'LONG' ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
}

// tpBehavior: 'CEILING' (baseline real) ou 'NO_CEILING' (alvo mínimo, deixa correr)
function replay(trade, candles, { breakevenR, atrMult, tpBehavior }) {
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
  let tpSuspended = false;
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'cutoff' };

    const freshAtr = atr(candles, i, ATR_PERIOD);
    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * breakevenR) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }
    if (freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * atrMult;
      const refPrice = side === 'LONG' ? c.high : c.low;
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }

    const hitSlThisCandle = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const touchedTp = originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);

    if (hitSlThisCandle) return { exitPrice: effectiveSl, exitTime: c.time, reason: 'SL', barsHeld: i - entryIdx + 1 };
    if (touchedTp && !tpSuspended) {
      if (tpBehavior === 'CEILING') return { exitPrice: originalTp, exitTime: c.time, reason: 'TP', barsHeld: i - entryIdx + 1 };
      tpSuspended = true;
    }
  }
  return { skipped: 'candles_acabaram' };
}

const dinamicoTrades = trades.filter(t => sessionsMode[t.session_id] === 'DINAMICO');

const breakevenLevels = [0.25, 0.5, 0.75, 1.0, 1.5];
const trailMultipliers = [0.5, 0.75, 1.0, 1.5, 2.0];

const grid = [];
for (const bR of breakevenLevels) {
  for (const mult of trailMultipliers) {
    let netSum = 0, n = 0, skipped = 0;
    for (const trade of dinamicoTrades) {
      const candles = candlesBySymbol[trade.symbol];
      const commission = parseFloat(trade.commission) || 0;
      const r = replay(trade, candles, { breakevenR: bR, atrMult: mult, tpBehavior: 'NO_CEILING' });
      if (r.skipped) { skipped++; continue; }
      netSum += grossPnl(trade, r.exitPrice) - commission;
      n++;
    }
    grid.push({ breakevenR: bR, atrMult: mult, n, skipped, netSum });
  }
}

// baseline real de comparação: config atual de produção (1.5R, mult 2.0), COM teto de TP
let baselineNet = 0, baselineN = 0;
for (const trade of dinamicoTrades) {
  const candles = candlesBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;
  const r = replay(trade, candles, { breakevenR: 1.5, atrMult: 2.0, tpBehavior: 'CEILING' });
  if (r.skipped) continue;
  baselineNet += grossPnl(trade, r.exitPrice) - commission;
  baselineN++;
}

grid.sort((a, b) => b.netSum - a.netSum);

const out = {
  baseline_producao_atual_com_teto: { breakevenR: 1.5, atrMult: 2.0, n: baselineN, netSum: baselineNet },
  melhor_combinacao_sem_teto: grid[0],
  pior_combinacao_sem_teto: grid[grid.length - 1],
  grid_completo_ordenado: grid,
};
writeFileSync(join(RESULTS_DIR, 'sweep_2d.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ baseline: out.baseline_producao_atual_com_teto, melhor: out.melhor_combinacao_sem_teto, pior: out.pior_combinacao_sem_teto, top5: grid.slice(0, 5), bottom5: grid.slice(-5) }, null, 2));
