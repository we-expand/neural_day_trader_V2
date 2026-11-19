// Variacoes de SAIDA (breakeven, parcial, trailing, alvo) e de CESTA de ativos, aplicadas as mesmas
// decisoes de entrada da LLM em setembro. Separa dentro da amostra (1-20/09) e fora (21-30/09):
// so conta como achado o que melhora nas DUAS metades (regra de CRITERIA.md contra overfitting).
// Uso: node research/replay/02-saidas-e-ativos.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles } from "./lib/data.mjs";
import { buildContext } from "./lib/indicators.mjs";
import { simulate, COST_PCT, ENGINE } from "./lib/sim.mjs";
import { summarize, fmt } from "./lib/stats.mjs";
import { loadDecisions } from "./lib/decisions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FROM = "2026-09-01", TO = "2026-10-01", SPLIT = Date.parse("2026-09-21T00:00:00Z");
const SYMBOLS = ["BTCUSD", "XETUSD", "NAS100", "SPX500", "XAGUSD", "LNKUSD", "UKOUSD"];
const fromMs = Date.parse(FROM), toMs = Date.parse(TO);
const ctxBy = {};
for (const s of SYMBOLS) {
  const m5 = await loadCandles(s, "5m", fromMs - 5 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  const h1 = await loadCandles(s, "1h", fromMs - 10 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  ctxBy[s] = buildContext(m5, h1);
}
const { decisions } = loadDecisions({ from: FROM, to: TO, symbols: SYMBOLS });

const VARIANTS = {
  "ATUAL (BE 0,35R, parcial 1R, trail 1,6)": {},
  "BE 0,6R": { beR: 0.6 },
  "BE 1,0R": { beR: 1.0 },
  "sem BE (so stop/alvo + parcial)": { beR: null, trailAtr: null },
  "sem BE, sem parcial (stop/alvo puro)": { beR: null, trailAtr: null, partialR: null },
  "BE 1,0R + alvo 2R": { beR: 1.0, fixedTpR: 2 },
  "sem BE, sem parcial, alvo 1R": { beR: null, trailAtr: null, partialR: null, fixedTpR: 1 },
  "sem BE, sem parcial, alvo 2R": { beR: null, trailAtr: null, partialR: null, fixedTpR: 2 },
};
const BASKETS = {
  "cesta atual (7)": SYMBOLS,
  "sem LNKUSD": SYMBOLS.filter((s) => s !== "LNKUSD"),
  "so indices (NAS100+SPX500)": ["NAS100", "SPX500"],
  "spread <= 0,04% (NAS,SPX,XAG)": ["NAS100", "SPX500", "XAGUSD"],
};

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
log(`# Saidas e cesta -- decisoes reais da LLM, ${FROM} a ${TO}`);
log(`IN = 01-20/09 | OUT = 21-30/09. "LLM" = lado que ela escolheu; "oposto" = lado contrario (controle).\n`);

function run(variant, basket, sideMode) {
  const p = { ...ENGINE, ...variant };
  const res = { in: [], out: [] };
  for (const d of decisions) {
    if (!basket.includes(d.symbol)) continue;
    const t = d.tOpen ?? d.t;
    const side = sideMode === "LLM" ? d.side : d.side === "LONG" ? "SHORT" : "LONG";
    const r = simulate(ctxBy[d.symbol], t, side, COST_PCT[d.symbol], p);
    if (!r || r.skipped) continue;
    (t < SPLIT ? res.in : res.out).push(r.r);
  }
  return res;
}

log(`## 1) Variantes de saida (cesta atual)`);
for (const [name, v] of Object.entries(VARIANTS)) {
  const a = run(v, SYMBOLS, "LLM"), b = run(v, SYMBOLS, "OPP");
  log(`### ${name}`);
  log(`  LLM    IN  ${fmt(summarize(a.in))}`);
  log(`  LLM    OUT ${fmt(summarize(a.out))}`);
  log(`  oposto IN  ${fmt(summarize(b.in))}`);
  log(`  oposto OUT ${fmt(summarize(b.out))}`);
}
log();
log(`## 2) Cesta de ativos (saida ATUAL do motor, lado da LLM)`);
for (const [name, basket] of Object.entries(BASKETS)) {
  const a = run({}, basket, "LLM");
  log(`  ${name.padEnd(32)} IN  ${fmt(summarize(a.in))}`);
  log(`  ${"".padEnd(32)} OUT ${fmt(summarize(a.out))}`);
}
log();
log(`## 3) Cesta x saida combinadas (lado da LLM)`);
for (const [bn, basket] of Object.entries(BASKETS)) {
  for (const vn of ["ATUAL (BE 0,35R, parcial 1R, trail 1,6)", "BE 1,0R", "sem BE, sem parcial (stop/alvo puro)"]) {
    const a = run(VARIANTS[vn], basket, "LLM");
    log(`  ${bn.padEnd(30)} | ${vn.padEnd(40)} IN ${fmt(summarize(a.in))}`);
    log(`  ${"".padEnd(30)} | ${"".padEnd(40)} OUT ${fmt(summarize(a.out))}`);
  }
}

fs.mkdirSync(path.join(HERE, "resultados"), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
fs.writeFileSync(path.join(HERE, "resultados", `02-saidas-${stamp}.md`), out.join("\n") + "\n");
console.log(`\nsalvo em research/replay/resultados/02-saidas-${stamp}.md`);
