/**
 * Backtest: TP parcial (50%) em +1R vs. produção atual (sem parcial).
 *
 * Motivação: reclamação do Cleber (2026-08-28) — trade que chegou a ~$5 de
 * lucro flutuante e devolveu mais da metade até fechar em $2,38. Acha do de
 * código: positionManager.ts hoje não realiza NENHUM lucro parcial fora de
 * pyramiding (que só se aplica a grupos com 2+ camadas). Breakeven já arma
 * em +1R (BREAKEVEN_TRIGGER_R, ver TradeFrictionControls.ts — valor validado
 * em research/experiments/2026-08-26-dynamic-exit-tp-ceiling/verdict.md,
 * Adendo 2+6). Ideia testada aqui: fechar 50% da posição no MESMO gatilho de
 * 1R que já arma o breakeven, deixando o resto correr com stop em breakeven.
 *
 * Reaproveita EXATAMENTE o mesmo dado real (candle 15m Binance, mesmos 166
 * trades e mapeamento de sessão) do experimento de 2026-08-26, pra manter
 * metodologia comparável ao número já publicado (+$3,24 líquido nos 110
 * trades DINAMICO pareados). Réplica A abaixo deve reproduzir esse número
 * como checagem de sanidade antes de confiar na réplica C (nova).
 *
 * MESMA RESSALVA do experimento original, não escondida: candle de 15m
 * favorece o backtest sobre o real de produção (tick de 1min) — os números
 * absolutos não devem ser lidos como "resultado real esperado", só a
 * comparação RELATIVA entre réplicas rodando o mesmo viés é válida.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data');
const RESULTS_DIR = join(HERE, '..', 'results');

const BREAKEVEN_TRIGGER_R = 1.0; // valor real em produção hoje (TradeFrictionControls.ts)
const ATR_PERIOD = 14;
const ATR_MULT = 2.0;
const MAX_HOLD_HOURS_CUTOFF = 30;
const PARTIAL_TP_TRIGGER_R = 1.0; // mesmo gatilho do breakeven — testado abaixo
const PARTIAL_TP_PERCENT = 0.5;

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
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time + 15 * 60_000 > entryTimeMs) return i;
  }
  return -1;
}

/**
 * Réplica com suporte a TP parcial opcional. `usePartialTp=false` reproduz
 * exatamente o `replay()` do experimento original (réplica A, produção
 * atual). `usePartialTp=true` fecha PARTIAL_TP_PERCENT da posição assim que
 * o candle toca o preço de +PARTIAL_TP_TRIGGER_R (réplica C).
 *
 * Ambiguidade dentro do mesmo candle (SL original E gatilho de parcial
 * tocados juntos): assume SL primeiro — mesma convenção conservadora do
 * experimento original, nunca super-otimista.
 */
function replay(trade, candles, { useTrailing, usePartialTp }) {
  const entryTimeMs = Date.parse(trade.entry_time);
  const entryIdx = findEntryIndex(candles, entryTimeMs);
  if (entryIdx < ATR_PERIOD || entryIdx === -1) return { skipped: 'sem_candle_entrada_ou_aquecimento_atr' };

  const side = trade.side;
  const entryPrice = parseFloat(trade.entry_price);
  const originalSl = parseFloat(trade.stop_loss);
  const originalTp = parseFloat(trade.take_profit);
  const originalRisk = Math.abs(entryPrice - originalSl);
  if (!(originalRisk > 0)) return { skipped: 'sem_risco_original' };

  const partialTriggerPrice = side === 'LONG'
    ? entryPrice + originalRisk * PARTIAL_TP_TRIGGER_R
    : entryPrice - originalRisk * PARTIAL_TP_TRIGGER_R;

  let effectiveSl = originalSl;
  let remainingFraction = 1.0;
  let partialFill = null; // { price, fraction }
  const cutoffTimeMs = entryTimeMs + MAX_HOLD_HOURS_CUTOFF * 3600_000;

  for (let i = entryIdx; i < candles.length; i++) {
    const c = candles[i];
    if (c.time > cutoffTimeMs) return { skipped: 'estourou_cutoff_seguranca' };

    const freshAtr = atr(candles, i, ATR_PERIOD);

    // SL original (antes do parcial ter disparado neste candle) — checado
    // primeiro pra decidir a ambiguidade "SL e gatilho no mesmo candle".
    const hitSlBeforeAnyMove = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;

    // TP parcial: dispara no primeiro toque do preço-gatilho, só uma vez.
    if (usePartialTp && !partialFill) {
      const touchedPartial = side === 'LONG' ? c.high >= partialTriggerPrice : c.low <= partialTriggerPrice;
      if (touchedPartial && !hitSlBeforeAnyMove) {
        partialFill = { price: partialTriggerPrice, fraction: PARTIAL_TP_PERCENT, time: c.time };
        remainingFraction = 1 - PARTIAL_TP_PERCENT;
      }
    }

    // Breakeven — arma no mesmo gatilho de 1R (independente do parcial, é o
    // comportamento real de produção; com parcial ligado os dois coincidem).
    const favorableHigh = side === 'LONG' ? c.high - entryPrice : entryPrice - c.low;
    if (favorableHigh >= originalRisk * BREAKEVEN_TRIGGER_R) {
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, entryPrice) : Math.min(effectiveSl, entryPrice);
    }

    if (useTrailing && freshAtr && freshAtr > 0) {
      const trailDistance = freshAtr * ATR_MULT;
      const refPrice = side === 'LONG' ? c.high : c.low;
      const trailedSl = side === 'LONG' ? refPrice - trailDistance : refPrice + trailDistance;
      effectiveSl = side === 'LONG' ? Math.max(effectiveSl, trailedSl) : Math.min(effectiveSl, trailedSl);
    }

    const hitSlThisCandle = side === 'LONG' ? c.low <= effectiveSl : c.high >= effectiveSl;
    const hitTpThisCandle = originalTp > 0 && (side === 'LONG' ? c.high >= originalTp : c.low <= originalTp);

    if (hitSlThisCandle || hitTpThisCandle) {
      const reason = hitSlThisCandle ? 'SL' : 'TP';
      const exitPrice = hitSlThisCandle ? effectiveSl : originalTp;
      return { exitPrice, exitTime: c.time, reason, barsHeld: i - entryIdx + 1, partialFill, remainingFraction };
    }
  }
  return { skipped: 'candles_acabaram_antes_de_fechar', partialFill, remainingFraction };
}

function grossPnlFraction(trade, price, fraction) {
  const entryPrice = parseFloat(trade.entry_price);
  const units = (parseFloat(trade.quantity) * fraction) / entryPrice;
  return trade.side === 'LONG' ? (price - entryPrice) * units : (entryPrice - price) * units;
}

const rows = [];
for (const trade of trades) {
  const candles = candlesBySymbol[trade.symbol];
  const commission = parseFloat(trade.commission) || 0;
  const mode = sessionsMode[trade.session_id];

  const real = { exitPrice: parseFloat(trade.exit_price), netPnl: parseFloat(trade.net_pnl), reason: trade.exit_reason };
  const row = { id: trade.id, symbol: trade.symbol, side: trade.side, entry_time: trade.entry_time, session_id: trade.session_id, mode, real };

  if (!mode) {
    row.replicaA = { skipped: 'sessao_fora_do_mapeamento' };
    row.replicaC = { skipped: 'sessao_fora_do_mapeamento' };
    rows.push(row);
    continue;
  }

  const useTrailing = mode === 'DINAMICO';

  const rA = replay(trade, candles, { useTrailing, usePartialTp: false });
  const rC = replay(trade, candles, { useTrailing, usePartialTp: true });

  if (!rA.skipped) {
    const gp = grossPnlFraction(trade, rA.exitPrice, 1.0);
    row.replicaA = { ...rA, grossPnl: gp, netPnl: gp - commission };
  } else {
    row.replicaA = { skipped: rA.skipped };
  }

  if (!rC.skipped) {
    let gp, costEstimate;
    if (rC.partialFill) {
      // Duas pernas: fração parcial fechada no gatilho + fração restante no
      // exit final. Custo: aproximação — mesma comissão total do trade real
      // (round-trip proporcional ao notional, soma das duas pernas ≈ igual
      // ao round-trip do trade inteiro; não temos ExecutionCost.ts em JS
      // puro aqui, aproximação documentada, mesma usada no proxy anterior).
      const gpPartial = grossPnlFraction(trade, rC.partialFill.price, rC.partialFill.fraction);
      const gpRemainder = grossPnlFraction(trade, rC.exitPrice, rC.remainingFraction);
      gp = gpPartial + gpRemainder;
      costEstimate = commission;
    } else {
      gp = grossPnlFraction(trade, rC.exitPrice, 1.0);
      costEstimate = commission;
    }
    row.replicaC = { ...rC, grossPnl: gp, netPnl: gp - costEstimate, partialFired: !!rC.partialFill };
  } else {
    row.replicaC = { skipped: rC.skipped };
  }

  rows.push(row);
}

writeFileSync(join(RESULTS_DIR, 'replay_detail.json'), JSON.stringify(rows, null, 2));

function summarize(rows, key) {
  const valid = rows.filter(r => r[key] && !r[key].skipped);
  const skipped = rows.length - valid.length;
  const netSum = valid.reduce((s, r) => s + r[key].netPnl, 0);
  const wins = valid.filter(r => r[key].netPnl > 0).length;
  return { n: valid.length, skipped, netSum, wins, winRate: valid.length ? wins / valid.length : null };
}

const paired = rows.filter(r => r.replicaA && !r.replicaA.skipped && r.replicaC && !r.replicaC.skipped);
const pairedA = paired.reduce((s, r) => s + r.replicaA.netPnl, 0);
const pairedC = paired.reduce((s, r) => s + r.replicaC.netPnl, 0);
const deltaCvsA = pairedC - pairedA;
const betterInC = paired.filter(r => r.replicaC.netPnl > r.replicaA.netPnl).length;
const worseInC = paired.filter(r => r.replicaC.netPnl < r.replicaA.netPnl).length;
const equalInC = paired.length - betterInC - worseInC;
const partialFiredCount = paired.filter(r => r.replicaC.partialFired).length;

const sortedByDelta = [...paired].sort((a, b) => (b.replicaC.netPnl - b.replicaA.netPnl) - (a.replicaC.netPnl - a.replicaA.netPnl));
const topOutlier = sortedByDelta[0];
const worstOutlier = sortedByDelta[sortedByDelta.length - 1];

const summary = {
  total_trades_input: rows.length,
  skipped_sem_mapeamento_sessao: rows.filter(r => !r.mode).length,
  replicaA_producao_atual: summarize(rows, 'replicaA'),
  replicaC_com_parcial_1R: summarize(rows, 'replicaC'),
  comparacao_pareada_A_vs_C: {
    n_pares: paired.length,
    trades_com_parcial_disparado: partialFiredCount,
    net_replicaA: pairedA,
    net_replicaC: pairedC,
    delta_C_menos_A: deltaCvsA,
    trades_melhores_em_C: betterInC,
    trades_piores_em_C: worseInC,
    trades_iguais: equalInC,
    maior_melhora: topOutlier ? { id: topOutlier.id, symbol: topOutlier.symbol, delta: topOutlier.replicaC.netPnl - topOutlier.replicaA.netPnl } : null,
    maior_piora: worstOutlier ? { id: worstOutlier.id, symbol: worstOutlier.symbol, delta: worstOutlier.replicaC.netPnl - worstOutlier.replicaA.netPnl } : null,
  },
  checagem_sanidade_replicaA_vs_experimento_2026_08_26: 'esperado ~+3.24 nos pares DINAMICO válidos (mesma metodologia, mesmo dado) — ver campo abaixo',
  replicaA_apenas_dinamico: (() => {
    const din = rows.filter(r => r.mode === 'DINAMICO' && r.replicaA && !r.replicaA.skipped);
    return { n: din.length, netSum: din.reduce((s, r) => s + r.replicaA.netPnl, 0) };
  })(),
};

writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
