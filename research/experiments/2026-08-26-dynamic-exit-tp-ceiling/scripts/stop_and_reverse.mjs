/**
 * Testa a ideia nova do Cleber: quando o stop bate ("falhou"), abrir
 * automaticamente uma posição no lado OPOSTO (stop-and-reverse) — mesma
 * lógica que ele fez manualmente (short perdeu pouco, virou long, ganhou
 * grande).
 *
 * Metodologia: pega a saída real simulada (réplica fiel de produção, 1.5R
 * breakeven + trailing DINAMICO igual sempre) de cada trade que fechou por
 * SL. Abre um trade espelhado no lado oposto, no preço exato da saída,
 * mesma distância de risco (SL/TP 1:3 espelhados), e deixa rodar pra
 * frente com a MESMA lógica de gestão (breakeven+trailing), usando candle
 * real seguinte. Sem look-ahead: a reversão só usa candle POSTERIOR à
 * saída do trade original.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ATR_PERIOD = 14, ATR_MULT = 2.0, BREAKEVEN_R = 1.5, MAX_HOLD_HOURS_CUTOFF = 30;

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
function findIndexAtOrAfter(candles, timeMs) {
  for (let i = 0; i < candles.length; i++) if (candles[i].time + 15 * 60_000 > timeMs) return i;
  return -1;
}

// side genérico: 'LONG'|'SHORT'; entryPrice/sl/tp já resolvidos por quem chama
function replayGeneric(candles, startIdx, { side, entryPrice, sl, tp, useTrailing, cutoffTimeMs }) {
  const originalRisk = Math.abs(entryPrice - sl);
  if (!(originalRisk > 0) || startIdx < ATR_PERIOD || startIdx === -1) return { skipped: 'invalido' };
  let effectiveSl = sl;
  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'cutoff' };
    const freshAtr = atr(candles, i, ATR_PERIOD);
    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * BREAKEVEN_R) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }
    if (useTrailing && freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * ATR_MULT;
      const refPrice = side === 'LONG' ? c.high : c.low;
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }
    const hitSl = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const hitTp = tp > 0 && (side === 'LONG' ? c.high >= tp : c.low <= tp);
    if (hitSl) return { exitPrice: effectiveSl, exitIdx: i, reason: 'SL' };
    if (hitTp) return { exitPrice: tp, exitIdx: i, reason: 'TP' };
  }
  return { skipped: 'candles_acabaram' };
}

function grossPnl(side, entryPrice, quantityUsd, exitPrice) {
  const units = quantityUsd / entryPrice;
  return side === 'LONG' ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
}

const rows = [];
for (const trade of trades) {
  const mode = sessionsMode[trade.session_id];
  if (!mode) continue;
  const candles = candlesBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findIndexAtOrAfter(candles, entryTimeMs);
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const quantityUsd = parseFloat(trade.quantity);
  const cutoff = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  const original = replayGeneric(candles, entryIdx, {
    side: trade.side, entryPrice, sl: originalSl, tp: originalTp,
    useTrailing: mode === 'DINAMICO', cutoffTimeMs: cutoff,
  });
  if (original.skipped || original.reason !== 'SL') continue; // só testa "falhou" = saiu por SL

  const originalNet = grossPnl(trade.side, entryPrice, quantityUsd, original.exitPrice) - commission;

  // Reversão: lado oposto, abre no preço de saída, mesma distância de risco espelhada, mesmo R:R 1:3.
  const reverseSide = trade.side === 'LONG' ? 'SHORT' : 'LONG';
  const riskDistance = Math.abs(entryPrice - originalSl);
  const reverseEntryPrice = original.exitPrice;
  const reverseSl = reverseSide === 'LONG' ? reverseEntryPrice - riskDistance : reverseEntryPrice + riskDistance;
  const reverseTp = reverseSide === 'LONG' ? reverseEntryPrice + riskDistance * 3 : reverseEntryPrice - riskDistance * 3;
  const reverseStartIdx = original.exitIdx + 1; // sem look-ahead: só candle DEPOIS da saída original
  const reverseCutoff = candles[original.exitIdx] ? candles[original.exitIdx].time + MAX_HOLD_HOURS_CUTOFF * 3600_000 : cutoff;

  const reverse = replayGeneric(candles, reverseStartIdx, {
    side: reverseSide, entryPrice: reverseEntryPrice, sl: reverseSl, tp: reverseTp,
    useTrailing: mode === 'DINAMICO', cutoffTimeMs: reverseCutoff,
  });

  if (reverse.skipped) {
    rows.push({ id: trade.id, symbol: trade.symbol, originalNet, reverseNet: null, skipped: reverse.skipped });
    continue;
  }
  const reverseNet = grossPnl(reverseSide, reverseEntryPrice, quantityUsd, reverse.exitPrice) - commission;
  rows.push({ id: trade.id, symbol: trade.symbol, originalNet, reverseNet, combined: originalNet + reverseNet, reverseReason: reverse.reason });
}

const resolved = rows.filter(r => r.reverseNet !== null);
const summary = {
  total_trades_que_falharam_por_SL: rows.length,
  reversoes_resolvidas_com_candle_disponivel: resolved.length,
  net_original_sozinho: resolved.reduce((s, r) => s + r.originalNet, 0),
  net_so_da_reversao: resolved.reduce((s, r) => s + r.reverseNet, 0),
  net_combinado_original_mais_reversao: resolved.reduce((s, r) => s + r.combined, 0),
  reversoes_que_deram_TP: resolved.filter(r => r.reverseReason === 'TP').length,
  reversoes_que_deram_SL: resolved.filter(r => r.reverseReason === 'SL').length,
  reversao_ajudou_em_quantos_casos: resolved.filter(r => r.reverseNet > 0).length,
  reversao_piorou_em_quantos_casos: resolved.filter(r => r.reverseNet < 0).length,
};

writeFileSync(join(RESULTS_DIR, 'stop_and_reverse.json'), JSON.stringify({ summary, detail: rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
