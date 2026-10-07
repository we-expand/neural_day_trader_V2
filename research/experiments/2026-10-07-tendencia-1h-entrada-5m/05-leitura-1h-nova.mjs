// Leitura NOVA do grafico de 1H (mesma regra de readLongTermChartDirection em llm-active-brain/src/atr.ts,
// "ema9-ema20-6velas-v1") contra a leitura ANTIGA (variacao de 24 velas, faixa 0,15%).
//  (1) Em 2 anos de BTC/ETH: com que frequencia cada leitura diz ALTA/BAIXA/LATERAL e como fica o veredito
//      5m+1H que libera entrada "a favor" (o gate de open_position bloqueia DIVERGENTE sem REVERSAO).
//  (2) Gera os graficos pra validacao as cegas pelo Cleber (momentos reais de entrada do motor).
// Uso: KLINE_CACHE_DIR=<pasta com os kl_*.json do script 01> node 05-leitura-1h-nova.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = process.env.KLINE_CACHE_DIR || os.tmpdir();
const WINDOW = 60; // o motor recebe 60 velas de 1H por chamada (fetchRecentCandles)

function emaSeries(values, period) { // identico a calculateEmaSeries (seed = SMA dos primeiros `period`)
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = new Array(values.length).fill(NaN);
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
function atr14(c) { // identico a calculateAtr (Wilder)
  const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
  let a = tr.slice(0, 14).reduce((s, x) => s + x, 0) / 14;
  for (let i = 14; i < tr.length; i++) a = (a * 13 + tr[i]) / 14;
  return a;
}
export function newLabel(c) {
  const closes = c.map((x) => x.c);
  const e9 = emaSeries(closes, 9).at(-1), e20 = emaSeries(closes, 20).at(-1), atr = atr14(c);
  const last = closes.at(-1), past = closes.at(-7);
  const move = last - past;
  const recent = Math.abs(move) < 0.5 * atr ? "lado" : move > 0 ? "sobe" : "cai";
  const up = e9 > e20 && last > e20, down = e9 < e20 && last < e20;
  return up && recent !== "cai" ? "ALTA" : down && recent !== "sobe" ? "BAIXA" : "LATERAL";
}
export function oldLabel(c) {
  const ch = (c.at(-1).c / c.at(-25).c - 1) * 100;
  return Math.abs(ch) < 0.15 ? "LATERAL" : ch > 0 ? "ALTA" : "BAIXA";
}
const label5m = (m5, i) => { const ch = (m5[i].c / m5[i - 12].c - 1) * 100; return Math.abs(ch) < 0.15 ? "LATERAL" : ch > 0 ? "ALTA" : "BAIXA"; };
const verdict = (a, b) => {
  const reads = [a, b].filter((x) => x !== "LATERAL");
  if (!reads.length) return "INDEFINIDO";
  return a === b ? a : "DIVERGENTE";
};
const pct = (n, d) => ((100 * n) / d).toFixed(0).padStart(3) + "%";

for (const sym of ["BTCUSDT", "ETHUSDT"]) {
  const f5 = fs.readdirSync(cacheDir).find((f) => f.startsWith(`kl_${sym}_5m_`)), f1 = fs.readdirSync(cacheDir).find((f) => f.startsWith(`kl_${sym}_1h_`));
  if (!f5 || !f1) { console.log(`(sem cache de ${sym} em ${cacheDir}; rode o script 01 antes)`); continue; }
  const m5 = JSON.parse(fs.readFileSync(path.join(cacheDir, f5), "utf8")), h1 = JSON.parse(fs.readFileSync(path.join(cacheDir, f1), "utf8"));
  const cnt = { old: {}, neu: {}, vOld: {}, vNew: {}, opp: 0, n: 0 };
  let j = 0;
  for (let i = 300; i < m5.length; i += 3) { // a cada 15 min
    const t = m5[i].t + 300000;
    while (j + 1 < h1.length && h1[j + 1].t + 3600000 <= t) j++;
    if (j < WINDOW) continue;
    const win = h1.slice(j - WINDOW + 1, j + 1);
    const o = oldLabel(win), n = newLabel(win), s = label5m(m5, i);
    cnt.old[o] = (cnt.old[o] || 0) + 1; cnt.neu[n] = (cnt.neu[n] || 0) + 1;
    const vo = verdict(s, o), vn = verdict(s, n);
    cnt.vOld[vo] = (cnt.vOld[vo] || 0) + 1; cnt.vNew[vn] = (cnt.vNew[vn] || 0) + 1;
    if ((o === "ALTA" && n === "BAIXA") || (o === "BAIXA" && n === "ALTA")) cnt.opp++;
    cnt.n++;
  }
  console.log(`\n== ${sym}, 2 anos, ${cnt.n} leituras (1 a cada 15 min) ==`);
  for (const k of ["ALTA", "BAIXA", "LATERAL"]) console.log(`1H ${k.padEnd(8)} antiga ${pct(cnt.old[k] || 0, cnt.n)}   nova ${pct(cnt.neu[k] || 0, cnt.n)}`);
  console.log(`antiga e nova em lados OPOSTOS: ${pct(cnt.opp, cnt.n)}`);
  const free = (v) => (v.ALTA || 0) + (v.BAIXA || 0) + (v.INDEFINIDO || 0);
  console.log(`veredito 5m+1H claro (ALTA/BAIXA):      antiga ${pct((cnt.vOld.ALTA || 0) + (cnt.vOld.BAIXA || 0), cnt.n)}   nova ${pct((cnt.vNew.ALTA || 0) + (cnt.vNew.BAIXA || 0), cnt.n)}`);
  console.log(`veredito DIVERGENTE (so com REVERSAO):  antiga ${pct(cnt.vOld.DIVERGENTE || 0, cnt.n)}   nova ${pct(cnt.vNew.DIVERGENTE || 0, cnt.n)}`);
  console.log(`veredito INDEFINIDO (liberado):         antiga ${pct(cnt.vOld.INDEFINIDO || 0, cnt.n)}   nova ${pct(cnt.vNew.INDEFINIDO || 0, cnt.n)}`);
  console.log(`tempo em que entrada sem REVERSAO pode passar pelo gate de direcao: antiga ${pct(free(cnt.vOld), cnt.n)}   nova ${pct(free(cnt.vNew), cnt.n)}`);
}

// (2) Graficos pra validacao: momentos reais de entrada (entries.csv), 1 por simbolo a cada >= 8h,
// priorizando onde antiga e nova discordam. Grava validacao_1h.json (gabarito fica separado dos graficos).
const MAP = { BTCUSD: "BTCUSDT", XETUSD: "ETHUSDT", BNBUSD: "BNBUSDT", LNKUSD: "LINKUSDT", SOLUSD: "SOLUSDT" };
const entries = fs.readFileSync(path.join(DIR, "entries.csv"), "utf8").trim().split("\n").map((l) => { const a = l.split(","); return { ts: +a[0], symbol: a[1] }; }).filter((r) => MAP[r.symbol]);
const picked = [];
for (const r of entries) {
  if (picked.some((p) => p.symbol === r.symbol && Math.abs(p.ts - r.ts) < 8 * 3600)) continue;
  const end = r.ts * 1000;
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${MAP[r.symbol]}&interval=1h&startTime=${end - 90 * 3600000}&endTime=${end}&limit=100`);
  const k = (await res.json()).filter((x) => x[6] < end).map((x) => ({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] }));
  if (k.length < WINDOW) continue;
  const win = k.slice(-WINDOW);
  const closes = win.map((x) => x.c);
  picked.push({ ...r, win, e9: emaSeries(closes, 9), e20: emaSeries(closes, 20), old: oldLabel(win), neu: newLabel(win) });
}
const disagree = picked.filter((p) => p.old !== p.neu), agree = picked.filter((p) => p.old === p.neu);
const take = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
const chosen = [...take(disagree, 8), ...take(agree, 4)].sort((a, b) => (a.ts * 7919) % 101 - (b.ts * 7919) % 101); // ordem embaralhada fixa
console.log(`\nmomentos distintos: ${picked.length} (antiga != nova em ${disagree.length}); escolhidos ${chosen.length}`);
fs.writeFileSync(path.join(DIR, "validacao_1h.json"), JSON.stringify(chosen.map((p, i) => ({ n: i + 1, symbol: p.symbol, ts: p.ts, antiga: p.old, nova: p.neu, win: p.win, e9: p.e9, e20: p.e20 }))));
chosen.forEach((p, i) => console.log(`${String(i + 1).padStart(2)} ${p.symbol} ${new Date(p.ts * 1000).toISOString().slice(0, 16)}  antiga ${p.old.padEnd(7)} nova ${p.neu}`));
