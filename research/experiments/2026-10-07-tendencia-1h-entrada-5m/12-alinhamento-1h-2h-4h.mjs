// Metodo do Cleber (2026-10-07): "o grafico de 1H, 2H e 4H permite a compra (estocastico virado pra cima + MACD), o 5m so da o timing".
// Pergunta: entrar no 5m SO quando 1H, 2H e 4H estao alinhados melhora o resultado liquido? E com o contexto do dia (cansaco do mercado)?
// REGRAS FIXADAS ANTES DE RODAR:
//  - Gatilho 5m: %K cruza %D (estocastico lento 5,3,3) -- LONG pra cima, SHORT pra baixo. Entrada no fechamento da vela.
//  - "Alinhado a favor" num prazo (1H/2H/4H, so velas JA fechadas): LONG = %K > %D e %K < 80 e histograma MACD (12/26/9) subindo;
//    SHORT = espelho (%K < %D, %K > 20, histograma caindo).
//  - Variantes: A todos os gatilhos | B +1H | C +1H+2H | D +1H+2H+4H | E = D e dia contra (24h <= -1% p/ LONG, >= +1% p/ SHORT: "mercado cansado")
//    | F = D e estocastico 4H em zona extrema a favor (LONG: %K 4H < 25; SHORT: > 75).
//  - Saida: stop 2xATR14(5m), alvo 1,5R, timeout 4h a mercado, empate = stop, 1 trade por vez. Custo r/t: BTC 0,08%, ETH 0,11%, demais 0,15%.
//  - 2H e 4H agregadas das velas de 5m (blocos completos, alinhados a UTC). Uso: KLINE_CACHE_DIR=<pasta> node 12-alinhamento-1h-2h-4h.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const cacheDir = process.env.KLINE_CACHE_DIR || os.tmpdir();
const SYMS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "LINKUSDT"];
const COST = { BTCUSDT: 0.0008, ETHUSDT: 0.0011 }, HOLD = 48, TGT = 1.5;
const load = (s) => JSON.parse(fs.readFileSync(path.join(cacheDir, `kl_${s}_5m_${new Date().toISOString().slice(0, 10)}.json`), "utf8"));
const ema = (v, p) => { const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const sma = (v, n) => { const o = new Array(v.length).fill(NaN); let s = 0, bad = 0; for (let i = 0; i < v.length; i++) { if (Number.isNaN(v[i])) bad++; else s += v[i]; if (i >= n) { if (Number.isNaN(v[i - n])) bad--; else s -= v[i - n]; } if (i >= n - 1 && bad === 0) o[i] = s / n; } return o; };
function stoch(c) { const n = c.length, K0 = new Array(n).fill(NaN); for (let i = 4; i < n; i++) { let hh = -1e18, ll = 1e18; for (let t = i - 4; t <= i; t++) { if (c[t].h > hh) hh = c[t].h; if (c[t].l < ll) ll = c[t].l; } K0[i] = hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll); } const K = sma(K0, 3); return { K, D: sma(K, 3) }; }
function macdHist(c) { const cl = c.map((x) => x.c), e12 = ema(cl, 12), e26 = ema(cl, 26), m = e12.map((v, i) => v - e26[i]), s = ema(m, 9); return m.map((v, i) => v - s[i]); }
function agg(c, h) { const ms = h * 3600000, out = [], m = new Map(); for (const x of c) { const k = Math.floor(x.t / ms) * ms; let g = m.get(k); if (!g) { g = { t: k, o: x.o, h: x.h, l: x.l, c: x.c, n: 0 }; m.set(k, g); out.push(g); } g.h = Math.max(g.h, x.h); g.l = Math.min(g.l, x.l); g.c = x.c; g.n++; } return out.filter((g) => g.n === h * 12); }
function htf(c, h) { // para cada vela de 5m, indice da ultima barra HTF JA FECHADA + series
  const b = agg(c, h), st = stoch(b), hist = macdHist(b), ends = b.map((x) => x.t + h * 3600000);
  const idx = new Int32Array(c.length); let j = -1;
  for (let i = 0; i < c.length; i++) { const tClose = c[i].t + 300000; while (j + 1 < b.length && ends[j + 1] <= tClose) j++; idx[i] = j; }
  return { st, hist, idx };
}
const aligned = (H, i, side) => { const j = H.idx[i]; if (j < 40) return false; const k = H.st.K[j], d = H.st.D[j], h1 = H.hist[j], h0 = H.hist[j - 1]; if ([k, d, h1, h0].some(Number.isNaN)) return false; return side === 1 ? k > d && k < 80 && h1 > h0 : k < d && k > 20 && h1 < h0; };
function summarize(trs) { const n = trs.length; if (n < 30) return `n=${String(n).padStart(5)} (amostra insuficiente)`; const e = trs.reduce((s, x) => s + x.net, 0) / n, sd = Math.sqrt(trs.reduce((s, x) => s + (x.net - e) ** 2, 0) / (n - 1)); const by = [...new Set(trs.map((x) => x.y))].sort().map((y) => { const a = trs.filter((x) => x.y === y); return `${y}:${(a.reduce((s, x) => s + x.net, 0) / a.length).toFixed(2)}`; }).join(" "); return `n=${String(n).padStart(5)} acerto ${(100 * trs.filter((x) => x.net > 0).length / n).toFixed(1).padStart(4)}%  bruto ${(trs.reduce((s, x) => s + x.gross, 0) / n).toFixed(3).padStart(6)}  liq ${e.toFixed(3).padStart(6)}  t=${(e / (sd / Math.sqrt(n))).toFixed(1).padStart(5)} | ${by}`; }
const D = {};
for (const s of SYMS) {
  const c = load(s), n = c.length, S5 = stoch(c);
  const cl = c.map((x) => x.c), atr = new Array(n).fill(NaN); let a = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)) : c[i].h - c[i].l; a = i < 14 ? a + tr : (a * 13 + tr) / 14; atr[i] = i < 13 ? NaN : i === 13 ? a / 14 : a; }
  const H = { 1: htf(c, 1), 2: htf(c, 2), 4: htf(c, 4) };
  const ev = [];
  for (let i = 300; i < n - HOLD - 1; i++) { const k = S5.K[i], d = S5.D[i], kp = S5.K[i - 1], dp = S5.D[i - 1]; if ([k, d, kp, dp, atr[i]].some(Number.isNaN)) continue; const side = kp <= dp && k > d ? 1 : kp >= dp && k < d ? -1 : 0; if (!side) continue;
    const day = (cl[i] / cl[i - 288] - 1) * 100, a1 = aligned(H[1], i, side), a2 = aligned(H[2], i, side), a4 = aligned(H[4], i, side), k4 = H[4].st.K[H[4].idx[i]];
    ev.push({ i, side, a1, a2, a4, dayAgainst: side === 1 ? day <= -1 : day >= 1, ext4: side === 1 ? k4 < 25 : k4 > 75 }); }
  D[s] = { c, atr, ev };
}
const F = [["A todos os gatilhos 5m", () => true], ["B + 1H alinhado", (e) => e.a1], ["C + 1H e 2H", (e) => e.a1 && e.a2], ["D + 1H, 2H e 4H", (e) => e.a1 && e.a2 && e.a4], ["E = D e dia contra (mercado cansado)", (e) => e.a1 && e.a2 && e.a4 && e.dayAgainst], ["F = D e estocastico 4H em zona extrema", (e) => e.a1 && e.a2 && e.a4 && e.ext4]];
function run(s, f) { const { c, atr, ev } = D[s], trs = []; let free = 0; for (const e of ev) { if (e.i < free || !f(e)) continue; const i = e.i, entry = c[i].c, R = 2 * atr[i], stop = e.side === 1 ? entry - R : entry + R, tgt = e.side === 1 ? entry + TGT * R : entry - TGT * R; let res = null, exit = i; for (let q = i + 1; q <= i + HOLD; q++) { const hs = e.side === 1 ? c[q].l <= stop : c[q].h >= stop, ht = e.side === 1 ? c[q].h >= tgt : c[q].l <= tgt; if (hs) { res = -1; exit = q; break; } if (ht) { res = TGT; exit = q; break; } } if (res == null) { exit = i + HOLD; res = Math.max(-1, Math.min(TGT, (e.side === 1 ? c[exit].c - entry : entry - c[exit].c) / R)); } trs.push({ gross: res, net: res - ((COST[s] ?? 0.0015) * entry) / R, y: new Date(c[i].t).getUTCFullYear() }); free = exit + 1; } return trs; }
console.log(`alvo ${TGT}R, stop 2xATR5m. Empate antes do custo: ${(100 / (1 + TGT)).toFixed(0)}% de acerto.`);
for (const [title, list] of [["BTC + ETH", ["BTCUSDT", "ETHUSDT"]], ["os 6 ativos", SYMS]]) { console.log(`\n===== ${title} =====`); for (const [name, f] of F) { const trs = list.flatMap((s) => run(s, f)); console.log(name.padEnd(42), summarize(trs)); } }
console.log("\n===== so LONG e so SHORT (6 ativos), variante D =====");
for (const side of [1, -1]) { const trs = SYMS.flatMap((s) => { const sv = D[s].ev; D[s].ev = sv.filter((e) => e.side === side); const r = run(s, F[3][1]); D[s].ev = sv; return r; }); console.log((side === 1 ? "LONG " : "SHORT").padEnd(42), summarize(trs)); }
