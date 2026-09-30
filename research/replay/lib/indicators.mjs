// Indicadores com os MESMOS parametros do motor (llm-active-brain/src/atr.ts):
//   ATR 14 (Wilder) | Estocastico lento 5/3/3, 80/20 | MACD 12/26/9 | EMA9, SMA20, SMA200
//   trend 5m = variacao das ultimas 12 velas (1h), LATERAL se |x| < 0,15%
//   trendLongTerm = 24 velas de 1H, mesmo limiar | consenso = 5m e 1H concordando (computeMarketDirection)
// Diferenca conhecida: o motor calcula sobre as ultimas 60 velas; aqui a serie e continua
// (EMAs com aquecimento mais longo). Depois de ~60 velas a diferenca e desprezivel.

export function ema(values, p) {
  const k = 2 / (p + 1);
  const out = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    prev = prev == null ? values[i] : values[i] * k + prev * (1 - k);
    out[i] = i >= p - 1 ? prev : null;
  }
  return out;
}

export function sma(values, p) {
  const out = new Array(values.length).fill(null);
  let s = 0, n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) { s = 0; n = 0; continue; }
    s += v; n++;
    if (n > p) { s -= values[i - p]; n = p; }
    if (n === p) out[i] = s / p;
  }
  return out;
}

export function atr(c, p = 14) {
  const out = new Array(c.length).fill(null);
  let a = null, s = 0;
  for (let i = 0; i < c.length; i++) {
    const tr = i ? Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)) : c[i].h - c[i].l;
    if (i < p) { s += tr; if (i === p - 1) a = s / p; }
    else a = (a * (p - 1) + tr) / p;
    out[i] = i >= p - 1 ? a : null;
  }
  return out;
}

export function stochSlow(c, period = 5, kS = 3, dS = 3) {
  const fast = c.map((_, i) => {
    if (i < period - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let q = i - period + 1; q <= i; q++) { hh = Math.max(hh, c[q].h); ll = Math.min(ll, c[q].l); }
    return hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll);
  });
  const K = sma(fast, kS);
  const D = sma(K, dS);
  return { K, D, fast };
}

export function macd(c) {
  const closes = c.map((x) => x.c);
  const f = ema(closes, 12), s = ema(closes, 26);
  const line = closes.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
  const firstIdx = line.findIndex((x) => x != null);
  const sig = new Array(c.length).fill(null);
  if (firstIdx >= 0) {
    const e = ema(line.slice(firstIdx), 9);
    for (let i = 0; i < e.length; i++) sig[firstIdx + i] = e[i];
  }
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i] : null));
  return { line, sig, hist };
}

const FLAT = 0.15;
export function trendLabel(changePct) {
  if (changePct == null) return null;
  return Math.abs(changePct) < FLAT ? "LATERAL" : changePct > 0 ? "ALTA" : "BAIXA";
}

/** Indice da ultima vela FECHADA ate o instante t (vela [t0, t0+tf) fecha em t0+tf). */
export function lastClosedIdx(candles, tfMs, t) {
  let lo = 0, hi = candles.length - 1, r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (candles[m].t + tfMs <= t) { r = m; lo = m + 1; } else hi = m - 1;
  }
  return r;
}

/** Pre-calcula tudo que o motor manda pra LLM, por simbolo. */
export function buildContext(m5, h1) {
  const a = atr(m5), st = stochSlow(m5), md = macd(m5);
  const closes = m5.map((x) => x.c);
  const e9 = ema(closes, 9), s20 = sma(closes, 20), s200 = sma(closes, 200);
  const stH = stochSlow(h1);
  return { m5, h1, atr: a, st, md, e9, s20, s200, stH };
}

const GAP_TOL = 1.5; // aceita no maximo meio candle de folga entre velas consecutivas

/**
 * Snapshot no instante t (usa so velas fechadas -- sem look-ahead).
 * Retorna null se nao ha historico continuo suficiente.
 */
export function snapshot(ctx, t) {
  const { m5, h1 } = ctx;
  const i = lastClosedIdx(m5, 300_000, t);
  if (i < 30) return null;
  // exige as ultimas 13 velas contiguas (trend de 1h) e ultima vela recente
  if (t - (m5[i].t + 300_000) > 300_000 * GAP_TOL) return null;
  for (let q = i - 12; q < i; q++) if (m5[q + 1].t - m5[q].t > 300_000 * GAP_TOL) return null;
  const j = lastClosedIdx(h1, 3_600_000, t);
  const price = m5[i].c;
  const ch5 = ((m5[i].c - m5[i - 12].c) / m5[i - 12].c) * 100;
  const t5 = trendLabel(ch5);
  let t1 = null, ch1 = null;
  if (j >= 24) { ch1 = ((h1[j].c - h1[j - 24].c) / h1[j - 24].c) * 100; t1 = trendLabel(ch1); }
  const r5 = t5 === "ALTA" || t5 === "BAIXA" ? t5 : null;
  const r1 = t1 === "ALTA" || t1 === "BAIXA" ? t1 : null;
  let consensus;
  if (!r5 && !r1) consensus = "INDEFINIDO";
  else if (r5 === "ALTA" && r1 === "ALTA") consensus = "ALTA";
  else if (r5 === "BAIXA" && r1 === "BAIXA") consensus = "BAIXA";
  else consensus = "DIVERGENTE";
  const k = ctx.st.K[i], d = ctx.st.D[i], kp = ctx.st.K[i - 1], dp = ctx.st.D[i - 1];
  const stochLabel = k == null ? null : k >= 80 ? "SOBRECOMPRADO" : k <= 20 ? "SOBREVENDIDO" : "NEUTRO";
  const stochCross = k == null || kp == null ? null : kp <= dp && k > d ? "CIMA" : kp >= dp && k < d ? "BAIXO" : null;
  const h = ctx.md.hist;
  const macdTurning = h[i] == null || h[i - 1] == null ? null : h[i] > h[i - 1] ? "SUBINDO" : h[i] < h[i - 1] ? "CAINDO" : null;
  const atrPct = ctx.atr[i] != null ? ctx.atr[i] / price : null;
  return {
    i, j, t, price, atrPct,
    ch5, trend5: t5, ch1h: ch1, trend1h: t1, consensus,
    stochK: k, stochD: d, stochLabel, stochCross,
    stochHK: j >= 0 ? ctx.stH.K[j] : null,
    macdHist: h[i], macdTurning,
    ema9: ctx.e9[i], sma20: ctx.s20[i], sma200: ctx.s200[i],
  };
}
