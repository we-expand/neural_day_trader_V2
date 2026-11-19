// Auditoria das decisoes da LLM: cada open_position que ela tentou em setembro (abertas E barradas)
// e simulada com as regras de saida do motor, no lado que ela escolheu e no lado OPOSTO.
// Pergunta: a escolha de lado da LLM tem vantagem? Os gates ajudam ou atrapalham?
// Uso: node research/replay/01-auditoria-llm.mjs [de=2026-09-01] [ate=2026-10-01]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandles, dataSource } from "./lib/data.mjs";
import { buildContext, snapshot } from "./lib/indicators.mjs";
import { simulate, COST_PCT, ENGINE } from "./lib/sim.mjs";
import { summarize, fmt } from "./lib/stats.mjs";
import { loadDecisions } from "./lib/decisions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FROM = process.argv[2] ?? "2026-09-01";
const TO = process.argv[3] ?? "2026-10-01";
const SYMBOLS = ["BTCUSD", "XETUSD", "NAS100", "SPX500", "XAGUSD", "LNKUSD", "UKOUSD"];
// troca de modelo: .env pro NVIDIA/Nemotron em 2026-09-27 13:27 BRT
const MODEL_SWITCH = Date.parse("2026-09-27T16:27:00Z");

const fromMs = Date.parse(FROM), toMs = Date.parse(TO);
const ctxBy = {};
for (const s of SYMBOLS) {
  const m5 = await loadCandles(s, "5m", fromMs - 5 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  const h1 = await loadCandles(s, "1h", fromMs - 10 * 86400e3, Math.min(toMs + 2 * 86400e3, Date.now()));
  ctxBy[s] = buildContext(m5, h1);
  console.log(`dados ${s.padEnd(6)} 5m=${String(m5.length).padStart(5)} 1h=${String(h1.length).padStart(4)}  (${dataSource(s)})`);
}

const { decisions, rawCount } = loadDecisions({ from: FROM, to: TO, symbols: SYMBOLS });
console.log(`\n${rawCount} chamadas open_position no ledger -> ${decisions.length} decisoes (agrupadas por ativo+lado em 30 min)`);

const rows = [];
let noData = 0, spreadSkip = 0;
for (const d of decisions) {
  const ctx = ctxBy[d.symbol];
  const t = d.tOpen ?? d.t;
  const snap = snapshot(ctx, t);
  const mine = simulate(ctx, t, d.side, COST_PCT[d.symbol]);
  const opp = simulate(ctx, t, d.side === "LONG" ? "SHORT" : "LONG", COST_PCT[d.symbol]);
  if (!mine || !opp) { noData++; continue; }
  if (mine.skipped || opp.skipped) { spreadSkip++; continue; }
  const withCons = snap && ((snap.consensus === "ALTA" && d.side === "LONG") || (snap.consensus === "BAIXA" && d.side === "SHORT"));
  const againstCons = snap && ((snap.consensus === "ALTA" && d.side === "SHORT") || (snap.consensus === "BAIXA" && d.side === "LONG"));
  rows.push({
    ...d, snap, mine, opp,
    align: !snap ? "SEM_CONTEXTO" : withCons ? "A_FAVOR" : againstCons ? "CONTRA" : snap.consensus,
    period: t < MODEL_SWITCH ? "antes_27-09" : "Nemotron",
  });
}
console.log(`${rows.length} simuladas | ${noData} sem vela continua (buraco no dado) | ${spreadSkip} recusadas por spread\n`);

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
function block(title, groups) {
  log(`## ${title}`);
  for (const [name, arr] of groups) {
    if (!arr.length) continue;
    log(`  ${name.padEnd(34)} LADO DA LLM  ${fmt(summarize(arr.map((x) => x.mine.r)))}`);
    log(`  ${"".padEnd(34)} lado oposto  ${fmt(summarize(arr.map((x) => x.opp.r)))}`);
  }
  log();
}
const by = (key) => { const m = new Map(); for (const r of rows) { const k = typeof key === "function" ? key(r) : r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length); };

log(`# Auditoria das decisoes da LLM -- ${FROM} a ${TO}`);
log(`Saida simulada = regras do motor (stop ${ENGINE.stopAtr}xATR, alvo ${ENGINE.targetRefAtr * ENGINE.rr}xATR, parcial ${ENGINE.partialFrac * 100}% em ${ENGINE.partialR}R, BE ${ENGINE.beR}R, trailing ${ENGINE.trailAtr}xATR), liquido de spread.`);
log(`"lado oposto" = mesma hora, mesmo ativo, lado contrario. Se a LLM le o mercado, LADO DA LLM >> lado oposto.\n`);
block("Todas as decisoes", [["todas", rows]]);
block("Abertas x barradas pelos gates", by((r) => (r.opened ? "ABRIU (executada)" : "barrada")));
block("Por gate que barrou", by("gate"));
block("Lado da LLM vs consenso 5m+1H no instante", by("align"));
block("Por periodo/modelo", by("period"));
block("Por ativo", by("symbol"));
block("Estocastico 5m x lado escolhido", by((r) => `${r.snap?.stochLabel ?? "?"} -> ${r.side}`));
block("Por setupType declarado", by((r) => r.setupType ?? "(nenhum)"));

// Filtros mecanicos aplicados sobre as MESMAS decisoes
log(`## E se so tivesse operado quando... (sobre as mesmas decisoes, lado da LLM)`);
const f = (name, pred) => { const a = rows.filter(pred); log(`  ${name.padEnd(46)} ${fmt(summarize(a.map((x) => x.mine.r)))}`); };
f("sem filtro", () => true);
f("lado A FAVOR do consenso 5m+1H", (r) => r.align === "A_FAVOR");
f("lado CONTRA o consenso", (r) => r.align === "CONTRA");
f("consenso DIVERGENTE/INDEFINIDO", (r) => r.align === "DIVERGENTE" || r.align === "INDEFINIDO");
f("a favor + sem LNKUSD (spread 0,59%)", (r) => r.align === "A_FAVOR" && r.symbol !== "LNKUSD");
f("sem LNKUSD", (r) => r.symbol !== "LNKUSD");
f("a favor + MACD 5m a favor", (r) => r.align === "A_FAVOR" && ((r.side === "LONG") === (r.snap.macdTurning === "SUBINDO")));
log();

// Sanidade: executadas simuladas (para comparar com o real de ai_trades, ~36% em setembro)
const ex = rows.filter((r) => r.opened);
const reasons = {}; for (const r of ex) reasons[r.mine.reason] = (reasons[r.mine.reason] ?? 0) + 1;
log(`## Sanidade do simulador: ${ex.length} executadas, saidas simuladas ${JSON.stringify(reasons)}`);
log(`   custo medio ${(ex.reduce((s, r) => s + r.mine.costR, 0) / Math.max(1, ex.length)).toFixed(3)}R por trade; MFE mediano ${(ex.map((r) => r.mine.mfeR).sort((a, b) => a - b)[Math.floor(ex.length / 2)] ?? 0).toFixed(2)}R`);

fs.mkdirSync(path.join(HERE, "resultados"), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
fs.writeFileSync(path.join(HERE, "resultados", `01-auditoria-${stamp}.md`), out.join("\n") + "\n");
fs.writeFileSync(path.join(HERE, "resultados", `01-auditoria-${stamp}.json`), JSON.stringify(rows.map((r) => ({
  ts: r.ts, symbol: r.symbol, side: r.side, opened: r.opened, gate: r.gate, attempts: r.attempts, setupType: r.setupType, align: r.align, period: r.period,
  consensus: r.snap?.consensus, stoch: r.snap?.stochLabel, macd: r.snap?.macdTurning, r: r.mine.r, rOpp: r.opp.r, exit: r.mine.reason, mfeR: r.mine.mfeR,
})), null, 0));
console.log(`\nsalvo em research/replay/resultados/01-auditoria-${stamp}.md`);
