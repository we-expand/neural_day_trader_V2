// Mapa de suportes e resistencias de 1H (somente leitura; NAO e usado pelo motor). Pedido do Cleber, 2026-10-07: o sistema precisa saber onde
// estao as resistencias pesadas (o S/R do motor enxerga so ~60 velas do timeframe operacional). Metodo: maximas/minimas locais de 1H
// (fractal de 3 velas de cada lado), agrupadas em faixas de largura maxima 0,25 ATR(1H) (argumento 3); forca = numero de toques; rejeicao = recuo medio nas 6 velas seguintes.
// Uso: node scripts/mapa-sr.mjs UKOUSD [velas=1000] [largura_em_ATR=0.25]
import fs from "node:fs";
const SYM = (process.argv[2] || "UKOUSD").toUpperCase(), N = Number(process.argv[3] || 1000);
const env = {}; for (const l of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const H = { apikey: env.NEURAL_SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.NEURAL_SUPABASE_SERVICE_ROLE_KEY };
const rows = await (await fetch(`${env.NEURAL_SUPABASE_URL}/rest/v1/ohlcv_data?asset_symbol=eq.${SYM}&timeframe=eq.1h&order=timestamp.desc&limit=${N}&select=timestamp,open,high,low,close`, { headers: H })).json();
const c = rows.reverse().map((x) => ({ t: new Date(x.timestamp).getTime(), h: +x.high, l: +x.low, c: +x.close }));
const tr = c.map((x, i) => (i ? Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c)) : x.h - x.l));
let atr = tr.slice(0, 14).reduce((a, b) => a + b, 0) / 14; for (let i = 14; i < tr.length; i++) atr = (atr * 13 + tr[i]) / 14;
const SPAN = Number(process.argv[4] || 0.25), last = c.at(-1).c, K = 3, brt = (t) => new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
function levels(kind) { // "R" resistencia (maximas) ou "S" suporte (minimas)
  const pts = [];
  for (let i = K; i < c.length - K; i++) {
    const v = kind === "R" ? c[i].h : c[i].l, nb = c.slice(i - K, i + K + 1).map((x) => (kind === "R" ? x.h : x.l));
    if (kind === "R" ? v < Math.max(...nb) : v > Math.min(...nb)) continue;
    const after = c.slice(i + 1, i + 7); if (after.length < 3) continue;
    pts.push({ v, t: c[i].t, rej: kind === "R" ? v - Math.min(...after.map((x) => x.l)) : Math.max(...after.map((x) => x.h)) - v });
  }
  pts.sort((a, b) => a.v - b.v);
  // agrupamento por LARGURA MAXIMA (nao por encadeamento): um grupo nunca passa de SPAN * ATR de largura, entao niveis diferentes nao se fundem numa faixa gigante
  const groups = []; for (const p of pts) { const g = groups.at(-1); if (g && p.v - g.start <= SPAN * atr) { g.pts.push(p); g.max = p.v; } else groups.push({ pts: [p], start: p.v, max: p.v }); }
  return groups.map((g) => ({ kind, nivel: g.pts.reduce((s, p) => s + p.v, 0) / g.pts.length, lo: Math.min(...g.pts.map((p) => p.v)), hi: Math.max(...g.pts.map((p) => p.v)), toques: g.pts.length, rej: g.pts.reduce((s, p) => s + p.rej, 0) / g.pts.length, ultimo: Math.max(...g.pts.map((p) => p.t)) }));
}
const all = [...levels("R"), ...levels("S")].filter((l) => l.toques >= 2);
console.log(`${SYM}: ${c.length} velas de 1H (${brt(c[0].t)} a ${brt(c.at(-1).t)}) | ATR 1H ${atr.toFixed(3)} | preco ${last}`);
for (const [titulo, f] of [["RESISTENCIAS acima do preco (da mais proxima pra mais longe)", (l) => l.nivel > last && l.kind === "R"], ["SUPORTES abaixo do preco (do mais proximo pra mais longe)", (l) => l.nivel < last && l.kind === "S"]]) {
  console.log("\n" + titulo);
  all.filter(f).sort((a, b) => Math.abs(a.nivel - last) - Math.abs(b.nivel - last)).slice(0, 6).forEach((l) => console.log(`  ${l.nivel.toFixed(3)} (faixa ${l.lo.toFixed(3)}-${l.hi.toFixed(3)}) | ${l.toques} toques | recuo medio ${l.rej.toFixed(2)} (${(l.rej / atr).toFixed(1)} ATR) | ultimo toque ${brt(l.ultimo)} | a ${(Math.abs(l.nivel - last)).toFixed(3)} do preco`));
}
