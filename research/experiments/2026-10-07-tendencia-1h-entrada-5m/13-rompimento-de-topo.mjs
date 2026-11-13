// Rompimento de topo (Cleber, 2026-10-08): "fechamento do candle acima do topo; pressao de mercado e volatilidade condizentes; MACD e estocastico ajudando;
// quanto mais validacoes melhor; aproveitar praticamente todos os rompimentos do dia". Pergunta: mais validacoes separam rompimentos que seguem dos que falham?
// REGRAS FIXADAS ANTES DE RODAR:
//  - Topo = maxima das 48 velas de 5m anteriores (4h). Rompimento LONG = PRIMEIRO fechamento acima desse topo (vela anterior fechou <= topo). SHORT = espelho (fundo de 4h).
//  - Validacoes (0/1 cada): V1 volume da vela >= 1,5x a media das 20 anteriores; V2 histograma MACD(12/26/9) a favor e crescendo (LONG: >0 e subindo; SHORT: <0 e caindo);
//    V3 estocastico lento 5,3,3 a favor (LONG: %K>%D e %K<=80; SHORT: %K<%D e %K>=20); V4 vela impulsiva: amplitude >= 1,0 x ATR14.
//  - Saida: stop = 1,5 x ATR14(5m) (stop mais curto, como o Cleber), alvo 1,5R (e 3R), timeout 4h a mercado, empate = stop. 1 trade por vez por ativo.
//  - Custo r/t: BTC 0,08%, ETH 0,11%, demais 0,15%. Dados: Binance 5m com volume, 2 anos, 6 ativos.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const cacheDir = process.env.KLINE_CACHE_DIR || os.tmpdir();
const SYMS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "LINKUSDT"], COST = { BTCUSDT: 0.0008, ETHUSDT: 0.0011 }, HOLD = 48, LB = 48;
async function kl(sym) {
  const f = path.join(cacheDir, `kv_${sym}_5m_${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  let out = [], cur = Date.now() - 2 * 365 * 864e5;
  while (true) { let j = null; for (const host of ["https://api.binance.com", "https://data-api.binance.vision"]) { try { const r = await fetch(`${host}/api/v3/klines?symbol=${sym}&interval=5m&limit=1000&startTime=${cur}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) { j = await r.json(); break; } } catch {} } if (!Array.isArray(j) || !j.length) break; out = out.concat(j.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))); cur = j[j.length - 1][0] + 1; if (j.length < 1000) break; }
  fs.writeFileSync(f, JSON.stringify(out)); return out;
}
const ema = (v, p) => { const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const sma = (v, n) => { const o = new Array(v.length).fill(NaN); let s = 0, bad = 0; for (let i = 0; i < v.length; i++) { if (Number.isNaN(v[i])) bad++; else s += v[i]; if (i >= n) { if (Number.isNaN(v[i - n])) bad--; else s -= v[i - n]; } if (i >= n - 1 && bad === 0) o[i] = s / n; } return o; };
function summarize(trs) { const n = trs.length; if (n < 30) return `n=${String(n).padStart(5)} (amostra insuficiente)`; const e = trs.reduce((s, x) => s + x.net, 0) / n, sd = Math.sqrt(trs.reduce((s, x) => s + (x.net - e) ** 2, 0) / (n - 1)); const by = [...new Set(trs.map((x) => x.y))].sort().map((y) => { const a = trs.filter((x) => x.y === y); return `${y}:${(a.reduce((s, x) => s + x.net, 0) / a.length).toFixed(2)}`; }).join(" "); return `n=${String(n).padStart(5)} acerto ${(100 * trs.filter((x) => x.net > 0).length / n).toFixed(1).padStart(4)}%  bruto ${(trs.reduce((s, x) => s + x.gross, 0) / n).toFixed(3).padStart(6)}  liq ${e.toFixed(3).padStart(6)}  t=${(e / (sd / Math.sqrt(n))).toFixed(1).padStart(5)} | ${by}`; }
const D = {};
for (const s of SYMS) {
  process.stderr.write(`carregando ${s}... `); const c = await kl(s), n = c.length;
  const cl = c.map((x) => x.c), e12 = ema(cl, 12), e26 = ema(cl, 26), m = e12.map((v, i) => v - e26[i]), sg = ema(m, 9), hist = m.map((v, i) => v - sg[i]);
  const K0 = new Array(n).fill(NaN); for (let i = 4; i < n; i++) { let hh = -1e18, ll = 1e18; for (let t = i - 4; t <= i; t++) { if (c[t].h > hh) hh = c[t].h; if (c[t].l < ll) ll = c[t].l; } K0[i] = hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll); }
  const K = sma(K0, 3), Dd = sma(K, 3), vs = sma(c.map((x) => x.v), 20);
  const atr = new Array(n).fill(NaN); let a = 0; for (let i = 0; i < n; i++) { const tr = i ? Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)) : c[i].h - c[i].l; a = i < 14 ? a + tr : (a * 13 + tr) / 14; atr[i] = i < 13 ? NaN : i === 13 ? a / 14 : a; }
  const ev = []; let hi = [], lo = []; // maxima/minima moveis de 48 velas anteriores (O(n) com varredura simples)
  for (let i = LB + 1; i < n - HOLD - 1; i++) {
    let top = -1e18, bot = 1e18; for (let t = i - LB; t < i; t++) { if (c[t].h > top) top = c[t].h; if (c[t].l < bot) bot = c[t].l; }
    let topP = -1e18, botP = 1e18; for (let t = i - LB - 1; t < i - 1; t++) { if (c[t].h > topP) topP = c[t].h; if (c[t].l < botP) botP = c[t].l; }
    const side = c[i].c > top && c[i - 1].c <= topP ? 1 : c[i].c < bot && c[i - 1].c >= botP ? -1 : 0; if (!side || Number.isNaN(atr[i]) || Number.isNaN(vs[i - 1]) || Number.isNaN(Dd[i])) continue;
    const v1 = c[i].v >= 1.5 * vs[i - 1], v2 = side === 1 ? hist[i] > 0 && hist[i] > hist[i - 1] : hist[i] < 0 && hist[i] < hist[i - 1], v3 = side === 1 ? K[i] > Dd[i] && K[i] <= 80 : K[i] < Dd[i] && K[i] >= 20, v4 = c[i].h - c[i].l >= atr[i];
    ev.push({ i, side, nv: v1 + v2 + v3 + v4, v1, v2, v3, v4 });
  }
  D[s] = { c, atr, ev }; process.stderr.write(`${n} velas, ${ev.length} rompimentos\n`);
}
function run(s, f, tgtR, stopMult = 1.5) { const { c, atr, ev } = D[s], trs = []; let free = 0; for (const e of ev) { if (e.i < free || !f(e)) continue; const i = e.i, entry = c[i].c, R = stopMult * atr[i], stop = e.side === 1 ? entry - R : entry + R, tgt = e.side === 1 ? entry + tgtR * R : entry - tgtR * R; let res = null, exit = i; for (let q = i + 1; q <= i + HOLD; q++) { const hs = e.side === 1 ? c[q].l <= stop : c[q].h >= stop, ht = e.side === 1 ? c[q].h >= tgt : c[q].l <= tgt; if (hs) { res = -1; exit = q; break; } if (ht) { res = tgtR; exit = q; break; } } if (res == null) { exit = i + HOLD; res = Math.max(-1, Math.min(tgtR, (e.side === 1 ? c[exit].c - entry : entry - c[exit].c) / R)); } trs.push({ gross: res, net: res - ((COST[s] ?? 0.0015) * entry) / R, y: new Date(c[i].t).getUTCFullYear() }); free = exit + 1; } return trs; }
const days = D.BTCUSDT.c.length / 288;
for (const tgtR of [1.5, 3]) {
  console.log(`\n===== alvo ${tgtR}R, stop 1,5xATR (empate antes do custo: ${(100 / (1 + tgtR)).toFixed(0)}% de acerto) =====`);
  for (const [title, side] of [["LONG (rompimento de topo)", 1], ["SHORT (rompimento de fundo)", -1]]) {
    console.log("--- " + title + ", 6 ativos, por numero de validacoes ---");
    for (const k of [0, 1, 2, 3, 4]) console.log(`${k} validacoes`.padEnd(14), summarize(SYMS.flatMap((s) => run(s, (e) => e.side === side && e.nv === k, tgtR))));
    console.log("3 ou mais".padEnd(14), summarize(SYMS.flatMap((s) => run(s, (e) => e.side === side && e.nv >= 3, tgtR))));
  }
}
const n4 = SYMS.reduce((t, s) => t + D[s].ev.filter((e) => e.nv === 4).length, 0), n3 = SYMS.reduce((t, s) => t + D[s].ev.filter((e) => e.nv >= 3).length, 0);
console.log(`\nfrequencia: rompimentos com 4 validacoes = ${(n4 / days).toFixed(2)} por dia nos 6 ativos; com 3 ou mais = ${(n3 / days).toFixed(2)} por dia`);
