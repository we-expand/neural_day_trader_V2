// Replay da LLM: manda situacoes REAIS de setembro para o modelo (offline) e mede as decisoes com o
// simulador do motor. Compara formatos de contexto/prompt contra o lado aleatorio e contra a LLM ao vivo.
// Situacoes = momentos em que a LLM ao vivo quis entrar (gatilhos reais do vigia/ciclo).
// IN (01-20/09) e para calibrar prompt; OUT (21-30/09) so se olha para validar.
// Uso: node research/replay/04-llm-replay.mjs <variante> [nIN=150] [nOUT=150]
//   variantes: rotulos | senior | senior-thinking
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles } from "./lib/data.mjs";
import { buildContext } from "./lib/indicators.mjs";
import { simulate, COST_PCT, ENGINE } from "./lib/sim.mjs";
import { summarize, fmt } from "./lib/stats.mjs";
import { loadDecisions } from "./lib/decisions.mjs";
import { buildSituation, formatRotulos, formatGrafico, SYSTEM_ROTULOS, SYSTEM_SENIOR } from "./lib/contexts.mjs";
import { chat, parseDecision, LLM_MODEL } from "./lib/llm.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VARIANT = process.argv[2] ?? "senior";
const N_IN = Number(process.argv[3] ?? 150), N_OUT = Number(process.argv[4] ?? 150);
const FROM = "2026-09-01", TO = "2026-10-01", SPLIT = Date.parse("2026-09-21T00:00:00Z");
const SYMBOLS = ["BTCUSD", "XETUSD", "NAS100", "SPX500", "XAGUSD", "LNKUSD", "UKOUSD"];
const VARIANTS = {
  rotulos: { system: SYSTEM_ROTULOS, fmt: (sit) => formatRotulos(sit), thinking: false, maxTokens: 300 },
  senior: { system: SYSTEM_SENIOR, fmt: (sit, ctx) => formatGrafico(sit, ctx), thinking: false, maxTokens: 400 },
  "senior-thinking": { system: SYSTEM_SENIOR, fmt: (sit, ctx) => formatGrafico(sit, ctx), thinking: true, maxTokens: 4000 },
};
const V = VARIANTS[VARIANT];
if (!V) throw new Error(`variante desconhecida: ${VARIANT}`);

const fromMs = Date.parse(FROM), toMs = Date.parse(TO);
const ctxBy = {};
for (const s of SYMBOLS) {
  const m5 = await loadCandles(s, "5m", fromMs - 5 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  const h1 = await loadCandles(s, "1h", fromMs - 10 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  ctxBy[s] = buildContext(m5, h1);
}

// amostra deterministica (mesmas situacoes para todas as variantes), equilibrada por ativo
const { decisions } = loadDecisions({ from: FROM, to: TO, symbols: SYMBOLS });
function rng(seed) { let x = seed; return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); }
function sample(pool, n, seed) {
  const rand = rng(seed);
  const bySym = new Map();
  for (const d of pool) { if (!bySym.has(d.symbol)) bySym.set(d.symbol, []); bySym.get(d.symbol).push(d); }
  for (const a of bySym.values()) a.sort(() => rand() - 0.5);
  const out = [];
  while (out.length < n && [...bySym.values()].some((a) => a.length)) for (const a of bySym.values()) if (a.length && out.length < n) out.push(a.pop());
  return out;
}
const valid = decisions.filter((d) => {
  const t = d.tOpen ?? d.t;
  const sit = buildSituation(ctxBy[d.symbol], d.symbol, t, COST_PCT[d.symbol]);
  const a = simulate(ctxBy[d.symbol], t, "LONG", COST_PCT[d.symbol]);
  const b = simulate(ctxBy[d.symbol], t, "SHORT", COST_PCT[d.symbol]);
  return sit && a && b && !a.skipped && !b.skipped;
});
const picked = [...sample(valid.filter((d) => (d.tOpen ?? d.t) < SPLIT), N_IN, 42), ...sample(valid.filter((d) => (d.tOpen ?? d.t) >= SPLIT), N_OUT, 43)];
console.log(`modelo ${LLM_MODEL} | variante ${VARIANT} | ${picked.length} situacoes (${N_IN} IN + ${N_OUT} OUT) de ${valid.length} validas`);

let done = 0;
const rows = await Promise.all(picked.map(async (d) => {
  const t = d.tOpen ?? d.t;
  const ctx = ctxBy[d.symbol];
  const sit = buildSituation(ctx, d.symbol, t, COST_PCT[d.symbol]);
  let resp, dec;
  try {
    resp = await chat({ system: V.system, user: V.fmt(sit, ctx), thinking: V.thinking, maxTokens: V.maxTokens });
    dec = parseDecision(resp.content) ?? parseDecision(resp.reasoning ?? "");
  } catch (e) { resp = { error: String(e) }; }
  const long = simulate(ctx, t, "LONG", COST_PCT[d.symbol]);
  const short = simulate(ctx, t, "SHORT", COST_PCT[d.symbol]);
  const liveR = d.side === "LONG" ? long.r : short.r;
  const r = !dec || dec.decisao === "NONE" ? null : dec.decisao === "LONG" ? long.r : short.r;
  const rOpp = !dec || dec.decisao === "NONE" ? null : dec.decisao === "LONG" ? short.r : long.r;
  if (++done % 25 === 0) console.log(`  ${done}/${picked.length}`);
  return { ts: new Date(t).toISOString(), symbol: d.symbol, half: t < SPLIT ? "IN" : "OUT", live: d.side, liveR, dec: dec?.decisao ?? "ERRO", conf: dec?.confianca ?? null, motivo: dec?.motivo ?? resp?.error ?? String(resp?.content ?? "").slice(0, 200), r, rOpp, randomR: (long.r + short.r) / 2, ms: resp?.ms };
}));

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
log(`\n# Replay da LLM -- variante "${VARIANT}" -- ${LLM_MODEL}`);
for (const half of ["IN", "OUT"]) {
  const a = rows.filter((x) => x.half === half);
  const taken = a.filter((x) => x.r != null);
  const cnt = (k) => a.filter((x) => x.dec === k).length;
  log(`\n## ${half} (${a.length} situacoes) -- LONG ${cnt("LONG")} | SHORT ${cnt("SHORT")} | NONE ${cnt("NONE")} | erro ${cnt("ERRO")}`);
  log(`  operou (lado escolhido)     ${fmt(summarize(taken.map((x) => x.r)))}`);
  log(`  mesmas, lado oposto         ${fmt(summarize(taken.map((x) => x.rOpp)))}`);
  log(`  LLM AO VIVO, mesmas situac. ${fmt(summarize(a.map((x) => x.liveR)))}`);
  log(`  aleatorio (media L/S)       ${fmt(summarize(a.map((x) => x.randomR)))}`);
  log(`  resultado por situacao (NONE=0): soma ${taken.reduce((s, x) => s + x.r, 0).toFixed(1)}R em ${a.length} situacoes = ${(taken.reduce((s, x) => s + x.r, 0) / a.length).toFixed(3)}R/situacao  vs ao vivo ${(a.reduce((s, x) => s + x.liveR, 0) / a.length).toFixed(3)}`);
  const bySym = {};
  for (const x of taken) (bySym[x.symbol] ??= []).push(x.r);
  log(`  por ativo: ` + Object.entries(bySym).map(([k, v]) => `${k} n${v.length} ${(v.reduce((s, y) => s + y, 0) / v.length).toFixed(2)}R`).join(" | "));
}
fs.mkdirSync(path.join(HERE, "resultados"), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
fs.writeFileSync(path.join(HERE, "resultados", `04-llm-${VARIANT}-${stamp}.md`), out.join("\n") + "\n");
fs.writeFileSync(path.join(HERE, "resultados", `04-llm-${VARIANT}-${stamp}.json`), JSON.stringify(rows));
