/**
 * Duas análises adicionais, motivadas pelo achado de reversao (61,8% dos
 * trades chegaram a ficar no lucro e fecharam no zero/prejuízo):
 *
 * 1) VARREDURA de gatilho de breakeven (hoje travado em 1.5R): 0.5R até 2R,
 *    sobre os 166 trades reais (breakeven roda em FIXO e DINAMICO, trailing
 *    só em DINAMICO — igual produção). Sem look-ahead.
 * 2) TP condicional a momentum (MACD histograma) — só suspende o teto de TP
 *    quando o histograma ainda está acelerando a favor no toque do alvo,
 *    senão fecha normal. Só faz sentido em DINAMICO (mesma restrição do
 *    experimento anterior).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const ATR_PERIOD = 14;
const ATR_MULT = 2.0;
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

// ---- MACD (réplica fiel de TechnicalIndicators.ts: EMA 12/26, sinal EMA 9, seed SMA) ----
function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out[i] = prev;
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}
function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = closes.map((_, i) => (fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null));
  const firstValid = macdLine.findIndex(v => v !== null);
  const signalLine = new Array(closes.length).fill(null);
  if (firstValid !== -1) {
    const vals = macdLine.slice(firstValid).map(v => v);
    const sig = ema(vals, signal);
    sig.forEach((v, idx) => { signalLine[firstValid + idx] = v; });
  }
  const histogram = closes.map((_, i) => (macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null));
  return { macd: macdLine, signal: signalLine, histogram };
}

// Pré-computa histograma MACD por símbolo (candles fechados na sequência real, sem look-ahead: histograma[i] só usa candles até i)
const macdBySymbol = {};
for (const [symbol, candles] of Object.entries(candlesBySymbol)) {
  macdBySymbol[symbol] = calculateMACD(candles.map(c => c.close)).histogram;
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

/**
 * mode de saída: 'CEILING' (fecha sempre no TP), 'NO_CEILING' (nunca fecha no TP,
 * só trailing), 'MOMENTUM' (só deixa correr se histograma MACD estiver
 * acelerando a favor no candle em que tocou o TP).
 */
function replay(trade, candles, macdHist, { breakevenR, useTrailing, tpBehavior }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle_entrada_ou_aquecimento_atr' };

  const side = trade.side;
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco_original' };

  let effectiveSl = originalSl;
  let tpSuspended = false; // uma vez que decide deixar correr (modo MOMENTUM), não volta atrás
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'estourou_cutoff_seguranca' };

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

    const hitSlThisCandle = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const touchedTpThisCandle = originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);

    if (hitSlThisCandle) return { exitPrice: effectiveSl, exitTime: c.time, reason: 'SL', barsHeld: i - entryIdx + 1 };

    if (touchedTpThisCandle && !tpSuspended) {
      if (tpBehavior === 'CEILING') {
        return { exitPrice: originalTp, exitTime: c.time, reason: 'TP', barsHeld: i - entryIdx + 1 };
      }
      if (tpBehavior === 'NO_CEILING') {
        tpSuspended = true; // deixa correr daqui pra frente, só sai por SL/trailing
      }
      if (tpBehavior === 'MOMENTUM') {
        const hist = macdHist[i];
        const prevHist = macdHist[i - 1];
        const accelerandoAFavor = hist !== null && prevHist !== null && (side === 'LONG' ? (hist > 0 && hist > prevHist) : (hist < 0 && hist < prevHist));
        if (accelerandoAFavor) {
          tpSuspended = true; // deixa correr só enquanto momentum sustenta
        } else {
          return { exitPrice: originalTp, exitTime: c.time, reason: 'TP', barsHeld: i - entryIdx + 1 };
        }
      }
    }
  }
  return { skipped: 'candles_acabaram_antes_de_fechar' };
}

// ==================== 1) VARREDURA DE BREAKEVEN ====================
const breakevenLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const sweepResults = {};
for (const R of breakevenLevels) {
  let netSum = 0, n = 0, skipped = 0;
  for (const trade of trades) {
    const mode = sessionsMode[trade.session_id];
    if (!mode) { skipped++; continue; }
    const candles = candlesBySymbol[trade.symbol];
    const commission = parseFloat(trade.commission) || 0;
    const r = replay(trade, candles, macdBySymbol[trade.symbol], { breakevenR: R, useTrailing: mode === 'DINAMICO', tpBehavior: 'CEILING' });
    if (r.skipped) { skipped++; continue; }
    netSum += grossPnl(trade, r.exitPrice) - commission;
    n++;
  }
  sweepResults[`R_${R}`] = { n, skipped, netSum };
}

// ==================== 2) TP CONDICIONAL A MOMENTUM (só DINAMICO) ====================
const momentumRows = [];
for (const trade of trades) {
  const mode = sessionsMode[trade.session_id];
  if (mode !== 'DINAMICO') continue;
  const candles = candlesBySymbol[trade.symbol];
  const macdHist = macdBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;

  const A = replay(trade, candles, macdHist, { breakevenR: 1.5, useTrailing: true, tpBehavior: 'CEILING' });
  const C = replay(trade, candles, macdHist, { breakevenR: 1.5, useTrailing: true, tpBehavior: 'MOMENTUM' });
  if (A.skipped || C.skipped) continue;

  const netA = grossPnl(trade, A.exitPrice) - commission;
  const netC = grossPnl(trade, C.exitPrice) - commission;
  momentumRows.push({ id: trade.id, symbol: trade.symbol, netA, netC, delta: netC - netA });
}
const momentumSummary = {
  n_pares: momentumRows.length,
  net_A_teto_fixo: momentumRows.reduce((s, r) => s + r.netA, 0),
  net_C_momentum_condicional: momentumRows.reduce((s, r) => s + r.netC, 0),
  delta: momentumRows.reduce((s, r) => s + r.delta, 0),
  melhoraram: momentumRows.filter(r => r.delta > 0).length,
  pioraram: momentumRows.filter(r => r.delta < 0).length,
  iguais: momentumRows.filter(r => r.delta === 0).length,
};

const out = { breakeven_sweep: sweepResults, tp_condicional_momentum: momentumSummary };
writeFileSync(join(RESULTS_DIR, 'sweep_and_momentum.json'), JSON.stringify(out, null, 2));
writeFileSync(join(RESULTS_DIR, 'momentum_detail.json'), JSON.stringify(momentumRows, null, 2));
console.log(JSON.stringify(out, null, 2));
