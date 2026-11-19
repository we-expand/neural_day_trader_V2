import fs from "node:fs";
type C = { timestamp: number; open: number; high: number; low: number; close: number };
const sym = process.argv[2] || "BTCUSDT"; const CACHE = process.env.CACHE_DIR!;
const f5 = sym.endsWith("USDT") ? `${CACHE}/ob_${sym}_5m.json` : `${CACHE}/mt5_${sym}_5m.json`;
const m: C[] = JSON.parse(fs.readFileSync(f5, "utf8")).map((c: any) => ({ timestamp: c.timestamp ?? c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
const MS5 = 300000, STEP = 12, H = 36, SK = 1.5, TARGETS = [0.75, 1.5, 3];
// ---- agregacao 15m / 1H alinhada a epoch ----
function agg(ms: number): C[] { const out: C[] = []; let cur: C | null = null, bucket = -1;
  for (const c of m) { const b = Math.floor(c.timestamp / ms); if (b !== bucket) { if (cur) out.push(cur); cur = { timestamp: b * ms, open: c.open, high: c.high, low: c.low, close: c.close }; bucket = b; } else { cur!.high = Math.max(cur!.high, c.high); cur!.low = Math.min(cur!.low, c.low); cur!.close = c.close; } }
  if (cur) out.push(cur); return out; }
function stoch(b: C[]): { K: (number | null)[]; D: (number | null)[] } {
  const raw = b.map((_, i) => { if (i < 4) return null; let hh = -1e18, ll = 1e18; for (let q = i - 4; q <= i; q++) { hh = Math.max(hh, b[q].high); ll = Math.min(ll, b[q].low); } return hh === ll ? 50 : 100 * (b[i].close - ll) / (hh - ll); });
  const sma = (a: (number | null)[]) => a.map((_, i) => { const w = a.slice(i - 2, i + 1); return i < 2 || w.some((x) => x == null) ? null : w.reduce((s, x) => s + (x as number), 0) / 3; });
  const K = sma(raw); return { K, D: sma(K) }; }
const b15 = agg(900000), b60 = agg(3600000), s5 = stoch(m), s15 = stoch(b15), s60 = stoch(b60);
// indice do ultimo candle agregado FECHADO no instante do fechamento do 5m i
function lastClosed(b: C[], ms: number, t: number) { let lo = 0, hi = b.length - 1, r = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (b[mid].timestamp + ms <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; } return r; }
// ATR14 5m
const atr: number[] = []; { let s = 0; for (let i = 0; i < m.length; i++) { const tr = i ? Math.max(m[i].high - m[i].low, Math.abs(m[i].high - m[i - 1].close), Math.abs(m[i].low - m[i - 1].close)) : m[i].high - m[i].low; s = i < 14 ? s + tr : (s * 13 + tr) / 14; atr.push(i < 13 ? NaN : i === 13 ? s / 14 : s); } }
// faixa diaria (UTC)
const day = (t: number) => Math.floor(t / 86400000); const dRange = new Map<number, { h: number; l: number }>();
for (const c of m) { const d = day(c.timestamp); const r = dRange.get(d); if (!r) dRange.set(d, { h: c.high, l: c.low }); else { r.h = Math.max(r.h, c.high); r.l = Math.min(r.l, c.low); } }
const days = [...dRange.keys()].sort((a, b) => a - b);
const avgRange20 = (d: number) => { const idx = days.indexOf(d); if (idx < 10) return NaN; const prev = days.slice(Math.max(0, idx - 20), idx); return prev.reduce((s, k) => s + (dRange.get(k)!.h - dRange.get(k)!.l), 0) / prev.length; };
const avgCache = new Map<number, number>(); const getAvg = (d: number) => { if (!avgCache.has(d)) avgCache.set(d, avgRange20(d)); return avgCache.get(d)!; };
// maxima/minima do dia ATE o candle i (causal)
let curDay = -1, dh = 0, dl = 0; const dayH: number[] = [], dayL: number[] = [];
for (const c of m) { const d = day(c.timestamp); if (d !== curDay) { curDay = d; dh = c.high; dl = c.low; } else { dh = Math.max(dh, c.high); dl = Math.min(dl, c.low); } dayH.push(dh); dayL.push(dl); }
// ---- amostras ----
type S = { y: number; x1: number[]; x2: number[]; t: number; side: number; X: number };
const samples: S[] = []; let timeouts = 0, total = 0;
for (let i = 400; i < m.length - H - 1; i += STEP) {
  const a = atr[i]; if (!(a > 0)) continue; const c = m[i], d = day(c.timestamp), avg = getAvg(d); if (!(avg > 0)) continue;
  const j15 = lastClosed(b15, 900000, c.timestamp + MS5), j60 = lastClosed(b60, 3600000, c.timestamp + MS5);
  if (j15 < 12 || j60 < 12) continue; const k5 = s5.K[i], k15 = s15.K[j15], k60 = s60.K[j60], k15p = s15.K[j15 - 3], d15 = s15.D[j15];
  if ([k5, k15, k60, k15p, d15].some((v) => v == null)) continue;
  // idade da perna no 15m: candles desde o ultimo cruzamento K/D (cap 20)
  let age = 0; for (let q = j15; q > j15 - 20 && q > 0; q--) { const kk = s15.K[q], dd = s15.D[q], kp = s15.K[q - 1], dp = s15.D[q - 1]; if (kk == null || dd == null || kp == null || dp == null) break; if ((kp - dp) * (kk - dd) < 0) { age = j15 - q + 1; break; } age = 20; }
  const hr = new Date(c.timestamp).getUTCHours(), range = dayH[i] - dayL[i];
  for (const side of [1, -1]) { // +1 long, -1 short
    const room = side === 1 ? (dayH[i] - c.close) / a : (c.close - dayL[i]) / a; // espaco ate o extremo do dia no sentido do trade
    const o = (v: number) => (side === -1 ? v : 100 - v); // alto = esticado contra o lado => espaco a favor
    const slope = side === -1 ? -((k15 as number) - (k15p as number)) : ((k15 as number) - (k15p as number));
    const x1 = [range / avg, room, Math.log(a / c.close * 100), Math.sin(2 * Math.PI * hr / 24), Math.cos(2 * Math.PI * hr / 24)];
    const x2 = [o(k5 as number) / 100, o(k15 as number) / 100, o(k60 as number) / 100, slope / 100, age / 20];
    for (const X of TARGETS) {
      total++; let res = -1;
      for (let q = i + 1; q <= i + H; q++) { const fav = side === 1 ? m[q].high >= c.close + X * a : m[q].low <= c.close - X * a; const adv = side === 1 ? m[q].low <= c.close - SK * a : m[q].high >= c.close + SK * a; if (adv) { res = 0; break; } if (fav) { res = 1; break; } }
      if (res < 0) { timeouts++; continue; } samples.push({ y: res, x1, x2, t: c.timestamp, side, X });
    }
  }
}
console.log(`${sym}: amostras resolvidas ${samples.length}, timeouts ${(100 * timeouts / total).toFixed(1)}%`);
// ---- logistica ----
function fit(X: number[][], y: number[], iters = 600, lr = 0.2, l2 = 1e-3) { const n = X.length, p = X[0].length; const mu = Array(p).fill(0), sd = Array(p).fill(0);
  for (let j = 0; j < p; j++) { mu[j] = X.reduce((s, r) => s + r[j], 0) / n; sd[j] = Math.sqrt(X.reduce((s, r) => s + (r[j] - mu[j]) ** 2, 0) / n) || 1; }
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j])); const w = Array(p).fill(0); let b = 0;
  for (let it = 0; it < iters; it++) { const gw = Array(p).fill(0); let gb = 0; for (let i = 0; i < n; i++) { let z = b; for (let j = 0; j < p; j++) z += w[j] * Z[i][j]; const e = 1 / (1 + Math.exp(-z)) - y[i]; for (let j = 0; j < p; j++) gw[j] += e * Z[i][j]; gb += e; } for (let j = 0; j < p; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]); b -= lr * gb / n; }
  return (r: number[]) => { let z = b; for (let j = 0; j < p; j++) z += w[j] * (r[j] - mu[j]) / sd[j]; return 1 / (1 + Math.exp(-z)); }; }
const auc = (p: number[], y: number[]) => { const idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]); let rk = 0, sPos = 0, nPos = 0; idx.forEach((id, r) => { if (y[id] === 1) { sPos += r + 1; nPos++; } }); const nNeg = y.length - nPos; return (sPos - nPos * (nPos + 1) / 2) / (nPos * nNeg); };
const tmin = samples[0].t, tmax = samples[samples.length - 1].t, tcut = tmin + (tmax - tmin) / 2;
for (const X of TARGETS) {
  const all = samples.filter((s) => s.X === X), tr = all.filter((s) => s.t < tcut), te = all.filter((s) => s.t >= tcut); if (tr.length < 200 || te.length < 200) { console.log("X", X, "amostra pequena", tr.length, te.length); continue; }
  const side = (s: S) => [s.side];
  const m1 = fit(tr.map((s) => [...s.x1, s.side]), tr.map((s) => s.y)), m2 = fit(tr.map((s) => [...s.x1, ...s.x2, s.side]), tr.map((s) => s.y));
  const p0 = SK / (SK + X); const yte = te.map((s) => s.y);
  const pr0 = te.map(() => p0), pr1 = te.map((s) => m1([...s.x1, s.side])), pr2 = te.map((s) => m2([...s.x1, ...s.x2, s.side]));
  const br = (p: number[]) => p.map((v, i) => (v - yte[i]) ** 2);
  const b0 = br(pr0), b1 = br(pr1), b2 = br(pr2); const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const week = te.map((s) => Math.floor(s.t / 604800000)); const wk = [...new Set(week)];
  const ci = (b: number[]) => { const d = b0.map((v, i) => v - b[i]); const byW = new Map<number, number[]>(); d.forEach((v, i) => { (byW.get(week[i]) ?? byW.set(week[i], []).get(week[i])!).push(v); });
    const boots: number[] = []; for (let r = 0; r < 400; r++) { let s = 0, n = 0; for (let k = 0; k < wk.length; k++) { const arr = byW.get(wk[Math.floor(Math.random() * wk.length)])!; s += arr.reduce((a, v) => a + v, 0); n += arr.length; } boots.push(s / n); } boots.sort((a, b) => a - b); return [mean(d), boots[10], boots[389]]; };
  const c1 = ci(b1), c2 = ci(b2);
  console.log(`X=${X}ATR  P(base)=${p0.toFixed(3)} taxa real teste=${mean(yte).toFixed(3)} n=${te.length} | Brier M0 ${mean(b0).toFixed(4)} M1 ${mean(b1).toFixed(4)} M2 ${mean(b2).toFixed(4)} | ganho M1 ${(c1[0] * 1e4).toFixed(1)}e-4 [${(c1[1] * 1e4).toFixed(1)},${(c1[2] * 1e4).toFixed(1)}] AUC ${auc(pr1, yte).toFixed(3)} | ganho M2 ${(c2[0] * 1e4).toFixed(1)}e-4 [${(c2[1] * 1e4).toFixed(1)},${(c2[2] * 1e4).toFixed(1)}] AUC ${auc(pr2, yte).toFixed(3)}`);
}
// ---- Parte B: pernas ----
function legs(bars: C[], st: { K: (number | null)[]; D: (number | null)[] }, name: string) {
  const dur: number[] = []; let started = 0, bottom = 0, turned = 0, cens = 0; const alive: number[][] = [[], [], [], []]; const lens = [2, 4, 6, 8];
  const run = (dir: number) => { for (let i = 6; i < bars.length - 62; i++) { const k = st.K[i], d = st.D[i], kp = st.K[i - 1], dp = st.D[i - 1]; if (k == null || d == null || kp == null || dp == null) continue;
    const start = dir === -1 ? kp >= dp && k < d && kp >= 80 : kp <= dp && k > d && kp <= 20; if (!start) continue; started++;
    let end = -1, kind = "c"; for (let q = i + 1; q <= i + 60; q++) { const kq = st.K[q], dq = st.D[q]; if (kq == null || dq == null) break; if (dir === -1 ? kq <= 20 : kq >= 80) { end = q; kind = "b"; break; } if (dir === -1 ? kq > dq : kq < dq) { end = q; kind = "t"; break; } }
    if (kind === "b") { bottom++; dur.push(end - i); } else if (kind === "t") turned++; else cens++;
    lens.forEach((t, ix) => { if (end === -1 || end - i > t) { const surv = end === -1 || end - i > t; if (surv) { const reach = kind === "b" && end - i <= t + 4; alive[ix].push(reach ? 1 : 0); } } }); } };
  run(-1); run(1); dur.sort((a, b) => a - b); const q = (p: number) => dur[Math.floor(p * (dur.length - 1))];
  console.log(`[${name}] pernas ${started}: chegam ao fundo ${(100 * bottom / started).toFixed(0)}%, revertem antes ${(100 * turned / started).toFixed(0)}%, censuradas ${(100 * cens / started).toFixed(0)}% | duracao (candles) p10 ${q(.1)} p25 ${q(.25)} mediana ${q(.5)} p75 ${q(.75)} p90 ${q(.9)}`);
  console.log(`   P(chegar ao fundo em +4 candles | perna segue viva apos t): ` + lens.map((t, ix) => `t=${t}: ${(100 * alive[ix].reduce((a, v) => a + v, 0) / Math.max(1, alive[ix].length)).toFixed(0)}% (n${alive[ix].length})`).join("  ")); }
legs(m, s5, "5m"); legs(b15, s15, "15m");
