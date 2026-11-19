// Gera as situacoes do "treino de leitura" do Cleber: 30 momentos reais de 01-20/09 (so a metade de
// calibracao -- a metade 21-30/09 fica intocada para validar a IA depois), equilibrados por ativo,
// DIFERENTES das 150 usadas no replay 04. Cada situacao leva so velas ate o momento da decisao
// (sem futuro). O gabarito (simulacao LONG/SHORT) fica num arquivo separado, fora da pagina.
// Uso: node research/replay/05-gerar-treino.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles } from "./lib/data.mjs";
import { buildContext, lastClosedIdx, ema, sma, stochSlow } from "./lib/indicators.mjs";
import { simulate, COST_PCT } from "./lib/sim.mjs";
import { loadDecisions } from "./lib/decisions.mjs";
import { buildSituation } from "./lib/contexts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "treino");
const FROM = "2026-09-01", TO = "2026-10-01", SPLIT = Date.parse("2026-09-21T00:00:00Z");
const SYMBOLS = ["BTCUSD", "XETUSD", "NAS100", "SPX500", "XAGUSD", "LNKUSD", "UKOUSD"];
const N = 30;
const fromMs = Date.parse(FROM), toMs = Date.parse(TO);

const ctxBy = {};
for (const s of SYMBOLS) {
  const m5 = await loadCandles(s, "5m", fromMs - 5 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  const h1 = await loadCandles(s, "1h", fromMs - 10 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  ctxBy[s] = buildContext(m5, h1);
}

// exclui as situacoes ja usadas no replay 04 (mesmo sorteio deterministico)
const used = new Set();
for (const f of fs.readdirSync(path.join(HERE, "resultados")).filter((f) => /^04-llm-.*\.json$/.test(f))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(HERE, "resultados", f), "utf8"))) used.add(`${r.symbol}|${r.ts}`);
}

const { decisions } = loadDecisions({ from: FROM, to: TO, symbols: SYMBOLS });
const pool = decisions.filter((d) => {
  const t = d.tOpen ?? d.t;
  if (t >= SPLIT || used.has(`${d.symbol}|${new Date(t).toISOString()}`)) return false;
  const ctx = ctxBy[d.symbol];
  const a = simulate(ctx, t, "LONG", COST_PCT[d.symbol]), b = simulate(ctx, t, "SHORT", COST_PCT[d.symbol]);
  return buildSituation(ctx, d.symbol, t, COST_PCT[d.symbol]) && a && b && !a.skipped && !b.skipped;
});
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const bySym = new Map();
for (const d of pool) { if (!bySym.has(d.symbol)) bySym.set(d.symbol, []); bySym.get(d.symbol).push(d); }
for (const a of bySym.values()) a.sort(() => rand() - 0.5);
const picked = [];
while (picked.length < N && [...bySym.values()].some((a) => a.length)) for (const a of bySym.values()) if (a.length && picked.length < N) picked.push(a.pop());
picked.sort(() => rand() - 0.5);

const round = (x, d) => (x == null ? null : Number(x.toFixed(d)));
function slice(c, from, to, dec) {
  const closes = c.map((x) => x.c);
  const e9 = ema(closes, 9), s20 = sma(closes, 20), st = stochSlow(c);
  const rows = [];
  for (let i = from; i <= to; i++) rows.push([c[i].t / 1000, round(c[i].o, dec), round(c[i].h, dec), round(c[i].l, dec), round(c[i].c, dec), round(e9[i], dec), round(s20[i], dec), round(st.K[i], 1), round(st.D[i], 1)]);
  return rows;
}
const decimals = (p) => (p > 1000 ? 2 : p > 10 ? 3 : 4);

const situacoes = [], gabarito = [];
picked.forEach((d, k) => {
  const t = d.tOpen ?? d.t, ctx = ctxBy[d.symbol];
  const i = lastClosedIdx(ctx.m5, 300_000, t), j = lastClosedIdx(ctx.h1, 3_600_000, t);
  const dec = decimals(ctx.m5[i].c);
  const id = `s${String(k + 1).padStart(2, "0")}`;
  situacoes.push({ id, symbol: d.symbol, t: Math.floor(t / 1000), price: round(ctx.m5[i].c, dec), spreadPct: COST_PCT[d.symbol], m5: slice(ctx.m5, i - 71, i, dec), h1: slice(ctx.h1, j - 47, j, dec) });
  const L = simulate(ctx, t, "LONG", COST_PCT[d.symbol]), S = simulate(ctx, t, "SHORT", COST_PCT[d.symbol]);
  gabarito.push({ id, symbol: d.symbol, ts: new Date(t).toISOString(), liveSide: d.side, longR: L.r, shortR: S.r });
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "situacoes.json"), JSON.stringify(situacoes));
fs.writeFileSync(path.join(OUT_DIR, "gabarito.json"), JSON.stringify(gabarito, null, 1));
console.log(`${situacoes.length} situacoes (pool ${pool.length}) ->`, Object.fromEntries([...new Set(situacoes.map((s) => s.symbol))].map((s) => [s, situacoes.filter((x) => x.symbol === s).length])));
