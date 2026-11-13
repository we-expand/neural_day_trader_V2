// Horizonte por custo: o que um operador profissional faz com ativo de spread alto -- nao tira o ativo,
// opera num horizonte em que o spread vira fracao pequena do risco. Mesmas decisoes de entrada da LLM,
// stop/alvo/trailing medidos com ATR de 5m (atual), 15m ou 1H. Regra "adaptativa": menor timeframe
// em que spread <= 10% do stop (2xATR).
// Uso: node research/replay/03-horizonte-por-custo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles } from "./lib/data.mjs";
import { buildContext, atr, lastClosedIdx } from "./lib/indicators.mjs";
import { simulate, COST_PCT, ENGINE } from "./lib/sim.mjs";
import { summarize, fmt } from "./lib/stats.mjs";
import { loadDecisions } from "./lib/decisions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FROM = "2026-09-01", TO = "2026-10-01", SPLIT = Date.parse("2026-09-21T00:00:00Z");
const SYMBOLS = ["BTCUSD", "XETUSD", "NAS100", "SPX500", "XAGUSD", "LNKUSD", "UKOUSD"];
const fromMs = Date.parse(FROM), toMs = Date.parse(TO);

function agg15(m5) {
  const o = [];
  let cur = null;
  for (const c of m5) {
    const b = Math.floor(c.t / 900_000) * 900_000;
    if (!cur || cur.t !== b) { if (cur) o.push(cur); cur = { t: b, o: c.o, h: c.h, l: c.l, c: c.c }; }
    else { cur.h = Math.max(cur.h, c.h); cur.l = Math.min(cur.l, c.l); cur.c = c.c; }
  }
  if (cur) o.push(cur);
  return o;
}
function atrPctFn(candles, tfMs) {
  const a = atr(candles);
  return (t) => { const i = lastClosedIdx(candles, tfMs, t); return i >= 14 && a[i] != null && t - (candles[i].t + tfMs) <= tfMs * 1.5 ? a[i] / candles[i].c : null; };
}

const ctxBy = {}, atrFn = {};
for (const s of SYMBOLS) {
  const m5 = await loadCandles(s, "5m", fromMs - 5 * 86400e3, Math.min(toMs + 5 * 86400e3, Date.now()));
  const h1 = await loadCandles(s, "1h", fromMs - 10 * 86400e3, Math.min(toMs + 5 * 86400e3, Date.now()));
  ctxBy[s] = buildContext(m5, h1);
  atrFn[s] = { "5m": null, "15m": atrPctFn(agg15(m5), 900_000), "1h": atrPctFn(h1, 3_600_000) };
}
const { decisions } = loadDecisions({ from: FROM, to: TO, symbols: SYMBOLS });

const HZ = {
  "5m": { timeoutMs: 24 * 3600e3 },
  "15m": { timeoutMs: 48 * 3600e3 },
  "1h": { timeoutMs: 96 * 3600e3 },
};
// menor timeframe com spread <= 10% do stop, a partir da mediana de ATR de set/2026 (tabela no veredito)
const ADAPT = { NAS100: "5m", SPX500: "5m", XAGUSD: "5m", BTCUSD: "1h", XETUSD: "1h", UKOUSD: "1h", LNKUSD: "1h" };

function run(sym, hz, sideMode) {
  const p = { ...ENGINE, ...HZ[hz], atrPctAt: atrFn[sym][hz] ?? undefined };
  const res = { in: [], out: [] };
  for (const d of decisions) {
    if (d.symbol !== sym) continue;
    const t = d.tOpen ?? d.t;
    const side = sideMode === "LLM" ? d.side : d.side === "LONG" ? "SHORT" : "LONG";
    const r = simulate(ctxBy[sym], t, side, COST_PCT[sym], p);
    if (!r || r.skipped) continue;
    (t < SPLIT ? res.in : res.out).push(r.r);
  }
  return res;
}

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
log(`# Horizonte por custo -- decisoes da LLM, ${FROM} a ${TO} (IN 01-20/09, OUT 21-30/09)\n`);
const tot = { atual: { LLM: { in: [], out: [] }, OPP: { in: [], out: [] } }, adapt: { LLM: { in: [], out: [] }, OPP: { in: [], out: [] } } };
for (const s of SYMBOLS) {
  log(`## ${s} (spread ${COST_PCT[s]}%)`);
  for (const hz of ["5m", "15m", "1h"]) {
    const a = run(s, hz, "LLM"), b = run(s, hz, "OPP");
    const all = (x) => [...x.in, ...x.out];
    log(`  ${hz.padEnd(4)} LLM    ${fmt(summarize(all(a)))}   | IN ${summarize(a.in).meanR?.toFixed(3)} OUT ${summarize(a.out).meanR?.toFixed(3)}`);
    log(`  ${"".padEnd(4)} oposto ${fmt(summarize(all(b)))}`);
    for (const [k, x] of [["LLM", a], ["OPP", b]]) {
      if (hz === "5m") { tot.atual[k].in.push(...x.in); tot.atual[k].out.push(...x.out); }
      if (hz === ADAPT[s]) { tot.adapt[k].in.push(...x.in); tot.adapt[k].out.push(...x.out); }
    }
  }
  log();
}
log(`## Cesta inteira (7 ativos)`);
for (const [name, g] of [["ATUAL (tudo em 5m)", tot.atual], ["ADAPTATIVO por custo", tot.adapt]]) {
  log(`  ${name.padEnd(22)} LLM    IN  ${fmt(summarize(g.LLM.in))}`);
  log(`  ${"".padEnd(22)} LLM    OUT ${fmt(summarize(g.LLM.out))}`);
  log(`  ${"".padEnd(22)} oposto IN  ${fmt(summarize(g.OPP.in))}`);
  log(`  ${"".padEnd(22)} oposto OUT ${fmt(summarize(g.OPP.out))}`);
}
fs.mkdirSync(path.join(HERE, "resultados"), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
fs.writeFileSync(path.join(HERE, "resultados", `03-horizonte-${stamp}.md`), out.join("\n") + "\n");
