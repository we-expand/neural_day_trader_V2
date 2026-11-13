// Simulador de uma posicao com as MESMAS regras de saida do motor (dia util):
//   stop  = ATR%(5m,14) x 2.0, se fora de [0,3%, 2%] vira o fallback 0,5%; alargado p/ >= spread x 1.5
//           (tools.ts ~2321)          | fim de semana: ATR x 0.95, piso 0,2%
//   alvo  = ATR% x 2.0 x 1.5 (targetPoints POUCOS) -- ou stop x 1.5 no fallback | fim de semana: stop x 2
//   parcial 40% em +1R | breakeven em +0,35R | trailing apos BE: ATR x 1.6 (x 2.2 depois de +1R)
//   (neuralBridge.ts ~1310, .env MT5_TRAIL_ATR_MULTIPLIER=1.6, MT5_BREAKEVEN_TRIGGER_R=0.35)
// Simplificacoes (declaradas):
//   - Os encolhimentos de alvo/stop por suporte-resistencia, maxima/minima 24h e range ESTREITO NAO
//     sao simulados (alvo aqui tende a ficar MAIOR que o real).
//   - Vela a vela: dentro da mesma vela, o stop e checado ANTES do alvo (conservador); ajustes de
//     stop (BE/trailing) feitos com a maxima/minima da vela so valem a partir da vela seguinte.
//   - Entrada no OPEN da proxima vela de 5m apos a decisao; custo = spread medido 1x (ida+volta).
//   - Timeout de 24h (fecha no close).

export const COST_PCT = {
  // spread medido: mediana do spreadPct de get_mt5_quote no llm-brain.log (set/2026);
  // BTCUSD usa o proxy BTCEUR da Infinox (0,068%, COST_SOURCE_OF_TRUTH.md) porque o feed roteado pra Binance da ~0.
  BTCUSD: 0.068, XETUSD: 0.097, LNKUSD: 0.586, NAS100: 0.003, SPX500: 0.0057, UKOUSD: 0.112, XAGUSD: 0.035,
};

export const ENGINE = {
  stopAtr: 2.0, stopMin: 0.003, stopMax: 0.02, stopFallback: 0.005, spreadSafety: 1.5,
  targetRefAtr: 2.0, rr: 1.5,
  weekendStopAtr: 0.95, weekendStopMin: 0.002, weekendRR: 2.0,
  partialR: 1.0, partialFrac: 0.4,
  beR: 0.35,
  trailAtr: 1.6, trailWideAtr: 2.2, trailWideR: 1.0,
  timeoutMs: 24 * 3_600_000,
};

export function isWeekendMode(ms) {
  const d = new Date(ms), day = d.getUTCDay(), min = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (day === 6) return true;
  if (day === 0) return min < 22 * 60;
  if (day === 5) return min >= 20 * 60;
  return false;
}

/** Stop e alvo (fracoes do preco) como o motor calcularia. */
export function stopAndTarget(atrPct, spreadPct, t, p = ENGINE) {
  const wk = isWeekendMode(t);
  const mult = wk ? p.weekendStopAtr : p.stopAtr;
  const min = wk ? p.weekendStopMin : p.stopMin;
  let stop = atrPct == null ? null : atrPct * mult;
  if (stop != null && (stop < min || stop > p.stopMax)) stop = null;
  let fallback = stop == null;
  if (stop == null) stop = p.stopFallback;
  const minForSpread = (spreadPct / 100) * p.spreadSafety;
  if (minForSpread > stop) {
    if (minForSpread > p.stopMax) return null; // motor recusa a entrada
    stop = minForSpread; fallback = true;
  }
  let tp;
  if (p.fixedTpR != null) tp = stop * p.fixedTpR;
  else if (wk) tp = stop * p.weekendRR;
  else tp = (fallback ? stop : atrPct * p.targetRefAtr) * p.rr;
  return { stop, tp, weekend: wk };
}

/**
 * Simula a partir do instante de decisao tMs. Retorna null se nao ha dado continuo.
 * r = resultado liquido em multiplos do risco inicial (R), ja descontado o spread.
 */
export function simulate(ctx, tMs, side, spreadPct, p = ENGINE) {
  const { m5, atr } = ctx;
  // primeira vela que abre em/apos tMs
  let lo = 0, hi = m5.length - 1, e = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (m5[m].t >= tMs) { e = m; hi = m - 1; } else lo = m + 1; }
  if (e < 15 || m5[e].t - tMs > 300_000 * 1.5) return null;
  // p.atrPctAt(tMs): horizonte alternativo (ex.: ATR de 1H) -- stop, alvo e trailing passam a usar esse ATR fixo
  const fixedAtrPct = p.atrPctAt ? p.atrPctAt(tMs) : null;
  if (p.atrPctAt && fixedAtrPct == null) return null;
  const atrPct = fixedAtrPct ?? (atr[e - 1] != null ? atr[e - 1] / m5[e - 1].c : null);
  const st = stopAndTarget(atrPct, spreadPct, tMs, p);
  if (!st) return { skipped: "spread" };
  const entry = m5[e].o;
  const dir = side === "LONG" ? 1 : -1;
  const R = entry * st.stop;
  let stop = entry - dir * R;
  const tgt = entry + dir * entry * st.tp;
  let partial = false, realized = 0, remaining = 1, mfe = 0;
  const endT = m5[e].t + p.timeoutMs;
  let exitR = null, reason = null, k = e;
  for (; k < m5.length && m5[k].t < endT; k++) {
    if (k > e && m5[k].t - m5[k - 1].t > 300_000 * 1.5) return null; // buraco no caminho: nao da pra saber
    const c = m5[k];
    const adverse = side === "LONG" ? c.l : c.h;
    const favor = side === "LONG" ? c.h : c.l;
    if ((adverse - stop) * dir <= 0) { exitR = ((stop - entry) * dir) / R; reason = stop === entry - dir * R ? "SL" : "SL_protegido"; break; }
    if ((favor - tgt) * dir >= 0) {
      exitR = ((tgt - entry) * dir) / R; reason = "TP";
      if (p.partialR != null && !partial && exitR >= p.partialR) { partial = true; realized += p.partialFrac * p.partialR; remaining = 1 - p.partialFrac; }
      break;
    }
    const favR = ((favor - entry) * dir) / R;
    mfe = Math.max(mfe, favR);
    if (p.partialR != null && !partial && favR >= p.partialR) {
      partial = true; realized += p.partialFrac * p.partialR; remaining = 1 - p.partialFrac;
    }
    const atBE = (stop - entry) * dir >= 0;
    if (!atBE) {
      if (p.beR != null && favR >= p.beR) stop = entry;
    } else if (p.trailAtr != null) {
      const aPct = fixedAtrPct ?? (atr[k] != null ? atr[k] / c.c : null);
      if (aPct != null) {
        const mult = favR >= p.trailWideR ? p.trailWideAtr : p.trailAtr;
        const cand = favor * (1 - dir * aPct * mult);
        if ((cand - stop) * dir > 0) stop = cand;
      }
    }
  }
  if (exitR == null) {
    if (k >= m5.length) return null; // dado acabou antes de resolver
    const last = m5[k - 1];
    exitR = ((last.c - entry) * dir) / R; reason = "TIMEOUT";
  }
  const costR = (spreadPct / 100) / st.stop;
  const r = realized + remaining * exitR - costR;
  return { r, grossR: realized + remaining * exitR, costR, reason, mfeR: mfe, stopPct: st.stop, tpPct: st.tp, bars: k - e + 1, partial };
}
