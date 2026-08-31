/**
 * Backtest: teto de TP fixo vs. TP como alvo mínimo (deixa correr com
 * trailing ATR depois de bater o alvo original).
 *
 * Réplica FIEL de supabase/functions/ai-runner/lib/positionManager.ts
 * (tickPositionManager): breakeven em +1.5R, trailing ATR(14) mult=2,
 * sobre candle real de 15m da Binance. Sem look-ahead: cada tick só usa
 * candles até aquele ponto no tempo pra calcular ATR.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const BREAKEVEN_TRIGGER_R = 1.5;
const ATR_PERIOD = 14;
const ATR_MULT = 2.0;
const MAX_HOLD_HOURS_CUTOFF = 30; // segurança: nunca deixa "imortal"

const trades = JSON.parse(readFileSync(join(DATA_DIR, 'real_trades.json'), 'utf8'));
const sessionsMode = JSON.parse(readFileSync(join(DATA_DIR, 'sessions_mode.json'), 'utf8'));
const candlesBySymbol = {
  BTCUSD: JSON.parse(readFileSync(join(DATA_DIR, 'BTCUSD_15m.json'), 'utf8')),
  ETHUSD: JSON.parse(readFileSync(join(DATA_DIR, 'ETHUSD_15m.json'), 'utf8')),
  SOLUSD: JSON.parse(readFileSync(join(DATA_DIR, 'SOLUSD_15m.json'), 'utf8')),
};

function atr(candles, uptoIdx, period) {
  // Wilder-style simple ATR (média simples dos true ranges), mesma
  // aproximação usada em TechnicalIndicators.ts para consistência de ordem
  // de grandeza. uptoIdx é INCLUSIVE e não olha candles futuros.
  if (uptoIdx < period) return null;
  let sum = 0;
  for (let i = uptoIdx - period + 1; i <= uptoIdx; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    if (!prev) return null;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    sum += tr;
  }
  return sum / period;
}

function findEntryIndex(candles, entryTimeMs) {
  // primeiro candle cujo horário de FECHAMENTO (open+15m) é >= entrada real
  // (o candle "em formação" no momento da entrada) — pra simular decisão só
  // com dado já existente.
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time + 15 * 60_000 > entryTimeMs) return i;
  }
  return -1;
}

function replay(trade, candles, { respectTpCeiling, useTrailing }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle_entrada_ou_aquecimento_atr' };

  const side = trade.side; // LONG | SHORT
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco_original' };

  let effectiveSl = originalSl;
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'estourou_cutoff_seguranca' };

    // Simula o tick olhando high/low do candle (pior caso: checa SL antes de TP
    // dentro do candle pra não superestimar TP em candle de alta amplitude).
    const freshAtr = atr(candles, i, ATR_PERIOD);

    // Breakeven
    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * BREAKEVEN_TRIGGER_R) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }

    // Trailing ATR (só se a sessão real estava em modo DINAMICO nesse trade)
    if (useTrailing && freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * ATR_MULT;
      const refPrice = side === 'LONG' ? c.high : c.low; // trailing acompanha o extremo favorável do candle
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }

    const hitSlThisCandle = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const hitTpThisCandle = respectTpCeiling && originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);

    if (hitSlThisCandle && hitTpThisCandle) {
      // ambíguo dentro do candle: assume SL primeiro (conservador, mesma
      // convenção de "pior caso" usada nas outras rodadas de backtest do projeto)
      return { exitPrice: effectiveSl, exitTime: c.time, reason: 'SL', barsHeld: i - entryIdx + 1 };
    }
    if (hitSlThisCandle) {
      return { exitPrice: effectiveSl, exitTime: c.time, reason: 'SL', barsHeld: i - entryIdx + 1 };
    }
    if (hitTpThisCandle) {
      return { exitPrice: originalTp, exitTime: c.time, reason: 'TP', barsHeld: i - entryIdx + 1 };
    }
  }
  return { skipped: 'candles_acabaram_antes_de_fechar' };
}

function grossPnl(trade, exitPrice) {
  const entryPrice = parseFloat(trade.entry_price);
  const units = parseFloat(trade.quantity) / entryPrice; // schema: quantity = notional USD
  return trade.side === 'LONG' ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
}

const rows = [];
for (const trade of trades) {
  const candles = candlesBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;
  const mode = sessionsMode[trade.session_id];

  const real = {
    exitPrice: parseFloat(trade.exit_price),
    netPnl: parseFloat(trade.net_pnl),
    reason: trade.exit_reason,
  };

  const row = { id: trade.id, symbol: trade.symbol, side: trade.side, entry_time: trade.entry_time, session_id: trade.session_id, mode, real };

  if (!mode) {
    row.replicaA = { skipped: 'sessao_fora_do_mapeamento' };
    row.replicaB = { skipped: 'sessao_fora_do_mapeamento' };
    rows.push(row);
    continue;
  }

  const useTrailing = mode === 'DINAMICO';
  const replicaA = replay(trade, candles, { respectTpCeiling: true, useTrailing });
  // A hipótese (remover teto de TP) só faz sentido quando existe trailing
  // ativo protegendo o lucro — em modo FIXO não há rede de segurança nenhuma
  // além do stop original, então "deixar correr sem teto" seria um teste de
  // hipótese DIFERENTE (não é o que o achado de código motivou).
  const replicaB = useTrailing ? replay(trade, candles, { respectTpCeiling: false, useTrailing: true }) : { skipped: 'modo_fixo_hipotese_nao_aplicavel' };

  if (!replicaA.skipped) {
    const gp = grossPnl(trade, replicaA.exitPrice);
    row.replicaA = { ...replicaA, grossPnl: gp, netPnl: gp - commission };
  } else {
    row.replicaA = { skipped: replicaA.skipped };
  }

  if (!replicaB.skipped) {
    const gp = grossPnl(trade, replicaB.exitPrice);
    row.replicaB = { ...replicaB, grossPnl: gp, netPnl: gp - commission };
  } else {
    row.replicaB = { skipped: replicaB.skipped };
  }

  rows.push(row);
}

writeFileSync(join(RESULTS_DIR, 'replay_detail.json'), JSON.stringify(rows, null, 2));

// ---- Agregação ----
function summarize(rows, key) {
  const valid = rows.filter(r => r[key] && !r[key].skipped);
  const skipped = rows.length - valid.length;
  const netSum = valid.reduce((s, r) => s + r[key].netPnl, 0);
  const wins = valid.filter(r => r[key].netPnl > 0).length;
  return { n: valid.length, skipped, netSum, wins, winRate: valid.length ? wins / valid.length : null };
}

const realValid = rows.filter(r => Number.isFinite(r.real.netPnl));
const realSummary = {
  n: realValid.length,
  netSum: realValid.reduce((s, r) => s + r.real.netPnl, 0),
  wins: realValid.filter(r => r.real.netPnl > 0).length,
};
realSummary.winRate = realSummary.n ? realSummary.wins / realSummary.n : null;

const summaryA = summarize(rows, 'replicaA');
const summaryB = summarize(rows, 'replicaB');

// Só compara trades onde AMBAS as réplicas (A e B) resolveram com dado real
// disponível — comparação pareada, não dois universos diferentes.
const paired = rows.filter(r => r.replicaA && !r.replicaA.skipped && r.replicaB && !r.replicaB.skipped);
const pairedRealNet = paired.reduce((s, r) => s + r.real.netPnl, 0);
const pairedA = paired.reduce((s, r) => s + r.replicaA.netPnl, 0);
const pairedB = paired.reduce((s, r) => s + r.replicaB.netPnl, 0);
const deltaBvsA = pairedB - pairedA;
const betterInB = paired.filter(r => r.replicaB.netPnl > r.replicaA.netPnl).length;
const worseInB = paired.filter(r => r.replicaB.netPnl < r.replicaA.netPnl).length;
const equalInB = paired.length - betterInB - worseInB;

// outlier isolado (maior diferença absoluta B-A) removido, pra checar robustez
const sortedByDelta = [...paired].sort((a, b) => (b.replicaB.netPnl - b.replicaA.netPnl) - (a.replicaB.netPnl - a.replicaA.netPnl));
const topOutlier = sortedByDelta[0];
const pairedBExOutlier = paired.filter(r => r.id !== topOutlier?.id).reduce((s, r) => s + r.replicaB.netPnl, 0);
const pairedAExOutlier = paired.filter(r => r.id !== topOutlier?.id).reduce((s, r) => s + r.replicaA.netPnl, 0);

function realNetForMode(mode) {
  const subset = rows.filter(r => r.mode === mode && Number.isFinite(r.real.netPnl));
  return { n: subset.length, netSum: subset.reduce((s, r) => s + r.real.netPnl, 0) };
}

const summary = {
  total_trades_input: rows.length,
  skipped_sem_mapeamento_sessao: rows.filter(r => !r.mode).length,
  real: realSummary,
  real_por_modo: { FIXO: realNetForMode('FIXO'), DINAMICO: realNetForMode('DINAMICO') },
  replicaA_com_teto_tp: summaryA,
  replicaB_sem_teto_tp: summaryB,
  fidelidade_replicaA_vs_real_apenas_dinamico: (() => {
    const dinPaired = rows.filter(r => r.mode === 'DINAMICO' && r.replicaA && !r.replicaA.skipped);
    return {
      n: dinPaired.length,
      real_netSum: dinPaired.reduce((s, r) => s + r.real.netPnl, 0),
      replicaA_netSum: dinPaired.reduce((s, r) => s + r.replicaA.netPnl, 0),
    };
  })(),
  comparacao_pareada_A_vs_B: {
    n_pares: paired.length,
    net_real_desses_pares: pairedRealNet,
    net_replicaA: pairedA,
    net_replicaB: pairedB,
    delta_B_menos_A: deltaBvsA,
    trades_melhores_em_B: betterInB,
    trades_piores_em_B: worseInB,
    trades_iguais: equalInB,
    maior_outlier_delta: topOutlier ? { id: topOutlier.id, symbol: topOutlier.symbol, deltaA_B: topOutlier.replicaB.netPnl - topOutlier.replicaA.netPnl } : null,
    delta_excluindo_maior_outlier: pairedBExOutlier - pairedAExOutlier,
  },
};

writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
