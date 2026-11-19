// Regra do Cleber (2026-10-07): "a tendencia se da SEMPRE no grafico de 1 hora; primeiro olha a 1H,
// depois faz a entrada no 5 minutos de acordo com a tendencia".
// Pergunta testada: escolher o LADO pela tendencia de 1H melhora o resultado de uma entrada de 5m?
//
// Regras fixadas ANTES de rodar (nao ajustar depois de ver o resultado):
//  - Dados: Binance, 5m + 1H, 2 anos. So velas de 1H JA FECHADAS definem a tendencia (sem look-ahead).
//  - Tendencia 1H "grafico" (EMA): ALTA = fechamento > EMA20 e EMA9 > EMA20 e EMA20 subindo vs 3 velas atras; BAIXA = espelho; senao LATERAL.
//  - Tendencia 1H "motor de hoje": variacao ponto-a-ponto de 24 velas de 1H, faixa neutra de 0,15% (atr.ts, getLongTermTrendInfo).
//  - Gatilho 5m E1 (pullback + retomada): estocastico lento 14,3,3 cruza pra cima vindo de %K < 30 (LONG) / cruza pra baixo vindo de %K > 70 (SHORT).
//  - Gatilho 5m E2 (qualquer cruzamento): cruzamento %K/%D em qualquer zona.
//  - Gatilho 5m E3 (leitura literal do Cleber, acrescentada apos ele esclarecer o metodo e ANTES de ver o resultado dela):
//    "preco e estocastico de 5m caminhando pro mesmo lado" = %K > %D e %K subindo e fechamento > EMA9(5m) e EMA9(5m) subindo (LONG; espelho pra SHORT).
//    Entra na 1a vela em que esse estado aparece.
//  - Tendencia 1H "ultimas 6h": variacao das ultimas 6 velas de 1H fechadas, faixa neutra 0,3% (o que o olho ve no fim do grafico).
//  - "A favor" = so pega o gatilho no lado da tendencia 1H. "Contra" = so pega o gatilho no lado oposto. "Sem filtro" = pega todos.
//  - Saida: stop = 2 x ATR14(5m) (igual ao motor), alvo = 1R / 1,5R (POUCOS, config atual) / 3R (MEDIO), timeout 4h marcado a mercado,
//    empate na mesma vela = stop (conservador), sem breakeven, 1 trade aberto por vez.
//  - Custo round-trip descontado: BTC 0,08%, ETH 0,11% (spread real medido em 2026-09-23).
// Uso: node 01-tendencia-1h-gatilho-5m.mjs BTCUSDT 0.0008
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sym = process.argv[2] || "BTCUSDT";
const COST = +(process.argv[3] || 0.0008);
const YEARS = 2;
const cacheDir = process.env.KLINE_CACHE_DIR || os.tmpdir();

async function kl(interval, startMs) {
  const cacheFile = path.join(cacheDir, `kl_${sym}_${interval}_${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  let out = [], cur = startMs;
  while (true) {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=1000&startTime=${cur}`);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    out = out.concat(j.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })));
    cur = j[j.length - 1][0] + 1;
    if (j.length < 1000) break;
  }
  fs.writeFileSync(cacheFile, JSON.stringify(out));
  return out;
}

const start = Date.now() - YEARS * 365 * 864e5;
const m5 = await kl("5m", start);
const h1 = await kl("1h", start - 30 * 864e5);

const ema = (v, p) => { const k = 2 / (p + 1); const o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; };
function stoch(c, p = 14) {
  const K = [];
  for (let i = 0; i < c.length; i++) {
    if (i < p - 1) { K.push(null); continue; }
    let hh = -1e18, ll = 1e18;
    for (let q = i - p + 1; q <= i; q++) { hh = Math.max(hh, c[q].h); ll = Math.min(ll, c[q].l); }
    K.push(hh === ll ? 50 : (100 * (c[i].c - ll)) / (hh - ll));
  }
  const sma = (a, n) => a.map((_, i) => (i < n - 1 || a.slice(i - n + 1, i + 1).some((x) => x == null) ? null : a.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n));
  const Ks = sma(K, 3);
  return { K: Ks, D: sma(Ks, 3) };
}
const s5 = stoch(m5);
const m5e9 = ema(m5.map((x) => x.c), 9);
const walk = (i) => {
  const k = s5.K[i], d = s5.D[i], kp = s5.K[i - 1];
  if (k == null || d == null || kp == null) return null;
  if (k > d && k > kp && m5[i].c > m5e9[i] && m5e9[i] > m5e9[i - 1]) return "L";
  if (k < d && k < kp && m5[i].c < m5e9[i] && m5e9[i] < m5e9[i - 1]) return "S";
  return null;
};
const atr = [];
{ let s = 0; for (let i = 0; i < m5.length; i++) { const tr = i ? Math.max(m5[i].h - m5[i].l, Math.abs(m5[i].h - m5[i - 1].c), Math.abs(m5[i].l - m5[i - 1].c)) : m5[i].h - m5[i].l; s = i < 14 ? s + tr : (s * 13 + tr) / 14; atr.push(i < 13 ? null : i === 13 ? s / 14 : s); } }

const h1c = h1.map((x) => x.c), h1e9 = ema(h1c, 9), h1e20 = ema(h1c, 20), h1t = h1.map((x) => x.t);
function h1idx(t) { let lo = 0, hi = h1t.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (h1t[m] + 3600000 <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
const trendEma = (j) => (h1c[j] > h1e20[j] && h1e9[j] > h1e20[j] && h1e20[j] > h1e20[j - 3] ? "ALTA" : h1c[j] < h1e20[j] && h1e9[j] < h1e20[j] && h1e20[j] < h1e20[j - 3] ? "BAIXA" : "LATERAL");
const trendRecent = (j) => { const ch = (h1c[j] / h1c[j - 6] - 1) * 100; return Math.abs(ch) < 0.3 ? "LATERAL" : ch > 0 ? "ALTA" : "BAIXA"; };
const trendEngine = (j) => { const ch = (h1c[j] / h1c[j - 24] - 1) * 100; return Math.abs(ch) < 0.15 ? "LATERAL" : ch > 0 ? "ALTA" : "BAIXA"; };

const HOLD = 48; // 4h em velas de 5m
function run(trigger, trendFn, mode, tgtR) {
  const tr = [];
  let i = 300;
  while (i < m5.length - HOLD - 1) {
    const k = s5.K[i], d = s5.D[i], kp = s5.K[i - 1], dp = s5.D[i - 1];
    if (k == null || d == null || kp == null || dp == null || atr[i] == null) { i++; continue; }
    let side = null;
    if (trigger === "E3") { const w = walk(i); if (w && walk(i - 1) !== w) side = w; }
    else if (kp <= dp && k > d && (trigger === "E2" || kp < 30)) side = "L";
    else if (kp >= dp && k < d && (trigger === "E2" || kp > 70)) side = "S";
    if (!side) { i++; continue; }
    const j = h1idx(m5[i].t + 300000);
    if (j < 30) { i++; continue; }
    const trend = trendFn(j);
    const withTrend = (side === "L" && trend === "ALTA") || (side === "S" && trend === "BAIXA");
    const againstTrend = (side === "L" && trend === "BAIXA") || (side === "S" && trend === "ALTA");
    if ((mode === "favor" && !withTrend) || (mode === "contra" && !againstTrend) || (mode === "lateral" && trend !== "LATERAL")) { i++; continue; }
    const entry = m5[i].c, R = 2 * atr[i];
    const stop = side === "L" ? entry - R : entry + R, tgt = side === "L" ? entry + tgtR * R : entry - tgtR * R;
    let res = null, exit = i;
    for (let q = i + 1; q <= i + HOLD; q++) {
      const hs = side === "L" ? m5[q].l <= stop : m5[q].h >= stop, ht = side === "L" ? m5[q].h >= tgt : m5[q].l <= tgt;
      if (hs) { res = -1; exit = q; break; }
      if (ht) { res = tgtR; exit = q; break; }
    }
    if (res == null) { exit = i + HOLD; res = Math.max(-1, Math.min(tgtR, (side === "L" ? m5[exit].c - entry : entry - m5[exit].c) / R)); }
    tr.push({ gross: res, net: res - (COST * entry) / R, y: new Date(m5[i].t).getUTCFullYear() });
    i = exit + 1;
  }
  const n = tr.length;
  if (n < 30) return `n=${n} (amostra insuficiente)`;
  const w = tr.filter((x) => x.net > 0).length / n, e = tr.reduce((s, x) => s + x.net, 0) / n, g = tr.reduce((s, x) => s + x.gross, 0) / n;
  const sd = Math.sqrt(tr.reduce((s, x) => s + (x.net - e) ** 2, 0) / (n - 1));
  const byY = [...new Set(tr.map((x) => x.y))].sort().map((y) => { const a = tr.filter((x) => x.y === y); return `${y}: ${(a.reduce((s, x) => s + x.net, 0) / a.length).toFixed(2)}R`; }).join(", ");
  return `n=${String(n).padStart(5)}  acerto ${(w * 100).toFixed(1).padStart(4)}%  E[R] bruto ${g.toFixed(3).padStart(6)}  liq ${e.toFixed(3).padStart(6)}  t=${(e / (sd / Math.sqrt(n))).toFixed(2).padStart(6)}  | ${byY}`;
}

console.log(`== ${sym}, ${YEARS} anos, ${m5.length} velas de 5m, custo ${(COST * 100).toFixed(2)}% r/t, stop 2xATR14(5m), timeout 4h ==`);
for (const tgtR of [1, 1.5, 3]) {
  const beWin = (100 / (1 + tgtR)).toFixed(0);
  console.log(`\n--- alvo ${tgtR}R (acerto de empate antes do custo: ${beWin}%) ---`);
  for (const [trigName, trig] of [["E1 pullback+retomada", "E1"], ["E2 qualquer cruzamento", "E2"]]) {
    console.log(`${trigName} | 1H grafico (EMA) A FAVOR `.padEnd(48), run(trig, trendEma, "favor", tgtR));
    console.log(`${trigName} | 1H grafico (EMA) CONTRA  `.padEnd(48), run(trig, trendEma, "contra", tgtR));
    console.log(`${trigName} | 1H grafico (EMA) LATERAL `.padEnd(48), run(trig, trendEma, "lateral", tgtR));
    console.log(`${trigName} | sem filtro de 1H        `.padEnd(48), run(trig, trendEma, "todos", tgtR));
  }
  console.log(`E1 pullback+retomada | 1H do MOTOR A FAVOR   `.padEnd(48), run("E1", trendEngine, "favor", tgtR));
  console.log(`E1 pullback+retomada | 1H do MOTOR CONTRA    `.padEnd(48), run("E1", trendEngine, "contra", tgtR));
  for (const [tn, tf] of [["1H grafico (EMA)", trendEma], ["1H ultimas 6h", trendRecent], ["1H do MOTOR", trendEngine]]) {
    console.log(`E3 preco+estoc 5m juntos | ${tn} A FAVOR`.padEnd(48), run("E3", tf, "favor", tgtR));
    console.log(`E3 preco+estoc 5m juntos | ${tn} CONTRA`.padEnd(48), run("E3", tf, "contra", tgtR));
  }
  console.log(`E3 preco+estoc 5m juntos | sem filtro de 1H`.padEnd(48), run("E3", trendEma, "todos", tgtR));
}
