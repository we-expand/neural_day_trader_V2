// "Grafico limpo" (Cleber, 2026-10-07): ele so inverte/entra no cruzamento do estocastico em zona extrema QUANDO o grafico esta limpo
// (estocastico fluindo, MACD a favor) e fica fora quando esta emaranhado. Pergunta: filtrar assim melhora o resultado liquido?
// REGRAS FIXADAS ANTES DE RODAR (nao mexer depois de ver o resultado):
//  - Estocastico lento 5,3,3 no 5m (parametros do motor). Gatilho LONG: %K cruza %D pra cima e o minimo de %K nas ultimas 3 velas < 20
//    (SHORT: espelho, > 80). Entrada no fechamento da vela do cruzamento. 1 trade por vez (pula ate a saida).
//  - "Emaranhado" = numero de cruzamentos %K/%D nas ultimas 20 velas (contando o atual). LIMPO: <= 2 E histograma do MACD (12/26/9)
//    melhorando a favor (LONG: hist[i] > hist[i-1]; SHORT: <). LIMPISSIMO: <= 1 e MACD a favor. EMARANHADO: >= 4.
//  - Saida: stop = 2xATR14(5m), alvo 1,5R (principal; 1R e 3R tambem mostrados), timeout 4h marcado a mercado, empate na vela = stop.
//  - Custo round-trip descontado: BTC 0,08%, ETH 0,11%, demais 0,15% (suposicao conservadora, nao medida).
//  - Etapa 2 (varios ativos): o evento so conta se o ativo tem o MENOR numero de cruzamentos entre os da cesta naquele instante ("fluidez").
// Uso: KLINE_CACHE_DIR=<pasta> node 11-grafico-limpo.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cacheDir = process.env.KLINE_CACHE_DIR || os.tmpdir();
const SYMS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "LINKUSDT"];
const COST = { BTCUSDT: 0.0008, ETHUSDT: 0.0011 };
const YEARS = 2, HOLD = 48;

async function kl(sym) {
  const f = path.join(cacheDir, `kl_${sym}_5m_${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  let out = [], cur = Date.now() - YEARS * 365 * 864e5;
  while (true) {
    let j = null;
    for (const host of ["https://api.binance.com", "https://data-api.binance.vision"]) {
      try { const r = await fetch(`${host}/api/v3/klines?symbol=${sym}&interval=5m&limit=1000&startTime=${cur}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) { j = await r.json(); break; } } catch {}
    }
    if (!Array.isArray(j) || !j.length) break;
    out = out.concat(j.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })));
    cur = j[j.length - 1][0] + 1;
    if (j.length < 1000) break;
  }
  fs.writeFileSync(f, JSON.stringify(out));
  return out;
}
const ema = (v, p) => { const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
const sma = (v, n) => { const o = new Array(v.length).fill(NaN); let s = 0, bad = 0; for (let i = 0; i < v.length; i++) { if (Number.isNaN(v[i])) bad++; else s += v[i]; if (i >= n) { if (Number.isNaN(v[i - n])) bad--; else s -= v[i - n]; } if (i >= n - 1 && bad === 0) o[i] = s / n; } return o; };

function prep(c) {
  const n = c.length, K0 = new Array(n).fill(NaN);
  for (let i = 4; i < n; i++) { let hh = -1e18, ll = 1e18; for (let t = i - 4; t <= i; t++) { if (c[t].h > hh) hh = c[t].h; if (c[t].l < ll) ll = c[t].l; } K0[i] = hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll); }
  const K = sma(K0, 3), D = sma(K, 3);
  const cl = c.map((x) => x.c), macd = ema(cl, 12).map((v, i) => v - ema(cl, 26)[i]);
  return { K, D, macd };
}
function prepFast(c) { // mesma coisa, mas EMAs calculadas uma vez so
  const n = c.length, cl = c.map((x) => x.c), e12 = ema(cl, 12), e26 = ema(cl, 26), macd = e12.map((v, i) => v - e26[i]), sig = ema(macd, 9), hist = macd.map((v, i) => v - sig[i]);
  const K0 = new Array(n).fill(NaN);
  for (let i = 4; i < n; i++) { let hh = -1e18, ll = 1e18; for (let t = i - 4; t <= i; t++) { if (c[t].h > hh) hh = c[t].h; if (c[t].l < ll) ll = c[t].l; } K0[i] = hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll); }
  const K = sma(K0, 3), D = sma(K, 3);
  const cross = new Uint8Array(n); // 1 = %K mudou de lado em relacao a %D nesta vela
  for (let i = 1; i < n; i++) if (!Number.isNaN(K[i]) && !Number.isNaN(D[i]) && !Number.isNaN(K[i - 1]) && !Number.isNaN(D[i - 1])) cross[i] = (K[i - 1] - D[i - 1]) * (K[i] - D[i]) < 0 ? 1 : 0;
  const csum = new Int32Array(n + 1); for (let i = 0; i < n; i++) csum[i + 1] = csum[i] + cross[i];
  const atr = new Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { const tr = i ? Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)) : c[i].h - c[i].l; s = i < 14 ? s + tr : (s * 13 + tr) / 14; atr[i] = i < 13 ? NaN : i === 13 ? s / 14 : s; }
  return { K, D, hist, cross, csum, atr };
}
const tangle = (P, i) => P.csum[i + 1] - P.csum[i - 19]; // cruzamentos nas ultimas 20 velas (inclui a atual)

function events(sym, c, P) {
  const ev = [];
  for (let i = 300; i < c.length - HOLD - 1; i++) {
    const k = P.K[i], d = P.D[i], kp = P.K[i - 1], dp = P.D[i - 1];
    if ([k, d, kp, dp, P.atr[i]].some(Number.isNaN)) continue;
    let side = 0;
    if (kp <= dp && k > d && Math.min(P.K[i], P.K[i - 1], P.K[i - 2]) < 20) side = 1;
    else if (kp >= dp && k < d && Math.max(P.K[i], P.K[i - 1], P.K[i - 2]) > 80) side = -1;
    if (!side) continue;
    ev.push({ sym, i, side, t: c[i].t, tg: tangle(P, i), macdOk: side === 1 ? P.hist[i] > P.hist[i - 1] : P.hist[i] < P.hist[i - 1] });
  }
  return ev;
}
function trade(c, P, e, tgtR) {
  const i = e.i, entry = c[i].c, R = 2 * P.atr[i], stop = e.side === 1 ? entry - R : entry + R, tgt = e.side === 1 ? entry + tgtR * R : entry - tgtR * R;
  let res = null, exit = i;
  for (let q = i + 1; q <= i + HOLD; q++) {
    const hs = e.side === 1 ? c[q].l <= stop : c[q].h >= stop, ht = e.side === 1 ? c[q].h >= tgt : c[q].l <= tgt;
    if (hs) { res = -1; exit = q; break; } if (ht) { res = tgtR; exit = q; break; }
  }
  if (res == null) { exit = i + HOLD; res = Math.max(-1, Math.min(tgtR, (e.side === 1 ? c[exit].c - entry : entry - c[exit].c) / R)); }
  return { net: res - ((COST[e.sym] ?? 0.0015) * entry) / R, gross: res, exit, y: new Date(c[i].t).getUTCFullYear() };
}
function summarize(trs) {
  const n = trs.length; if (n < 30) return `n=${String(n).padStart(5)} (amostra insuficiente)`;
  const e = trs.reduce((s, x) => s + x.net, 0) / n, sd = Math.sqrt(trs.reduce((s, x) => s + (x.net - e) ** 2, 0) / (n - 1));
  const by = [...new Set(trs.map((x) => x.y))].sort().map((y) => { const a = trs.filter((x) => x.y === y); return `${y}:${(a.reduce((s, x) => s + x.net, 0) / a.length).toFixed(2)}R(n${a.length})`; }).join(" ");
  return `n=${String(n).padStart(5)} acerto ${(100 * trs.filter((x) => x.net > 0).length / n).toFixed(1).padStart(4)}%  bruto ${(trs.reduce((s, x) => s + x.gross, 0) / n).toFixed(3).padStart(6)}  liq ${e.toFixed(3).padStart(6)}  t=${(e / (sd / Math.sqrt(n))).toFixed(2).padStart(6)} | ${by}`;
}
function run(c, P, evs, filter, tgtR) { // 1 trade por vez
  const trs = []; let free = 0;
  for (const e of evs) { if (e.i < free || !filter(e)) continue; const t = trade(c, P, e, tgtR); trs.push(t); free = t.exit + 1; }
  return trs;
}

const data = {};
for (const s of SYMS) { process.stderr.write(`carregando ${s}... `); const c = await kl(s); const P = prepFast(c); data[s] = { c, P, evs: events(s, c, P) }; process.stderr.write(`${c.length} velas, ${data[s].evs.length} cruzamentos extremos\n`); }

const FILTERS = [
  ["todos os cruzamentos extremos (sem filtro)", () => true],
  ["LIMPO: <=2 cruzamentos em 20 velas + MACD a favor", (e) => e.tg <= 2 && e.macdOk],
  ["LIMPISSIMO: <=1 cruzamento (so o atual) + MACD a favor", (e) => e.tg <= 1 && e.macdOk],
  ["so MACD a favor (sem exigir limpeza)", (e) => e.macdOk],
  ["EMARANHADO: >=4 cruzamentos em 20 velas", (e) => e.tg >= 4],
];
for (const s of ["BTCUSDT", "ETHUSDT"]) {
  console.log(`\n===== ETAPA 1: ${s}, 2 anos, custo ${(COST[s] * 100).toFixed(2)}% r/t =====`);
  for (const tgtR of [1.5, 1, 3]) {
    console.log(`--- alvo ${tgtR}R (empate antes do custo: ${(100 / (1 + tgtR)).toFixed(0)}% de acerto) ---`);
    for (const [name, f] of FILTERS) console.log(name.padEnd(56), summarize(run(data[s].c, data[s].P, data[s].evs, f, tgtR)));
  }
}
console.log(`\n===== ETAPA 2: cesta de ${SYMS.length} ativos, so entra o ativo mais "fluido" (menos cruzamentos nas ultimas 20 velas) no instante =====`);
const tgtR = 1.5, allEv = [];
for (const s of SYMS) for (const e of data[s].evs) allEv.push(e);
const timeIdx = Object.fromEntries(SYMS.map((s) => [s, new Map(data[s].c.map((x, i) => [x.t, i]))]));
const fluid = (e) => { let best = Infinity, who = null; for (const s of SYMS) { const j = timeIdx[s].get(e.t); if (j == null || j < 25) continue; const tg = tangle(data[s].P, j); if (tg < best || (tg === best && s === e.sym)) { best = tg; who = s; } } return who === e.sym && e.tg === best; };
for (const [name, ef] of [["todos os ativos, sem filtro", () => true], ["so o mais fluido da cesta", (e) => fluid(e)], ["so o mais fluido E limpo (<=2) + MACD a favor", (e) => fluid(e) && e.tg <= 2 && e.macdOk], ["ativo emaranhado (>=4), como contraste", (e) => e.tg >= 4]]) {
  const trs = []; const per = {};
  for (const s of SYMS) { const evs = allEv.filter((e) => e.sym === s && ef(e)); per[s] = run(data[s].c, data[s].P, evs, () => true, tgtR); trs.push(...per[s]); }
  console.log(name.padEnd(56), summarize(trs));
}

// ETAPA 3 (acrescentada DEPOIS de ver que "<=2 cruzamentos" quase nunca ocorre e ">=4" e quase tudo: a definicao fixa nao separava nada).
// Nova definicao, fixada ANTES de rodar esta etapa: limpo = cruzamentos nas ultimas 20 velas <= percentil 25 da distribuicao de TODOS os eventos
// (do proprio ativo); emaranhado = >= percentil 75. Mesmas regras de saida e custo. Etapa 1 e 2 acima ficam como foram (resultado "nao separou").
console.log("\n===== ETAPA 3: limpo/emaranhado por PERCENTIL (25% mais limpos x 25% mais emaranhados de cada ativo) =====");
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
for (const s of SYMS) { const tgs = data[s].evs.map((e) => e.tg); data[s].p25 = pct(tgs, 0.25); data[s].p75 = pct(tgs, 0.75); }
console.log("limiares (cruzamentos em 20 velas):", SYMS.map((s) => `${s.replace("USDT", "")} p25=${data[s].p25} p75=${data[s].p75}`).join(" | "));
for (const tgtR of [1.5, 1, 3]) {
  console.log(`--- alvo ${tgtR}R ---`);
  for (const [name, f] of [
    ["todos (sem filtro)", () => true],
    ["LIMPO (p25) + MACD a favor", (e) => e.tg <= data[e.sym].p25 && e.macdOk],
    ["LIMPO (p25), sem exigir MACD", (e) => e.tg <= data[e.sym].p25],
    ["EMARANHADO (p75)", (e) => e.tg >= data[e.sym].p75],
    ["EMARANHADO (p75) + MACD contra", (e) => e.tg >= data[e.sym].p75 && !e.macdOk],
  ]) {
    const trs = []; for (const s of SYMS) trs.push(...run(data[s].c, data[s].P, data[s].evs.filter((e) => f(e)), () => true, tgtR));
    console.log(name.padEnd(40), summarize(trs));
  }
}
